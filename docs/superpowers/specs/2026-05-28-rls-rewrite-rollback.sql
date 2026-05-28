-- ROLLBACK for migration <TS>_rls_rewrite_combine_permissive.sql
-- Restores the original 7-table policy state (5/3/5/5/6/6/6 = 36 policies total).
-- NOT in supabase/migrations/ because it should never auto-apply. To use:
--
--   SUPABASE_ACCESS_TOKEN=<token> npx supabase db execute \
--     --file docs/superpowers/specs/2026-05-28-rls-rewrite-rollback.sql
--
-- Or paste into Dashboard → SQL Editor.

begin;

-- ============ availability_templates ============
drop policy if exists templates_select on public.availability_templates;
drop policy if exists templates_insert on public.availability_templates;
drop policy if exists templates_update on public.availability_templates;
drop policy if exists templates_delete on public.availability_templates;

create policy templates_select_member on public.availability_templates for select
  using (member_id in (select id from public.tenant_members where user_id = auth.uid() and status = 'active'));
create policy templates_select_owner on public.availability_templates for select
  using (member_id in (select id from public.tenant_members where tenant_id in (select current_user_owner_tenant_ids())));
create policy templates_select_admin on public.availability_templates for select
  using (is_platform_admin());
create policy templates_modify_member on public.availability_templates for all
  using (member_id in (select id from public.tenant_members where user_id = auth.uid() and status = 'active'))
  with check (member_id in (select id from public.tenant_members where user_id = auth.uid() and status = 'active'));
create policy templates_modify_owner on public.availability_templates for all
  using (member_id in (select id from public.tenant_members where tenant_id in (select current_user_owner_tenant_ids())))
  with check (member_id in (select id from public.tenant_members where tenant_id in (select current_user_owner_tenant_ids())));

-- ============ availability_template_windows ============
drop policy if exists template_windows_select on public.availability_template_windows;
drop policy if exists template_windows_insert on public.availability_template_windows;
drop policy if exists template_windows_update on public.availability_template_windows;
drop policy if exists template_windows_delete on public.availability_template_windows;

create policy template_windows_select on public.availability_template_windows for select
  using (template_id in (select id from public.availability_templates));
create policy template_windows_modify_member on public.availability_template_windows for all
  using (template_id in (
    select id from public.availability_templates
    where member_id in (select id from public.tenant_members where user_id = auth.uid() and status = 'active')
  ))
  with check (template_id in (
    select id from public.availability_templates
    where member_id in (select id from public.tenant_members where user_id = auth.uid() and status = 'active')
  ));
create policy template_windows_modify_owner on public.availability_template_windows for all
  using (template_id in (
    select id from public.availability_templates
    where member_id in (select id from public.tenant_members where tenant_id in (select current_user_owner_tenant_ids()))
  ))
  with check (template_id in (
    select id from public.availability_templates
    where member_id in (select id from public.tenant_members where tenant_id in (select current_user_owner_tenant_ids()))
  ));

-- ============ availability_template_assignments ============
drop policy if exists assignments_select on public.availability_template_assignments;
drop policy if exists assignments_insert on public.availability_template_assignments;
drop policy if exists assignments_update on public.availability_template_assignments;
drop policy if exists assignments_delete on public.availability_template_assignments;

create policy assignments_select_member on public.availability_template_assignments for select
  using (member_id in (select id from public.tenant_members where user_id = auth.uid() and status = 'active'));
create policy assignments_select_owner on public.availability_template_assignments for select
  using (member_id in (select id from public.tenant_members where tenant_id in (select current_user_owner_tenant_ids())));
create policy assignments_select_admin on public.availability_template_assignments for select
  using (is_platform_admin());
create policy assignments_modify_member on public.availability_template_assignments for all
  using (member_id in (select id from public.tenant_members where user_id = auth.uid() and status = 'active'))
  with check (member_id in (select id from public.tenant_members where user_id = auth.uid() and status = 'active'));
create policy assignments_modify_owner on public.availability_template_assignments for all
  using (member_id in (select id from public.tenant_members where tenant_id in (select current_user_owner_tenant_ids())))
  with check (member_id in (select id from public.tenant_members where tenant_id in (select current_user_owner_tenant_ids())));

-- ============ unavailable_events ============
drop policy if exists events_select on public.unavailable_events;
drop policy if exists events_insert on public.unavailable_events;
drop policy if exists events_update on public.unavailable_events;
drop policy if exists events_delete on public.unavailable_events;

create policy events_select_member on public.unavailable_events for select
  using (member_id in (select id from public.tenant_members where user_id = auth.uid() and status = 'active'));
create policy events_select_owner on public.unavailable_events for select
  using (member_id in (select id from public.tenant_members where tenant_id in (select current_user_owner_tenant_ids())));
create policy events_select_admin on public.unavailable_events for select
  using (is_platform_admin());
create policy events_modify_member on public.unavailable_events for all
  using (member_id in (select id from public.tenant_members where user_id = auth.uid() and status = 'active'))
  with check (member_id in (select id from public.tenant_members where user_id = auth.uid() and status = 'active'));
create policy events_modify_owner on public.unavailable_events for all
  using (member_id in (select id from public.tenant_members where tenant_id in (select current_user_owner_tenant_ids())))
  with check (member_id in (select id from public.tenant_members where tenant_id in (select current_user_owner_tenant_ids())));

-- ============ customer_purchases ============
drop policy if exists customer_purchases_select on public.customer_purchases;
drop policy if exists customer_purchases_insert on public.customer_purchases;

create policy customer_purchases_select_customer on public.customer_purchases for select
  using (customer_id = auth.uid());
create policy customer_purchases_select_member on public.customer_purchases for select
  using (tenant_id in (select current_user_tenant_ids()));
create policy customer_purchases_select_admin on public.customer_purchases for select
  using (is_platform_admin());
create policy customer_purchases_insert_customer on public.customer_purchases for insert
  with check (
    customer_id = auth.uid()
    and approval_status = 'pending_review'
    and classes_used = 0
    and approved_at is null
    and approved_by is null
  );
create policy customer_purchases_insert_member on public.customer_purchases for insert
  with check (tenant_id in (select current_user_tenant_ids()));
-- customer_purchases_update_member unchanged, no need to restore

-- ============ service_packages ============
drop policy if exists service_packages_select on public.service_packages;

create policy service_packages_select_member on public.service_packages for select
  using (tenant_id in (select current_user_tenant_ids()));
create policy service_packages_select_public on public.service_packages for select
  using (
    is_active = true
    and tenant_id in (select id from public.tenants where status = 'active')
  );
create policy service_packages_select_admin on public.service_packages for select
  using (is_platform_admin());
-- insert/update/delete unchanged

-- ============ tenant_photos ============
drop policy if exists tenant_photos_select on public.tenant_photos;

create policy tenant_photos_select_public on public.tenant_photos for select
  using (tenant_id in (select id from public.tenants where status = 'active'));
create policy tenant_photos_select_member on public.tenant_photos for select
  using (tenant_id in (select current_user_tenant_ids()));
create policy tenant_photos_select_admin on public.tenant_photos for select
  using (is_platform_admin());
-- insert/update/delete unchanged

commit;
