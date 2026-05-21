-- Fix infinite recursion in tenant_members RLS policies.
--
-- The old `tenant_members_select_owner` policy referenced tenant_members in a
-- subquery, but RLS was applied to that subquery too → 42P17 recursion.
--
-- Solution: use a SECURITY DEFINER helper that bypasses RLS for the lookup.
-- We already have current_user_tenant_ids(); add one for owner-only lookups.

create or replace function public.current_user_owner_tenant_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id from public.tenant_members
  where user_id = auth.uid() and role = 'owner' and status = 'active';
$$;

-- Drop and recreate tenant_members policies using the helper
drop policy if exists tenant_members_select_owner on public.tenant_members;
create policy tenant_members_select_owner on public.tenant_members
  for select using (
    tenant_id in (select current_user_owner_tenant_ids())
  );

drop policy if exists tenant_members_insert_owner on public.tenant_members;
create policy tenant_members_insert_owner on public.tenant_members
  for insert with check (
    tenant_id in (select current_user_owner_tenant_ids())
    and role = 'staff'
  );

drop policy if exists tenant_members_update_owner on public.tenant_members;
create policy tenant_members_update_owner on public.tenant_members
  for update using (
    tenant_id in (select current_user_owner_tenant_ids())
  );

-- tenants_update policy also referenced tenant_members directly; use helper
drop policy if exists tenants_update_admin_or_owner on public.tenants;
create policy tenants_update_admin_or_owner on public.tenants
  for update using (
    is_platform_admin()
    or id in (select current_user_owner_tenant_ids())
  );
