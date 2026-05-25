alter table public.availability_templates enable row level security;
alter table public.availability_template_windows enable row level security;
alter table public.availability_template_assignments enable row level security;

-- templates: member can CRUD own; tenant owner can CRUD any in their tenant
create policy templates_select_member on public.availability_templates for select
  using (
    member_id in (
      select id from public.tenant_members
      where user_id = auth.uid() and status = 'active'
    )
  );

create policy templates_select_owner on public.availability_templates for select
  using (
    member_id in (
      select id from public.tenant_members
      where tenant_id in (select current_user_owner_tenant_ids())
    )
  );

create policy templates_select_admin on public.availability_templates for select
  using (is_platform_admin());

create policy templates_modify_member on public.availability_templates for all
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

create policy templates_modify_owner on public.availability_templates for all
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

-- template_windows: follow parent template
create policy template_windows_select on public.availability_template_windows for select
  using (
    template_id in (
      select id from public.availability_templates
    )
  );

create policy template_windows_modify_member on public.availability_template_windows for all
  using (
    template_id in (
      select id from public.availability_templates
      where member_id in (
        select id from public.tenant_members
        where user_id = auth.uid() and status = 'active'
      )
    )
  )
  with check (
    template_id in (
      select id from public.availability_templates
      where member_id in (
        select id from public.tenant_members
        where user_id = auth.uid() and status = 'active'
      )
    )
  );

create policy template_windows_modify_owner on public.availability_template_windows for all
  using (
    template_id in (
      select id from public.availability_templates
      where member_id in (
        select id from public.tenant_members
        where tenant_id in (select current_user_owner_tenant_ids())
      )
    )
  )
  with check (
    template_id in (
      select id from public.availability_templates
      where member_id in (
        select id from public.tenant_members
        where tenant_id in (select current_user_owner_tenant_ids())
      )
    )
  );

-- assignments: same pattern (member or owner of their tenant)
create policy assignments_select_member on public.availability_template_assignments for select
  using (
    member_id in (
      select id from public.tenant_members
      where user_id = auth.uid() and status = 'active'
    )
  );

create policy assignments_select_owner on public.availability_template_assignments for select
  using (
    member_id in (
      select id from public.tenant_members
      where tenant_id in (select current_user_owner_tenant_ids())
    )
  );

create policy assignments_select_admin on public.availability_template_assignments for select
  using (is_platform_admin());

create policy assignments_modify_member on public.availability_template_assignments for all
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

create policy assignments_modify_owner on public.availability_template_assignments for all
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
