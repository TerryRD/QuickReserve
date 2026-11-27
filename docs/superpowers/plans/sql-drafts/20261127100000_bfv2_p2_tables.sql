-- ============================================================================
-- 預約流程改版 v2 / P2 — Migration 1：資料表（成班時間、請假申請、補堂來源）
-- 【草稿，尚未執行；需 terry 同意後由 terry 執行】可重複執行。只新增，不動既有資料。
-- 前置：團班時段可見性的兩個檔（20261126110000、20261126110100，QR-D 的分支）已執行。
--
-- 白話說明：
--   1. 時段 availability_slots 加 formed_at（成班時間）。
--      團班人數第一次達開班人數時記下來，只記一次、之後不撤銷（設計文件 §6）。
--   2. 購買 customer_purchases 加 source_booking_id（這筆補堂是因為哪筆預約的退回而發的）。
--      「來源＝補堂」的欄位 origin 第 1 階段已加好，這次只差這個連結（§9.3）。
--   3. 新表 leave_requests（請假申請，§3.7、§7.2）。
--      只能經由資料庫函式寫入；讀取：學員看自己的、Owner 看整個租戶、助教看自己時段的、平台管理員唯讀。
--
-- 執行後驗證：
--   select column_name from information_schema.columns
--    where table_schema = 'public'
--      and ((table_name = 'availability_slots' and column_name = 'formed_at')
--        or (table_name = 'customer_purchases' and column_name = 'source_booking_id'));   -- 2 列
--   select relrowsecurity from pg_class where relname = 'leave_requests';                  -- true
--   select policyname, cmd from pg_policies where tablename = 'leave_requests';            -- 只有 1 條 SELECT
--
-- 回滾（尚無資料時）：
--   drop table if exists public.leave_requests;
--   drop index if exists public.idx_customer_purchases_source_booking;
--   alter table public.customer_purchases drop column if exists source_booking_id;
--   alter table public.availability_slots drop column if exists formed_at;
-- ============================================================================

-- ---------- 1. 成班時間 ----------
alter table public.availability_slots
  add column if not exists formed_at timestamptz;

comment on column public.availability_slots.formed_at is
  '成班時間：團班（開班人數 ≥ 2）有效預約數第一次達開班人數的時間。只記一次，不撤銷。';

-- ---------- 2. 補堂來源 ----------
alter table public.customer_purchases
  add column if not exists source_booking_id uuid references public.bookings(id);

comment on column public.customer_purchases.source_booking_id is
  '補堂（origin = makeup）是因為哪一筆預約的退回而發放的';

create index if not exists idx_customer_purchases_source_booking
  on public.customer_purchases (source_booking_id)
  where source_booking_id is not null;

-- ---------- 3. 請假申請 ----------
create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  reason text not null check (char_length(reason) between 1 and 500),
  -- 學員想改去的時段（可不附）。時段被刪除時清空，不擋刪除。
  requested_slot_id uuid references public.availability_slots(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'approved_reschedule', 'approved_refund',
                      'rejected', 'withdrawn', 'void')),
  handled_by uuid references auth.users(id),
  handled_at timestamptz,
  handle_note text check (handle_note is null or char_length(handle_note) <= 500),
  handled_by_system boolean not null default false,
  created_at timestamptz not null default now(),
  -- 審核中＝還沒有處理時間；其他狀態一定有處理時間
  constraint leave_requests_handled_check
    check ((status = 'pending') = (handled_at is null)),
  -- 系統處理的沒有處理人
  constraint leave_requests_system_has_no_handler
    check (not handled_by_system or handled_by is null)
);

comment on table public.leave_requests is
  '請假申請（設計文件 §3.7、§7.2）。只由 security definer 函式寫入。';
comment on column public.leave_requests.status is
  'pending 審核中 / approved_reschedule 同意改期 / approved_refund 同意退回 / rejected 不同意 / withdrawn 已撤回 / void 已失效';

-- 同一筆預約同時只能有一筆審核中
create unique index if not exists leave_requests_one_pending
  on public.leave_requests (booking_id)
  where status = 'pending';

create index if not exists idx_leave_requests_booking
  on public.leave_requests (booking_id, created_at);
create index if not exists idx_leave_requests_tenant_status
  on public.leave_requests (tenant_id, status);
create index if not exists idx_leave_requests_customer
  on public.leave_requests (customer_id, created_at desc);
create index if not exists idx_leave_requests_requested_slot
  on public.leave_requests (requested_slot_id)
  where requested_slot_id is not null;
create index if not exists idx_leave_requests_handled_by
  on public.leave_requests (handled_by)
  where handled_by is not null;

alter table public.leave_requests enable row level security;

drop policy if exists leave_requests_select on public.leave_requests;
create policy leave_requests_select on public.leave_requests
  for select to authenticated
  using (
    is_platform_admin()
    -- Owner：整個租戶
    or tenant_id in (select current_user_owner_tenant_ids())
    -- 學員：自己的
    or customer_id = (select auth.uid())
    -- 助教：只看自己時段的預約（沿用第 1 階段的 is_own_slot_booking）
    or (
      tenant_id in (select current_user_tenant_ids())
      and public.is_own_slot_booking(booking_id)
    )
  );

revoke all on public.leave_requests from anon;
revoke insert, update, delete, truncate on public.leave_requests from authenticated;
