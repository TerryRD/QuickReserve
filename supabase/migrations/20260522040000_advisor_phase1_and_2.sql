-- ============================================================
-- Supabase Advisor cleanup (Phase 1 + 2)
-- ------------------------------------------------------------
-- Addresses:
--   • auth_rls_initplan (20)         — wrap auth.uid() in (select auth.uid())
--   • multiple_permissive_policies   — consolidate per (table, cmd) into ONE policy
--                                      and restrict via TO authenticated[, anon]
--   • unindexed_foreign_keys (9)     — add covering indexes
--   • function_search_path_mutable   — set_updated_at trigger function
--   • anon EXECUTE on private RPCs   — revoke for non-public functions
-- ============================================================

-- ----------------------------------------------------------------
-- A. Trigger function: lock down search_path
-- ----------------------------------------------------------------
alter function public.set_updated_at() set search_path = '';

-- ----------------------------------------------------------------
-- B. RLS helper functions — wrap auth.uid() so they cache per-statement
--    (re-create with same body but with explicit search_path already set)
--    Existing definitions already have `set search_path = public`, no change needed,
--    but we wrap the references inside helper-function bodies that DIRECTLY
--    used auth.uid() previously. The bodies live in functions, so when an RLS
--    policy calls `current_user_tenant_ids()` Postgres already treats it as
--    one call per statement — no change required here. Helpers stay as-is.

-- ----------------------------------------------------------------
-- C. Consolidate policies
-- ----------------------------------------------------------------

-- ============ availability_slots ============
drop policy if exists slots_select_admin   on public.availability_slots;
drop policy if exists slots_select_member  on public.availability_slots;
drop policy if exists slots_select_public  on public.availability_slots;
drop policy if exists slots_insert_self    on public.availability_slots;
drop policy if exists slots_insert_owner   on public.availability_slots;
drop policy if exists slots_update_self    on public.availability_slots;
drop policy if exists slots_update_owner   on public.availability_slots;
drop policy if exists slots_delete_self    on public.availability_slots;
drop policy if exists slots_delete_owner   on public.availability_slots;

create policy slots_select on public.availability_slots
  for select to authenticated, anon
  using (
    is_platform_admin()
    or tenant_id in (select current_user_tenant_ids())
    or (status = 'available' and tenant_id in (select id from public.tenants where status = 'active'))
  );

create policy slots_insert on public.availability_slots
  for insert to authenticated
  with check (
    tenant_id in (select current_user_owner_tenant_ids())
    or (
      tenant_id in (select current_user_tenant_ids())
      and member_id in (
        select id from public.tenant_members
        where user_id = (select auth.uid()) and status = 'active'
      )
    )
  );

create policy slots_update on public.availability_slots
  for update to authenticated
  using (
    tenant_id in (select current_user_owner_tenant_ids())
    or member_id in (
      select id from public.tenant_members
      where user_id = (select auth.uid()) and status = 'active'
    )
  );

create policy slots_delete on public.availability_slots
  for delete to authenticated
  using (
    tenant_id in (select current_user_owner_tenant_ids())
    or member_id in (
      select id from public.tenant_members
      where user_id = (select auth.uid()) and status = 'active'
    )
  );

-- ============ bookings ============
drop policy if exists bookings_select_admin         on public.bookings;
drop policy if exists bookings_select_member        on public.bookings;
drop policy if exists bookings_select_own_customer  on public.bookings;
drop policy if exists bookings_insert_customer      on public.bookings;
drop policy if exists bookings_insert_member        on public.bookings;
drop policy if exists bookings_update_member        on public.bookings;
drop policy if exists bookings_update_own_customer  on public.bookings;

create policy bookings_select on public.bookings
  for select to authenticated
  using (
    is_platform_admin()
    or tenant_id in (select current_user_tenant_ids())
    or customer_id = (select auth.uid())
  );

create policy bookings_insert on public.bookings
  for insert to authenticated
  with check (
    customer_id = (select auth.uid())
    or tenant_id in (select current_user_tenant_ids())
  );

create policy bookings_update on public.bookings
  for update to authenticated
  using (
    customer_id = (select auth.uid())
    or tenant_id in (select current_user_tenant_ids())
  );

-- ============ customers ============
drop policy if exists customers_select_admin         on public.customers;
drop policy if exists customers_select_self          on public.customers;
drop policy if exists customers_select_tenant_member on public.customers;
drop policy if exists customers_upsert_self          on public.customers;
drop policy if exists customers_update_self          on public.customers;

create policy customers_select on public.customers
  for select to authenticated
  using (
    id = (select auth.uid())
    or is_platform_admin()
    or id in (
      select customer_id from public.tenant_customers
      where tenant_id in (select current_user_tenant_ids())
    )
  );

create policy customers_insert_self on public.customers
  for insert to authenticated
  with check (id = (select auth.uid()));

create policy customers_update_self on public.customers
  for update to authenticated
  using (id = (select auth.uid()));

-- ============ tenant_customers ============
drop policy if exists tenant_customers_select_member on public.tenant_customers;
drop policy if exists tenant_customers_insert_member on public.tenant_customers;
drop policy if exists tenant_customers_update_member on public.tenant_customers;

create policy tenant_customers_select on public.tenant_customers
  for select to authenticated
  using (
    tenant_id in (select current_user_tenant_ids())
    or customer_id = (select auth.uid())
    or is_platform_admin()
  );

create policy tenant_customers_insert on public.tenant_customers
  for insert to authenticated
  with check (
    tenant_id in (select current_user_tenant_ids())
    or customer_id = (select auth.uid())
  );

create policy tenant_customers_update on public.tenant_customers
  for update to authenticated
  using (
    tenant_id in (select current_user_tenant_ids())
    or is_platform_admin()
  );

-- ============ recurring_rules ============
drop policy if exists recurring_rules_select_admin  on public.recurring_rules;
drop policy if exists recurring_rules_select_member on public.recurring_rules;
drop policy if exists recurring_rules_insert_self   on public.recurring_rules;
drop policy if exists recurring_rules_insert_owner  on public.recurring_rules;
drop policy if exists recurring_rules_update_self   on public.recurring_rules;
drop policy if exists recurring_rules_update_owner  on public.recurring_rules;
drop policy if exists recurring_rules_delete_self   on public.recurring_rules;
drop policy if exists recurring_rules_delete_owner  on public.recurring_rules;

create policy recurring_rules_select on public.recurring_rules
  for select to authenticated
  using (
    is_platform_admin()
    or tenant_id in (select current_user_tenant_ids())
  );

create policy recurring_rules_insert on public.recurring_rules
  for insert to authenticated
  with check (
    tenant_id in (select current_user_owner_tenant_ids())
    or (
      tenant_id in (select current_user_tenant_ids())
      and member_id in (
        select id from public.tenant_members
        where user_id = (select auth.uid()) and status = 'active'
      )
    )
  );

create policy recurring_rules_update on public.recurring_rules
  for update to authenticated
  using (
    tenant_id in (select current_user_owner_tenant_ids())
    or member_id in (
      select id from public.tenant_members
      where user_id = (select auth.uid()) and status = 'active'
    )
  );

create policy recurring_rules_delete on public.recurring_rules
  for delete to authenticated
  using (
    tenant_id in (select current_user_owner_tenant_ids())
    or member_id in (
      select id from public.tenant_members
      where user_id = (select auth.uid()) and status = 'active'
    )
  );

-- ============ services ============
drop policy if exists services_select_admin  on public.services;
drop policy if exists services_select_member on public.services;
drop policy if exists services_select_public on public.services;
drop policy if exists services_insert_owner  on public.services;
drop policy if exists services_update_owner  on public.services;
drop policy if exists services_delete_owner  on public.services;

create policy services_select on public.services
  for select to authenticated, anon
  using (
    is_platform_admin()
    or tenant_id in (select current_user_tenant_ids())
    or (is_active = true and tenant_id in (select id from public.tenants where status = 'active'))
  );

create policy services_insert on public.services
  for insert to authenticated
  with check (tenant_id in (select current_user_owner_tenant_ids()));

create policy services_update on public.services
  for update to authenticated
  using (tenant_id in (select current_user_owner_tenant_ids()));

create policy services_delete on public.services
  for delete to authenticated
  using (tenant_id in (select current_user_owner_tenant_ids()));

-- ============ tenant_members ============
drop policy if exists tenant_members_select_admin  on public.tenant_members;
drop policy if exists tenant_members_select_owner  on public.tenant_members;
drop policy if exists tenant_members_select_self   on public.tenant_members;
drop policy if exists tenant_members_insert_admin  on public.tenant_members;
drop policy if exists tenant_members_insert_owner  on public.tenant_members;
drop policy if exists tenant_members_update_owner  on public.tenant_members;
drop policy if exists tenant_members_update_self   on public.tenant_members;

create policy tenant_members_select on public.tenant_members
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or is_platform_admin()
    or tenant_id in (select current_user_owner_tenant_ids())
  );

create policy tenant_members_insert on public.tenant_members
  for insert to authenticated
  with check (
    is_platform_admin()
    or (
      role = 'staff'
      and tenant_id in (select current_user_owner_tenant_ids())
    )
  );

create policy tenant_members_update on public.tenant_members
  for update to authenticated
  using (
    user_id = (select auth.uid())
    or tenant_id in (select current_user_owner_tenant_ids())
  )
  with check (
    user_id = (select auth.uid())
    or tenant_id in (select current_user_owner_tenant_ids())
  );

-- ============ tenants ============
-- Already a single policy per (cmd, role); just wrap auth.uid() for any direct refs.
-- tenants_select_member / tenants_insert_admin / tenants_update_admin_or_owner
-- all go through helpers, so no auth.uid() wrapping needed. Restrict TO roles.
drop policy if exists tenants_select_member         on public.tenants;
drop policy if exists tenants_insert_admin          on public.tenants;
drop policy if exists tenants_update_admin_or_owner on public.tenants;

create policy tenants_select on public.tenants
  for select to authenticated, anon
  using (
    is_platform_admin()
    or id in (select current_user_tenant_ids())
    or status = 'active'
  );

create policy tenants_insert_admin on public.tenants
  for insert to authenticated
  with check (is_platform_admin());

create policy tenants_update on public.tenants
  for update to authenticated
  using (
    is_platform_admin()
    or id in (select current_user_owner_tenant_ids())
  );

-- ============ platform_admins ============
drop policy if exists platform_admins_select_self on public.platform_admins;
create policy platform_admins_select on public.platform_admins
  for select to authenticated
  using (user_id = (select auth.uid()) or is_platform_admin());

-- ============ push_subscriptions ============
drop policy if exists push_subs_self on public.push_subscriptions;
create policy push_subs_self on public.push_subscriptions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ============ notification_preferences ============
drop policy if exists notif_prefs_self on public.notification_preferences;
create policy notif_prefs_self on public.notification_preferences
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ============ notification_log ============
drop policy if exists notif_log_self on public.notification_log;
create policy notif_log_self on public.notification_log
  for select to authenticated
  using (user_id = (select auth.uid()) or is_platform_admin());

-- ----------------------------------------------------------------
-- D. Add covering indexes for unindexed foreign keys
-- ----------------------------------------------------------------
create index if not exists idx_slots_recurring_rule       on public.availability_slots(recurring_rule_id);
create index if not exists idx_slots_service              on public.availability_slots(service_id);
create index if not exists idx_bookings_cancelled_by      on public.bookings(cancelled_by);
create index if not exists idx_bookings_service           on public.bookings(service_id);
create index if not exists idx_recurring_rules_member     on public.recurring_rules(member_id);
create index if not exists idx_recurring_rules_service    on public.recurring_rules(service_id);
create index if not exists idx_recurring_rules_tenant     on public.recurring_rules(tenant_id);
create index if not exists idx_tenant_customers_customer  on public.tenant_customers(customer_id);
create index if not exists idx_tenant_members_parent      on public.tenant_members(parent_member_id);

-- E. Revoke anon EXECUTE on private RPCs (server-only RPCs callable only by logged-in users)
do $rev$
begin
  execute 'revoke execute on function public.book_slot_atomic(uuid, uuid, text) from anon';
  execute 'revoke execute on function public.cancel_booking(uuid) from anon';
  execute 'revoke execute on function public.confirm_booking(uuid) from anon';
  execute 'revoke execute on function public.reschedule_booking(uuid, uuid) from anon';
  execute 'revoke execute on function public.is_platform_admin() from anon';
  execute 'revoke execute on function public.current_user_tenant_ids() from anon';
  execute 'revoke execute on function public.current_user_owner_tenant_ids() from anon';
end
$rev$;
