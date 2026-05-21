-- 0002 identity RLS
-- Enable Row Level Security on all identity tables and apply isolation policies.

-- Helper: is the calling user a platform admin?
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.platform_admins where user_id = auth.uid()
  );
$$;

-- Helper: does the calling user belong to a tenant (any role, active)?
create or replace function public.current_user_tenant_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id from public.tenant_members
  where user_id = auth.uid() and status = 'active';
$$;

-- ============ tenants ============
alter table public.tenants enable row level security;

create policy tenants_select_member on public.tenants
  for select using (
    is_platform_admin()
    or id in (select current_user_tenant_ids())
    or status = 'active'  -- public tenant page allowed when active
  );

create policy tenants_insert_admin on public.tenants
  for insert with check (is_platform_admin());

create policy tenants_update_admin_or_owner on public.tenants
  for update using (
    is_platform_admin()
    or id in (
      select tenant_id from public.tenant_members
      where user_id = auth.uid() and role = 'owner' and status = 'active'
    )
  );

-- ============ tenant_members ============
alter table public.tenant_members enable row level security;

-- Self can always read own row (needed for the helper functions to bootstrap)
create policy tenant_members_select_self on public.tenant_members
  for select using (user_id = auth.uid());

-- Owners see all members of their tenant
create policy tenant_members_select_owner on public.tenant_members
  for select using (
    tenant_id in (
      select tenant_id from public.tenant_members
      where user_id = auth.uid() and role = 'owner' and status = 'active'
    )
  );

create policy tenant_members_select_admin on public.tenant_members
  for select using (is_platform_admin());

-- Only owners can invite (insert) staff into their own tenant
create policy tenant_members_insert_owner on public.tenant_members
  for insert with check (
    tenant_id in (
      select tenant_id from public.tenant_members
      where user_id = auth.uid() and role = 'owner' and status = 'active'
    )
    and role = 'staff'
  );

-- Platform admin can insert any role (used by invite-coach flow)
create policy tenant_members_insert_admin on public.tenant_members
  for insert with check (is_platform_admin());

-- Self can update own row (used when accepting invitation)
create policy tenant_members_update_self on public.tenant_members
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy tenant_members_update_owner on public.tenant_members
  for update using (
    tenant_id in (
      select tenant_id from public.tenant_members
      where user_id = auth.uid() and role = 'owner' and status = 'active'
    )
  );

-- ============ platform_admins ============
alter table public.platform_admins enable row level security;

create policy platform_admins_select_self on public.platform_admins
  for select using (user_id = auth.uid() or is_platform_admin());

-- Inserts/updates/deletes only via service_role (no policy = no client write)

-- ============ customers ============
alter table public.customers enable row level security;

create policy customers_select_self on public.customers
  for select using (id = auth.uid());

create policy customers_select_tenant_member on public.customers
  for select using (
    id in (
      select customer_id from public.tenant_customers
      where tenant_id in (select current_user_tenant_ids())
    )
  );

create policy customers_select_admin on public.customers
  for select using (is_platform_admin());

create policy customers_upsert_self on public.customers
  for insert with check (id = auth.uid());

create policy customers_update_self on public.customers
  for update using (id = auth.uid());

-- ============ tenant_customers ============
alter table public.tenant_customers enable row level security;

create policy tenant_customers_select_member on public.tenant_customers
  for select using (
    tenant_id in (select current_user_tenant_ids())
    or customer_id = auth.uid()
    or is_platform_admin()
  );

create policy tenant_customers_insert_member on public.tenant_customers
  for insert with check (
    tenant_id in (select current_user_tenant_ids())
    or customer_id = auth.uid()
  );

create policy tenant_customers_update_member on public.tenant_customers
  for update using (
    tenant_id in (select current_user_tenant_ids())
    or is_platform_admin()
  );
