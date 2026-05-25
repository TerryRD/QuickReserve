alter table public.unavailable_events enable row level security;

-- Member can read/write own; tenant owners read/write any in their tenant
create policy events_select_member on public.unavailable_events for select
  using (
    member_id in (
      select id from public.tenant_members
      where user_id = auth.uid() and status = 'active'
    )
  );

create policy events_select_owner on public.unavailable_events for select
  using (
    member_id in (
      select id from public.tenant_members
      where tenant_id in (select current_user_owner_tenant_ids())
    )
  );

create policy events_select_admin on public.unavailable_events for select
  using (is_platform_admin());

create policy events_modify_member on public.unavailable_events for all
  using (
    member_id in (
      select id from public.tenant_members
      where user_id = auth.uid() and status = 'active'
    )
  )
  with check (
    member_id in (
      select id from public.tenant_members
      where user_id = auth.uid() and status = 'active'
    )
  );

create policy events_modify_owner on public.unavailable_events for all
  using (
    member_id in (
      select id from public.tenant_members
      where tenant_id in (select current_user_owner_tenant_ids())
    )
  )
  with check (
    member_id in (
      select id from public.tenant_members
      where tenant_id in (select current_user_owner_tenant_ids())
    )
  );
