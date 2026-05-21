-- 0001 identity schema
-- Multi-tenant identity tables: tenants, tenant_members, platform_admins, customers, tenant_customers
-- RLS policies are applied in 0002_identity_rls.sql.

create extension if not exists "pgcrypto";

-- tenants: each coach is a tenant
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  avatar_url text,
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_tenants_slug on public.tenants(slug);

-- tenant_members: Owner + Staff within a tenant
create table public.tenant_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'staff')),
  parent_member_id uuid references public.tenant_members(id),
  status text not null default 'active' check (status in ('active', 'invited', 'removed')),
  invited_email text,
  invite_token text unique,
  invite_expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);
create index idx_tenant_members_user on public.tenant_members(user_id);
create index idx_tenant_members_tenant on public.tenant_members(tenant_id);
create index idx_tenant_members_invite_token on public.tenant_members(invite_token) where invite_token is not null;

-- platform_admins: platform-level operators
create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- customers: end users (students) who book
create table public.customers (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  phone text,
  created_at timestamptz not null default now()
);

-- tenant_customers: bridge for cross-tenant isolation
create table public.tenant_customers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  tenant_notes text,
  created_at timestamptz not null default now(),
  unique (tenant_id, customer_id)
);

-- Helper: updated_at trigger function
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tenants_set_updated_at
  before update on public.tenants
  for each row execute function public.set_updated_at();
