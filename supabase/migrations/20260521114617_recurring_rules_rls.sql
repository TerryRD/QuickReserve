alter table public.recurring_rules enable row level security;

create policy recurring_rules_select_member on public.recurring_rules for select
  using (tenant_id in (select current_user_tenant_ids()));

create policy recurring_rules_select_admin on public.recurring_rules for select using (is_platform_admin());

-- Members can write rules for themselves; owners can write for any member of their tenant
create policy recurring_rules_insert_self on public.recurring_rules for insert
  with check (
    tenant_id in (select current_user_tenant_ids())
    and member_id in (
      select id from public.tenant_members
      where user_id = auth.uid() and status = 'active'
    )
  );

create policy recurring_rules_insert_owner on public.recurring_rules for insert
  with check (tenant_id in (select current_user_owner_tenant_ids()));

create policy recurring_rules_update_self on public.recurring_rules for update
  using (
    member_id in (
      select id from public.tenant_members
      where user_id = auth.uid() and status = 'active'
    )
  );

create policy recurring_rules_update_owner on public.recurring_rules for update
  using (tenant_id in (select current_user_owner_tenant_ids()));

create policy recurring_rules_delete_self on public.recurring_rules for delete
  using (
    member_id in (
      select id from public.tenant_members
      where user_id = auth.uid() and status = 'active'
    )
  );

create policy recurring_rules_delete_owner on public.recurring_rules for delete
  using (tenant_id in (select current_user_owner_tenant_ids()));
