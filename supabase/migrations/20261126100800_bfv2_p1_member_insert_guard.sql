-- ============================================================================
-- 預約流程改版 v2 / P1 — Migration 9：成員新增防線
-- 可重複執行。必須在 Migration 1～8 之後執行。
--
-- 白話說明：
--   既有 RLS（tenant_members_insert）允許 Owner 以登入者身分在自己的租戶新增 role = 'staff' 的成員列，
--   但沒有限制 user_id 與 status。結果 Owner 可以直接新增一列
--   「role = 'staff'、status = 'active'、user_id = 任意帳號」，不經邀請就把別人的帳號掛成自己店的助教，
--   對方登入時的角色判斷會因此出錯。
--   漏洞出在這條政策的 with check：INSERT 的 with check 看得到整列新值，直接在源頭補條件即可，
--   不必像 Migration 8 那樣用觸發器（那是因為 UPDATE 政策無法比較新舊值）。
--   這裡不改表結構、不改資料、不加觸發器，只重建這一條政策：
--   1. Owner 分支加上 user_id is null 且 status = 'invited'：
--      Owner 以登入者身分最多只能新增「尚未接受的助教邀請列」；
--      要寫入 user_id、改成 active，只能走接受邀請流程（伺服器端管理用連線）。
--   2. 平台管理員分支（is_platform_admin()）不變。
--   不影響的既有流程（全部走伺服器端管理用連線，service role 不受 RLS 約束）：
--   - 邀請助教（src/app/(tenant)/staff/actions.ts）：新增 user_id null、role staff、status invited 的列。
--   - 平台建立店家與 Owner（src/app/(platform)/platform/tenants/actions.ts）：
--     新增 user_id null、role owner、status invited 的列。
--   - scripts 與所有測試輔助：直接新增有效（active）成員。
--   - 接受邀請：是更新既有的邀請列，不是新增，不受這條政策影響。
--
-- 執行後驗證：
--   select policyname, cmd, with_check from pg_policies
--    where schemaname = 'public'
--      and tablename = 'tenant_members'
--      and policyname = 'tenant_members_insert';
--   -- 應看到 cmd = INSERT，with_check 含 user_id IS NULL 與 'invited'
--
-- 回滾（還原成原本的政策）：
--   drop policy if exists tenant_members_insert on public.tenant_members;
--   create policy tenant_members_insert on public.tenant_members
--     for insert to authenticated
--     with check (
--       is_platform_admin()
--       or (
--         role = 'staff'
--         and tenant_id in (select current_user_owner_tenant_ids())
--       )
--     );
-- ============================================================================

drop policy if exists tenant_members_insert on public.tenant_members;
create policy tenant_members_insert on public.tenant_members
  for insert to authenticated
  with check (
    is_platform_admin()
    or (
      role = 'staff'
      and user_id is null
      and status = 'invited'
      and tenant_id in (select current_user_owner_tenant_ids())
    )
  );
