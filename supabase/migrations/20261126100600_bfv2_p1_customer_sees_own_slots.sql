-- ============================================================================
-- 預約流程改版 v2 / P1 — Migration 7：學員看得到自己預約的時段
-- 可重複執行。
--
-- 白話說明：
--   現行的時段讀取規則（slots_select）只讓非成員看到「可預約（available）」的時段。
--   學員一預約成功，時段就變成待確認（pending）或已額滿（booked），
--   學員反而讀不到自己那堂課的時間。後果：
--     * 「我的預約」卡片沒有日期，被歸到「已過」
--     * 卡片與明細頁沒有「改期」「取消預約」「簽到」按鈕（它們都要靠開課時間判斷）
--   這是 2026-05-22 那次權限調整留下的既有問題，由這次的 e2e 測試抓到。
--
--   修法：讀取規則多一個條件——學員可以讀「自己有預約的時段」。
--   不論預約狀態（含已取消、已出席），因為歷史預約也要顯示時間。
--   其他人的時段照舊看不到（只看得到可預約的）。
--
--   用 security definer 的輔助函式取「我有預約的時段」，避免時段規則與預約規則互相查詢。
--
-- 執行後驗證：
--   select policyname, qual from pg_policies
--    where schemaname = 'public' and tablename = 'availability_slots' and policyname = 'slots_select';
--   -- qual 內應出現 current_user_booked_slot_ids
--
-- 回滾：
--   drop policy if exists slots_select on public.availability_slots;
--   create policy slots_select on public.availability_slots
--     for select to anon, authenticated
--     using (
--       is_platform_admin()
--       or tenant_id in (select current_user_tenant_ids())
--       or (status = 'available'
--           and tenant_id in (select id from public.tenants where status = 'active'))
--     );
--   drop function if exists public.current_user_booked_slot_ids();
-- ============================================================================

create or replace function public.current_user_booked_slot_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select b.slot_id
    from public.bookings b
   where b.customer_id = auth.uid();
$$;

-- 這條讀取規則也套用在未登入者（anon）身上，所以 anon 也要能執行這個函式，
-- 否則未登入者查公開頁的時段會直接報權限錯誤（同 20260522060000 的教訓）。
-- 未登入時 auth.uid() 是 null，函式回傳空集合，不會多看到任何時段。
revoke execute on function public.current_user_booked_slot_ids() from public;
grant execute on function public.current_user_booked_slot_ids() to anon, authenticated;

drop policy if exists slots_select on public.availability_slots;
create policy slots_select on public.availability_slots
  for select to anon, authenticated
  using (
    is_platform_admin()
    or tenant_id in (select current_user_tenant_ids())
    or (status = 'available'
        and tenant_id in (select id from public.tenants where status = 'active'))
    -- 學員：自己有預約的時段（不論時段或預約狀態）
    or id in (select public.current_user_booked_slot_ids())
  );
