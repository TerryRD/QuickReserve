alter table public.services enable row level security;

-- Tenant members read their own services
create policy services_select_member on public.services for select
  using (tenant_id in (select current_user_tenant_ids()));

-- Public can read active services of active tenants (for booking page)
create policy services_select_public on public.services for select
  using (
    is_active = true
    and tenant_id in (select id from public.tenants where status = 'active')
  );

-- Platform admin sees all
create policy services_select_admin on public.services for select using (is_platform_admin());

-- Only owners can write
create policy services_insert_owner on public.services for insert
  with check (tenant_id in (select current_user_owner_tenant_ids()));
create policy services_update_owner on public.services for update
  using (tenant_id in (select current_user_owner_tenant_ids()));
create policy services_delete_owner on public.services for delete
  using (tenant_id in (select current_user_owner_tenant_ids()));
