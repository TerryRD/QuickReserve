-- ============================================================================
-- 團班時段可見性修正 2/2：時段讀取規則（預約流程改版 v2 / P2 任務 1，可單獨上線）
-- 【草稿，尚未執行；需 terry 同意後由 terry 執行】可重複執行。
--
-- 白話說明：
--   時段讀取規則（slots_select）：非成員也讀得到「有人預約但還沒額滿（pending）」的時段。
--   已額滿（booked）、已關閉（cancelled）的照舊看不到。
--   用途：讓第二位以後的學員開得了團班的預約確認頁（確認頁是用登入學員的身分直接讀時段）。
--   個人班不受影響：個人班一有人預約時段就直接變成已額滿（booked），不會停在 pending。
--   萬一有舊資料留下 pending 的個人班時段，它會變成讀得到（只有時間與狀態，沒有任何學員資料），
--   新版確認頁會用已佔名額判斷，照樣顯示「時段已不可預約」。
--
-- 執行時機（重要）：
--   **建議等新版程式上線後接著執行。**
--   若線上還是舊版程式時先執行本檔：舊版公開頁會開始列出「有人預約的團班時段」，但人數顯示 0
--   （舊程式讀不到預約），點進去會被舊版確認頁擋成「時段已不可預約」。不會造成錯誤預約，只是誤導。
--   新版程式上線後、本檔執行前的這段時間：團班有人預約的時段在公開頁看得到、人數正確，
--   但其他學員點進確認頁會找不到頁面（修正前是連清單都看不到，所以不會更糟）。
--   前置：20261126110000_group_slot_visibility_functions.sql 已執行。
--
-- 執行後驗證：
--   select policyname, qual from pg_policies
--    where schemaname = 'public' and tablename = 'availability_slots' and policyname = 'slots_select';
--   -- qual 內應出現 'pending'
--
-- 回滾（還原成 20261126100600 的規則）：
--   drop policy if exists slots_select on public.availability_slots;
--   create policy slots_select on public.availability_slots
--     for select to anon, authenticated
--     using (
--       is_platform_admin()
--       or tenant_id in (select current_user_tenant_ids())
--       or (status = 'available'
--           and tenant_id in (select id from public.tenants where status = 'active'))
--       or id in (select public.current_user_booked_slot_ids())
--     );
-- ============================================================================

drop policy if exists slots_select on public.availability_slots;
create policy slots_select on public.availability_slots
  for select to anon, authenticated
  using (
    is_platform_admin()
    or tenant_id in (select current_user_tenant_ids())
    or (status in ('available', 'pending')
        and tenant_id in (select id from public.tenants where status = 'active'))
    -- 學員：自己有預約的時段（不論時段或預約狀態）
    or id in (select public.current_user_booked_slot_ids())
  );
