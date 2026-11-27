-- ============================================================================
-- 團班時段可見性修正 1/2：兩支查詢函式（預約流程改版 v2 / P2 任務 1，可單獨上線）
-- 【草稿，尚未執行；需 terry 同意後由 terry 執行】可重複執行。
--
-- 白話說明：
--   現況：團班只要有 1 位學員預約，時段狀態就從「沒人預約（available）」變成「有人預約（pending）」。
--   但時段的讀取規則只讓非成員看到 available 的時段，所以：
--     * 未登入訪客與其他學員在公開頁看不到這個時段，開預約確認頁也找不到
--     * 公開頁是用未登入身分查的，讀不到任何預約，團班人數永遠是 0
--   資料庫的預約函式本身是肯收第二位學員的，問題只在「看不到」。
--   （2026-11-26 QR-D 以 tests/integration/group-slot-visibility.test.ts 實際重現。）
--
--   修法分兩個檔：
--     本檔（1/2）：只新增兩支函式，不改任何既有規則。
--       1. slot_taken_count：回傳「這個時段已佔幾個名額」，只給數字，不給任何學員資料。
--          名額＝未取消的預約＋「學員臨時取消（教練代登）」的已取消預約（設計文件 §7.3；
--          後者在第 2 階段其餘部分上線前不會有資料，先照最終算法寫好，之後不用再改）。
--       2. public_bookable_slots：公開頁用的查詢，回傳「還能預約的時段＋已佔名額」。
--          只回傳尚未開課、未額滿、教練未停用的時段；一次最多查 62 天。
--     下一個檔（2/2，20261126110100）：時段讀取規則放寬。
--
-- 執行時機（重要）：
--   本檔對線上舊版程式**完全沒有影響**（舊程式不會呼叫這兩支函式），可以在新版程式上線前任何時候先執行。
--   新版程式上線前**一定要先執行本檔**，否則公開頁會查不到時段。
--
-- 執行後驗證：
--   select proname from pg_proc where proname in ('slot_taken_count', 'public_bookable_slots');  -- 2 列
--
-- 回滾：
--   drop function if exists public.public_bookable_slots(uuid, uuid, timestamptz, timestamptz);
--   drop function if exists public.slot_taken_count(uuid);
--   （回滾前新版程式要先退版，否則公開頁會查不到時段。）
-- ============================================================================

-- ---------- 1. 已佔名額 ----------
create or replace function public.slot_taken_count(p_slot_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
    from public.bookings b
   where b.slot_id = p_slot_id
     and (b.status <> 'cancelled' or b.cancel_category = 'late_cancel');
$$;

comment on function public.slot_taken_count(uuid) is
  '時段已佔名額：未取消的預約＋學員臨時取消（教練代登）的已取消預約。只回傳數字。';

-- 預約確認頁（登入學員）與公開頁（未登入）都要用，只回傳一個數字
revoke execute on function public.slot_taken_count(uuid) from public;
grant execute on function public.slot_taken_count(uuid) to anon, authenticated;

-- ---------- 2. 公開頁查詢：還能預約的時段＋已佔名額 ----------
create or replace function public.public_bookable_slots(
  p_tenant_id uuid,
  p_service_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  id uuid,
  start_at timestamptz,
  end_at timestamptz,
  max_capacity int,
  taken int
)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.start_at, s.end_at, sv.max_capacity, public.slot_taken_count(s.id) as taken
    from public.availability_slots s
    join public.services sv on sv.id = s.service_id
    join public.tenants t on t.id = s.tenant_id
   where s.tenant_id = p_tenant_id
     and s.service_id = p_service_id
     and t.status = 'active'
     and s.status in ('available', 'pending')
     and s.start_at >= p_from
     -- 一次最多查 62 天（月曆格 42 天），避免被拿來整批撈資料
     and s.start_at < least(p_to, p_from + interval '62 days')
     and s.start_at > now()
     and public.slot_taken_count(s.id) < sv.max_capacity
   order by s.start_at;
$$;

comment on function public.public_bookable_slots(uuid, uuid, timestamptz, timestamptz) is
  '公開頁用：某教練某服務在一段時間內還能預約的時段與已佔名額。不回傳任何學員資料。';

revoke execute on function public.public_bookable_slots(uuid, uuid, timestamptz, timestamptz) from public;
grant execute on function public.public_bookable_slots(uuid, uuid, timestamptz, timestamptz)
  to anon, authenticated;
