create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  slot_id uuid not null references public.availability_slots(id),
  customer_id uuid not null references public.customers(id),
  service_id uuid not null references public.services(id),
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'completed', 'cancelled')),
  customer_notes text,
  tenant_notes text,
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users(id),
  extended_properties jsonb default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_bookings_tenant_status on public.bookings(tenant_id, status);
create index idx_bookings_customer on public.bookings(customer_id, status);
create index idx_bookings_slot on public.bookings(slot_id);
create trigger bookings_set_updated_at
  before update on public.bookings
  for each row execute function public.set_updated_at();

-- A slot can have at most one non-cancelled booking
create unique index bookings_slot_unique_active
  on public.bookings(slot_id)
  where status <> 'cancelled';
