-- ============================================================================
-- 預約流程改版 v2 / P1 — Migration 1：新表（歷程、堂數異動明細、平台設定）
-- 可重複執行。
-- ============================================================================

-- ---------- 1. platform_settings ----------
create table if not exists public.platform_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

drop trigger if exists platform_settings_set_updated_at on public.platform_settings;
create trigger platform_settings_set_updated_at
  before update on public.platform_settings
  for each row execute function public.set_updated_at();

comment on table public.platform_settings is '平台層級可調整數值（設計文件 §13）。由平台管理者以 SQL 維護。';

insert into public.platform_settings (key, value) values
  ('min_response_hours',      '2'::jsonb),   -- 最短回應時間（小時）§4.4
  ('reminder_lead_hours',     '2'::jsonb),   -- 提醒提前量（小時）§4.4、§7.2
  ('attendance_pending_days', '7'::jsonb),   -- 待點名期限（天）§8.2
  ('attendance_revise_days',  '7'::jsonb),   -- 改判期限（天）§8.4
  ('dispute_open_days',       '7'::jsonb),   -- 異議提出期限（天）§11
  ('dispute_resolve_days',    '7'::jsonb),   -- 異議處理期限（天）§11
  ('makeup_grace_days',       '30'::jsonb),  -- 補堂寬限天數 §9.3
  ('customer_cancel_reasons', '["生病","工作","交通","天氣","其他"]'::jsonb)  -- 學員常用取消原因 §3.2
on conflict (key) do nothing;

alter table public.platform_settings enable row level security;

drop policy if exists platform_settings_select on public.platform_settings;
create policy platform_settings_select on public.platform_settings
  for select to authenticated
  using (true);

revoke all on public.platform_settings from anon;
revoke insert, update, delete, truncate on public.platform_settings from authenticated;

-- ---------- 2. activity_log ----------
create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  subject_type text not null
    check (subject_type in ('booking', 'leave_request', 'dispute', 'purchase',
                            'service', 'slot', 'member', 'customer')),
  subject_id uuid not null,
  booking_id uuid references public.bookings(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete cascade,
  event text not null,
  actor_user_id uuid references auth.users(id),
  actor_role text not null check (actor_role in ('customer', 'owner', 'staff', 'system')),
  reason text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint activity_log_system_has_no_actor
    check (actor_role <> 'system' or actor_user_id is null)
);

comment on table public.activity_log is '歷程（設計文件 §10.1）。只增不改；只由 security definer 函式寫入。';
comment on column public.activity_log.customer_id is '這筆紀錄相關的學員（供學員端查詢與 RLS 使用）';
comment on column public.activity_log.booking_id is '相關預約（若有）';

create index if not exists idx_activity_log_booking
  on public.activity_log (booking_id, created_at) where booking_id is not null;
create index if not exists idx_activity_log_tenant_time
  on public.activity_log (tenant_id, created_at desc);
create index if not exists idx_activity_log_subject
  on public.activity_log (subject_type, subject_id, created_at);
create index if not exists idx_activity_log_customer
  on public.activity_log (customer_id, created_at desc) where customer_id is not null;
create index if not exists idx_activity_log_actor
  on public.activity_log (actor_user_id) where actor_user_id is not null;

-- ---------- 3. class_ledger ----------
create table if not exists public.class_ledger (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.customer_purchases(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete cascade,
  delta int not null check (delta <> 0),
  reason_code text not null,
  actor_user_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

comment on table public.class_ledger is '堂數異動明細（設計文件 §10.2）。delta＝剩餘堂數的變化（扣 −1、退 +1）；customer_purchases.classes_used 必須等於 −sum(delta)。';

create index if not exists idx_class_ledger_purchase
  on public.class_ledger (purchase_id, created_at);
create index if not exists idx_class_ledger_booking
  on public.class_ledger (booking_id) where booking_id is not null;
create index if not exists idx_class_ledger_actor
  on public.class_ledger (actor_user_id) where actor_user_id is not null;

-- ---------- 只增不改：擋 UPDATE ----------
create or replace function public.forbid_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'APPEND_ONLY' using errcode = 'P0001';
end;
$$;

drop trigger if exists activity_log_no_update on public.activity_log;
create trigger activity_log_no_update
  before update on public.activity_log
  for each row execute function public.forbid_update();

drop trigger if exists class_ledger_no_update on public.class_ledger;
create trigger class_ledger_no_update
  before update on public.class_ledger
  for each row execute function public.forbid_update();

-- ---------- 4. RLS ----------
-- 助教「自己時段的預約」判斷（給 RLS 政策用，所以要開放 authenticated 執行）
create or replace function public.is_own_slot_booking(p_booking_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.bookings b
      join public.availability_slots s on s.id = b.slot_id
      join public.tenant_members m on m.id = s.member_id
     where b.id = p_booking_id
       and m.user_id = auth.uid()
       and m.status = 'active'
  );
$$;

revoke execute on function public.is_own_slot_booking(uuid) from public, anon;
grant execute on function public.is_own_slot_booking(uuid) to authenticated;

alter table public.activity_log enable row level security;

drop policy if exists activity_log_select on public.activity_log;
create policy activity_log_select on public.activity_log
  for select to authenticated
  using (
    is_platform_admin()
    -- Owner：整個租戶
    or tenant_id in (select current_user_owner_tenant_ids())
    -- 學員：與自己有關、且屬於學員該看得到的對象種類
    or (
      customer_id = (select auth.uid())
      and subject_type in ('booking', 'leave_request', 'dispute', 'purchase')
    )
    -- 助教：只看自己時段的預約
    or (
      booking_id is not null
      and tenant_id in (select current_user_tenant_ids())
      and public.is_own_slot_booking(booking_id)
    )
  );

revoke all on public.activity_log from anon;
revoke insert, update, delete, truncate on public.activity_log from authenticated;

alter table public.class_ledger enable row level security;

drop policy if exists class_ledger_select on public.class_ledger;
create policy class_ledger_select on public.class_ledger
  for select to authenticated
  using (
    exists (
      select 1
        from public.customer_purchases cp
       where cp.id = class_ledger.purchase_id
         and (
           is_platform_admin()
           or cp.customer_id = (select auth.uid())
           or cp.tenant_id in (select current_user_tenant_ids())
         )
    )
  );

revoke all on public.class_ledger from anon;
revoke insert, update, delete, truncate on public.class_ledger from authenticated;
