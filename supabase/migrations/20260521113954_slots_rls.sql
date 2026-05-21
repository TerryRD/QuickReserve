alter table public.availability_slots enable row level security;

create policy slots_select_member on public.availability_slots for select
  using (tenant_id in (select current_user_tenant_ids()));

create policy slots_select_public on public.availability_slots for select
  using (
    status = 'available'
    and tenant_id in (select id from public.tenants where status = 'active')
  );

create policy slots_select_admin on public.availability_slots for select using (is_platform_admin());

create policy slots_insert_self on public.availability_slots for insert
  with check (
    tenant_id in (select current_user_tenant_ids())
    and member_id in (
      select id from public.tenant_members
      where user_id = auth.uid() and status = 'active'
    )
  );

create policy slots_insert_owner on public.availability_slots for insert
  with check (
    tenant_id in (select current_user_owner_tenant_ids())
  );

create policy slots_update_self on public.availability_slots for update
  using (
    member_id in (
      select id from public.tenant_members
      where user_id = auth.uid() and status = 'active'
    )
  );

create policy slots_update_owner on public.availability_slots for update
  using (tenant_id in (select current_user_owner_tenant_ids()));

create policy slots_delete_self on public.availability_slots for delete
  using (
    member_id in (
      select id from public.tenant_members
      where user_id = auth.uid() and status = 'active'
    )
  );

create policy slots_delete_owner on public.availability_slots for delete
  using (tenant_id in (select current_user_owner_tenant_ids()));
