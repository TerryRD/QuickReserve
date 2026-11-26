-- ============================================================================
-- 預約流程改版 v2 / P1 — Migration 6：成員顯示名稱
-- 可重複執行。必須在 Migration 1～5 之後執行。
--
-- 白話說明：
--   教練／助教原本沒有姓名欄位，教練端畫面拿邀請 email 的 @ 前段當名稱。
--   這裡替 tenant_members 加上 display_name：
--   1. 新欄位 display_name（可空，上限 60 字，與帳號設定頁的姓名驗證一致）。
--   2. 回填：既有成員的 display_name 還是空的，就從登入帳號的姓名
--      （auth.users.raw_user_meta_data 的 full_name，與 get-session 讀的同一個 key）帶入；
--      沒填姓名、只有空白、或超過 60 字的就留空，畫面會退回 email 的 @ 前段。
--   3. 防線：已登入的使用者只能改「自己那一列」的 display_name。
--      既有 RLS（tenant_members_update）允許 Owner 更新同租戶所有成員列，
--      這裡用觸發器擋下「Owner 改助教的名稱」這類改別人名稱的寫入。
--      伺服器端管理用連線（service role，沒有登入者）不受影響。
--   帳號設定頁儲存姓名時，以登入者身分更新自己所有的成員列（既有 RLS 已允許本人更新自己的列），
--   不需要新增 RLS 政策。
--
-- 執行後驗證：
--   -- 欄位、限制、觸發器都存在
--   select column_name, data_type, is_nullable
--     from information_schema.columns
--    where table_schema = 'public' and table_name = 'tenant_members' and column_name = 'display_name';
--   select conname from pg_constraint
--    where conrelid = 'public.tenant_members'::regclass
--      and conname = 'tenant_members_display_name_length_check';
--   select tgname from pg_trigger
--    where tgrelid = 'public.tenant_members'::regclass
--      and tgname = 'tenant_members_guard_display_name';
--   -- 回填結果：有姓名的帳號應已帶入；剩下為空的應是帳號本身沒有姓名（或超過 60 字）
--   select m.id, m.role, m.display_name, u.raw_user_meta_data ->> 'full_name' as full_name
--     from public.tenant_members m
--     left join auth.users u on u.id = m.user_id
--    order by m.display_name nulls first;
--
-- 回滾：
--   drop trigger if exists tenant_members_guard_display_name on public.tenant_members;
--   drop function if exists public.tenant_members_guard_display_name();
--   alter table public.tenant_members drop constraint if exists tenant_members_display_name_length_check;
--   alter table public.tenant_members drop column if exists display_name;
-- ============================================================================

-- 1. 欄位與限制
alter table public.tenant_members
  add column if not exists display_name text;

comment on column public.tenant_members.display_name is
  '成員在教練端畫面顯示的名稱（帳號設定頁的姓名同步寫入）；空值時畫面退回邀請 email 的 @ 前段';

alter table public.tenant_members drop constraint if exists tenant_members_display_name_length_check;
alter table public.tenant_members add constraint tenant_members_display_name_length_check
  check (display_name is null or char_length(display_name) <= 60);

-- 2. 回填：只補還是空的列；姓名去頭尾空白後為 1～60 字才帶入
update public.tenant_members m
   set display_name = btrim(u.raw_user_meta_data ->> 'full_name')
  from auth.users u
 where u.id = m.user_id
   and m.display_name is null
   and char_length(btrim(coalesce(u.raw_user_meta_data ->> 'full_name', ''))) between 1 and 60;

-- 3. 防線：登入者只能寫自己那一列的 display_name
create or replace function public.tenant_members_guard_display_name()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- 沒有登入者（service role、資料庫管理連線）不擋
  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.display_name is not null and new.user_id is distinct from auth.uid() then
      raise exception 'MEMBER_NAME_NOT_OWN' using errcode = '42501';
    end if;
  elsif new.display_name is distinct from old.display_name
        and old.user_id is distinct from auth.uid() then
    raise exception 'MEMBER_NAME_NOT_OWN' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists tenant_members_guard_display_name on public.tenant_members;
create trigger tenant_members_guard_display_name
  before insert or update on public.tenant_members
  for each row execute function public.tenant_members_guard_display_name();
