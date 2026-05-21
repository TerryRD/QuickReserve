-- services: per-tenant service catalog
create table public.services (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  description text,
  duration_minutes int not null check (duration_minutes > 0),
  price numeric(10, 2),
  is_active boolean not null default true,
  extended_properties jsonb default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_services_tenant on public.services(tenant_id, is_active);
create trigger services_set_updated_at
  before update on public.services
  for each row execute function public.set_updated_at();
