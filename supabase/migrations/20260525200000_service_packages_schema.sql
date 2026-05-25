-- service_packages: per-service N-class bundles defined by coach
create table public.service_packages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  name text not null,
  class_count int not null check (class_count >= 1),
  price numeric(10, 2) not null check (price >= 0),
  expires_in_days int check (expires_in_days is null or expires_in_days > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_service_packages_service on public.service_packages(service_id, is_active);

create trigger service_packages_set_updated_at
  before update on public.service_packages
  for each row execute function public.set_updated_at();
