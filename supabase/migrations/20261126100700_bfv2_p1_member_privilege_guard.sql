-- ============================================================================
-- 預約流程改版 v2 / P1 — Migration 8：成員權限欄位防線
-- 可重複執行。必須在 Migration 1～7 之後執行。
--
-- 白話說明：
--   既有 RLS（tenant_members_update）允許「本人更新自己那一列」與「Owner 更新同租戶所有成員列」，
--   但沒有限制能改哪些欄位。結果助教可以用自己的登入身分，把自己那一列的 role 改成 owner，
--   直接升成 Owner；也能改自己的 status、tenant_id、invited_email 等欄位。
--   這裡不改表結構、不改資料、不改 RLS 政策，只新增一個觸發器補上欄位層級的防線：
--   1. 已登入的使用者只可能改 display_name、role、status 三個欄位；
--      其餘欄位（id、tenant_id、user_id、invited_email、invite_token、invite_expires_at、
--      parent_member_id、created_at，以及日後新增的欄位）一律不得由登入者變動，
--      違反時回 MEMBER_FIELD_LOCKED。
--   2. role、status 只有「同租戶的有效 Owner 改別人那一列」才可以；
--      任何人改自己那一列的 role／status（包含 Owner 自己），或不是該租戶 Owner 的人改，
--      都回 MEMBER_ROLE_STATUS_FORBIDDEN。
--   3. 伺服器端管理用連線（service role、資料庫管理連線，沒有登入者）不受影響。
--   不影響的既有流程：
--   - 接受邀請、Owner 移除助教、平台重寄邀請：都走伺服器端管理用連線，不會被擋。
--   - 帳號設定頁改姓名：以登入者身分更新自己的成員列，只動 display_name，不會被擋。
--   display_name「只能本人改」的限制仍由 Migration 6 的觸發器（tenant_members_guard_display_name）負責，
--   這裡不重複處理。
--
-- 執行後驗證：
--   -- 觸發器存在且掛在 tenant_members 上
--   select tgname from pg_trigger
--    where tgrelid = 'public.tenant_members'::regclass
--      and tgname = 'tenant_members_guard_privileged_columns';
--   -- 函式存在
--   select proname from pg_proc
--    where pronamespace = 'public'::regnamespace
--      and proname = 'tenant_members_guard_privileged_columns';
--
-- 回滾：
--   drop trigger if exists tenant_members_guard_privileged_columns on public.tenant_members;
--   drop function if exists public.tenant_members_guard_privileged_columns();
-- ============================================================================

create or replace function public.tenant_members_guard_privileged_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- 沒有登入者（service role、資料庫管理連線）不擋
  if auth.uid() is null then
    return new;
  end if;

  -- 白名單以外的欄位一律不得由登入者變動
  if (to_jsonb(new) - 'display_name' - 'role' - 'status')
     is distinct from (to_jsonb(old) - 'display_name' - 'role' - 'status') then
    raise exception 'MEMBER_FIELD_LOCKED' using errcode = '42501';
  end if;

  -- role／status：只有同租戶的有效 Owner 改別人那一列才可以
  if new.role is distinct from old.role or new.status is distinct from old.status then
    if old.user_id is not distinct from auth.uid() then
      raise exception 'MEMBER_ROLE_STATUS_FORBIDDEN' using errcode = '42501';
    end if;
    if old.tenant_id not in (select public.current_user_owner_tenant_ids()) then
      raise exception 'MEMBER_ROLE_STATUS_FORBIDDEN' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists tenant_members_guard_privileged_columns on public.tenant_members;
create trigger tenant_members_guard_privileged_columns
  before update on public.tenant_members
  for each row execute function public.tenant_members_guard_privileged_columns();
