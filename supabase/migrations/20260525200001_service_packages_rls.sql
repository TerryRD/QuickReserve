alter table public.service_packages enable row level security;

-- Tenant members read their own packages
create policy service_packages_select_member on public.service_packages for select
  using (tenant_id in (select current_user_tenant_ids()));

-- Public can read active packages of active tenants (學員瀏覽)
create policy service_packages_select_public on public.service_packages for select
  using (
    is_active = true
    and tenant_id in (select id from public.tenants where status = 'active')
  );

create policy service_packages_select_admin on public.service_packages for select
  using (is_platform_admin());

-- Only tenant owners can write
create policy service_packages_insert_owner on public.service_packages for insert
  with check (tenant_id in (select current_user_owner_tenant_ids()));
create policy service_packages_update_owner on public.service_packages for update
  using (tenant_id in (select current_user_owner_tenant_ids()));
create policy service_packages_delete_owner on public.service_packages for delete
  using (tenant_id in (select current_user_owner_tenant_ids()));
