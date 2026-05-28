-- Combine multiple PERMISSIVE policies + wrap auth.uid() in subselect.
-- Closes Supabase advisor lints 0003 (auth_rls_initplan, 10 instances) and
-- 0006 (multiple_permissive_policies, 120 instances) for 7 tables. Permission
-- semantics unchanged — verified by tests/integration/rls-rewrite-matrix.test.ts.
--
-- Rollback file: docs/superpowers/specs/2026-05-28-rls-rewrite-rollback.sql

begin;

-- ============ availability_templates ============
drop policy if exists templates_select_member on public.availability_templates;
drop policy if exists templates_select_owner  on public.availability_templates;
drop policy if exists templates_select_admin  on public.availability_templates;
drop policy if exists templates_modify_member on public.availability_templates;
drop policy if exists templates_modify_owner  on public.availability_templates;

create policy templates_select on public.availability_templates for select to authenticated
  using (
    is_platform_admin()
    OR member_id in (
      select id from public.tenant_members
      where user_id = (select auth.uid()) and status = 'active'
    )
    OR member_id in (
      select id from public.tenant_members
      where tenant_id in (select current_user_owner_tenant_ids())
    )
  );

create policy templates_insert on public.availability_templates for insert to authenticated
  with check (
    is_platform_admin()
    OR member_id in (
      select id from public.tenant_members
      where user_id = (select auth.uid()) and status = 'active'
    )
    OR member_id in (
      select id from public.tenant_members
      where tenant_id in (select current_user_owner_tenant_ids())
    )
  );

create policy templates_update on public.availability_templates for update to authenticated
  using (
    is_platform_admin()
    OR member_id in (
      select id from public.tenant_members
      where user_id = (select auth.uid()) and status = 'active'
    )
    OR member_id in (
      select id from public.tenant_members
      where tenant_id in (select current_user_owner_tenant_ids())
    )
  )
  with check (
    is_platform_admin()
    OR member_id in (
      select id from public.tenant_members
      where user_id = (select auth.uid()) and status = 'active'
    )
    OR member_id in (
      select id from public.tenant_members
      where tenant_id in (select current_user_owner_tenant_ids())
    )
  );

create policy templates_delete on public.availability_templates for delete to authenticated
  using (
    is_platform_admin()
    OR member_id in (
      select id from public.tenant_members
      where user_id = (select auth.uid()) and status = 'active'
    )
    OR member_id in (
      select id from public.tenant_members
      where tenant_id in (select current_user_owner_tenant_ids())
    )
  );

-- ============ availability_template_windows (predicate via parent template's member_id) ============
-- Note: migration 20260525100004_template_windows_rls_explicit.sql split the
-- original `template_windows_select` into three policies (_member/_owner/_admin),
-- so we must drop all five legacy names to cover both pre- and post-explicit state.
drop policy if exists template_windows_select         on public.availability_template_windows;
drop policy if exists template_windows_select_member  on public.availability_template_windows;
drop policy if exists template_windows_select_owner   on public.availability_template_windows;
drop policy if exists template_windows_select_admin   on public.availability_template_windows;
drop policy if exists template_windows_modify_member  on public.availability_template_windows;
drop policy if exists template_windows_modify_owner   on public.availability_template_windows;

create policy template_windows_select on public.availability_template_windows for select to authenticated
  using (
    is_platform_admin()
    OR template_id in (
      select id from public.availability_templates
      where member_id in (
        select id from public.tenant_members
        where user_id = (select auth.uid()) and status = 'active'
      )
    )
    OR template_id in (
      select id from public.availability_templates
      where member_id in (
        select id from public.tenant_members
        where tenant_id in (select current_user_owner_tenant_ids())
      )
    )
  );

create policy template_windows_insert on public.availability_template_windows for insert to authenticated
  with check (
    is_platform_admin()
    OR template_id in (
      select id from public.availability_templates
      where member_id in (
        select id from public.tenant_members
        where user_id = (select auth.uid()) and status = 'active'
      )
    )
    OR template_id in (
      select id from public.availability_templates
      where member_id in (
        select id from public.tenant_members
        where tenant_id in (select current_user_owner_tenant_ids())
      )
    )
  );

create policy template_windows_update on public.availability_template_windows for update to authenticated
  using (
    is_platform_admin()
    OR template_id in (
      select id from public.availability_templates
      where member_id in (
        select id from public.tenant_members
        where user_id = (select auth.uid()) and status = 'active'
      )
    )
    OR template_id in (
      select id from public.availability_templates
      where member_id in (
        select id from public.tenant_members
        where tenant_id in (select current_user_owner_tenant_ids())
      )
    )
  )
  with check (
    is_platform_admin()
    OR template_id in (
      select id from public.availability_templates
      where member_id in (
        select id from public.tenant_members
        where user_id = (select auth.uid()) and status = 'active'
      )
    )
    OR template_id in (
      select id from public.availability_templates
      where member_id in (
        select id from public.tenant_members
        where tenant_id in (select current_user_owner_tenant_ids())
      )
    )
  );

create policy template_windows_delete on public.availability_template_windows for delete to authenticated
  using (
    is_platform_admin()
    OR template_id in (
      select id from public.availability_templates
      where member_id in (
        select id from public.tenant_members
        where user_id = (select auth.uid()) and status = 'active'
      )
    )
    OR template_id in (
      select id from public.availability_templates
      where member_id in (
        select id from public.tenant_members
        where tenant_id in (select current_user_owner_tenant_ids())
      )
    )
  );

-- ============ availability_template_assignments ============
drop policy if exists assignments_select_member on public.availability_template_assignments;
drop policy if exists assignments_select_owner  on public.availability_template_assignments;
drop policy if exists assignments_select_admin  on public.availability_template_assignments;
drop policy if exists assignments_modify_member on public.availability_template_assignments;
drop policy if exists assignments_modify_owner  on public.availability_template_assignments;

create policy assignments_select on public.availability_template_assignments for select to authenticated
  using (
    is_platform_admin()
    OR member_id in (
      select id from public.tenant_members
      where user_id = (select auth.uid()) and status = 'active'
    )
    OR member_id in (
      select id from public.tenant_members
      where tenant_id in (select current_user_owner_tenant_ids())
    )
  );

create policy assignments_insert on public.availability_template_assignments for insert to authenticated
  with check (
    is_platform_admin()
    OR member_id in (
      select id from public.tenant_members
      where user_id = (select auth.uid()) and status = 'active'
    )
    OR member_id in (
      select id from public.tenant_members
      where tenant_id in (select current_user_owner_tenant_ids())
    )
  );

create policy assignments_update on public.availability_template_assignments for update to authenticated
  using (
    is_platform_admin()
    OR member_id in (
      select id from public.tenant_members
      where user_id = (select auth.uid()) and status = 'active'
    )
    OR member_id in (
      select id from public.tenant_members
      where tenant_id in (select current_user_owner_tenant_ids())
    )
  )
  with check (
    is_platform_admin()
    OR member_id in (
      select id from public.tenant_members
      where user_id = (select auth.uid()) and status = 'active'
    )
    OR member_id in (
      select id from public.tenant_members
      where tenant_id in (select current_user_owner_tenant_ids())
    )
  );

create policy assignments_delete on public.availability_template_assignments for delete to authenticated
  using (
    is_platform_admin()
    OR member_id in (
      select id from public.tenant_members
      where user_id = (select auth.uid()) and status = 'active'
    )
    OR member_id in (
      select id from public.tenant_members
      where tenant_id in (select current_user_owner_tenant_ids())
    )
  );

-- ============ unavailable_events ============
drop policy if exists events_select_member on public.unavailable_events;
drop policy if exists events_select_owner  on public.unavailable_events;
drop policy if exists events_select_admin  on public.unavailable_events;
drop policy if exists events_modify_member on public.unavailable_events;
drop policy if exists events_modify_owner  on public.unavailable_events;

create policy events_select on public.unavailable_events for select to authenticated
  using (
    is_platform_admin()
    OR member_id in (
      select id from public.tenant_members
      where user_id = (select auth.uid()) and status = 'active'
    )
    OR member_id in (
      select id from public.tenant_members
      where tenant_id in (select current_user_owner_tenant_ids())
    )
  );

create policy events_insert on public.unavailable_events for insert to authenticated
  with check (
    is_platform_admin()
    OR member_id in (
      select id from public.tenant_members
      where user_id = (select auth.uid()) and status = 'active'
    )
    OR member_id in (
      select id from public.tenant_members
      where tenant_id in (select current_user_owner_tenant_ids())
    )
  );

create policy events_update on public.unavailable_events for update to authenticated
  using (
    is_platform_admin()
    OR member_id in (
      select id from public.tenant_members
      where user_id = (select auth.uid()) and status = 'active'
    )
    OR member_id in (
      select id from public.tenant_members
      where tenant_id in (select current_user_owner_tenant_ids())
    )
  )
  with check (
    is_platform_admin()
    OR member_id in (
      select id from public.tenant_members
      where user_id = (select auth.uid()) and status = 'active'
    )
    OR member_id in (
      select id from public.tenant_members
      where tenant_id in (select current_user_owner_tenant_ids())
    )
  );

create policy events_delete on public.unavailable_events for delete to authenticated
  using (
    is_platform_admin()
    OR member_id in (
      select id from public.tenant_members
      where user_id = (select auth.uid()) and status = 'active'
    )
    OR member_id in (
      select id from public.tenant_members
      where tenant_id in (select current_user_owner_tenant_ids())
    )
  );

-- ============ customer_purchases ============
drop policy if exists customer_purchases_select_customer on public.customer_purchases;
drop policy if exists customer_purchases_select_member   on public.customer_purchases;
drop policy if exists customer_purchases_select_admin    on public.customer_purchases;
drop policy if exists customer_purchases_insert_customer on public.customer_purchases;
drop policy if exists customer_purchases_insert_member   on public.customer_purchases;

create policy customer_purchases_select on public.customer_purchases for select to authenticated
  using (
    is_platform_admin()
    OR customer_id = (select auth.uid())
    OR tenant_id in (select current_user_tenant_ids())
  );

create policy customer_purchases_insert on public.customer_purchases for insert to authenticated
  with check (
    tenant_id in (select current_user_tenant_ids())
    OR (
      customer_id = (select auth.uid())
      AND approval_status = 'pending_review'
      AND classes_used = 0
      AND approved_at is null
      AND approved_by is null
    )
  );

-- customer_purchases_update_member unchanged

-- ============ service_packages ============
drop policy if exists service_packages_select_member on public.service_packages;
drop policy if exists service_packages_select_public on public.service_packages;
drop policy if exists service_packages_select_admin  on public.service_packages;

create policy service_packages_select on public.service_packages for select
  using (
    is_platform_admin()
    OR tenant_id in (select current_user_tenant_ids())
    OR (
      is_active = true
      and tenant_id in (select id from public.tenants where status = 'active')
    )
  );

-- service_packages insert/update/delete unchanged (owner-only, single policy each)

-- ============ tenant_photos ============
drop policy if exists tenant_photos_select_public on public.tenant_photos;
drop policy if exists tenant_photos_select_member on public.tenant_photos;
drop policy if exists tenant_photos_select_admin  on public.tenant_photos;

create policy tenant_photos_select on public.tenant_photos for select
  using (
    is_platform_admin()
    OR tenant_id in (select current_user_tenant_ids())
    OR tenant_id in (select id from public.tenants where status = 'active')
  );

-- tenant_photos insert/update/delete unchanged (owner-only)

commit;
