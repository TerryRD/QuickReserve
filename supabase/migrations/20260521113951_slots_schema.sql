create extension if not exists btree_gist;

create table public.availability_slots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  member_id uuid not null references public.tenant_members(id) on delete cascade,
  service_id uuid not null references public.services(id),
  recurring_rule_id uuid,  -- FK added in Plan 3
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null default 'available'
    check (status in ('available', 'pending', 'booked', 'cancelled')),
  extended_properties jsonb default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_at < end_at)
);

create index idx_slots_tenant_member_start
  on public.availability_slots(tenant_id, member_id, start_at);
create index idx_slots_start_status
  on public.availability_slots(start_at, status);

create trigger slots_set_updated_at
  before update on public.availability_slots
  for each row execute function public.set_updated_at();

-- Same member cannot have overlapping non-cancelled slots
alter table public.availability_slots
  add constraint availability_slots_no_overlap
  exclude using gist (
    member_id with =,
    tstzrange(start_at, end_at) with &&
  ) where (status <> 'cancelled');
