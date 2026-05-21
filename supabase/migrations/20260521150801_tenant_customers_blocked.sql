-- Add is_blocked to tenant_customers — tenant can ban a customer from booking
alter table public.tenant_customers
  add column if not exists is_blocked boolean not null default false;

-- Update book_slot_atomic to reject blocked customers
create or replace function public.book_slot_atomic(
  p_slot_id uuid,
  p_customer_id uuid,
  p_customer_notes text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot record;
  v_booking public.bookings%rowtype;
  v_blocked boolean;
begin
  select id, tenant_id, service_id, status, start_at, end_at
  into v_slot
  from public.availability_slots
  where id = p_slot_id
  for update;

  if not found then
    raise exception 'SLOT_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_slot.status <> 'available' then
    raise exception 'SLOT_UNAVAILABLE' using errcode = 'P0001';
  end if;

  -- Check if customer is blocked by this tenant
  select is_blocked into v_blocked
  from public.tenant_customers
  where tenant_id = v_slot.tenant_id and customer_id = p_customer_id;

  if v_blocked then
    raise exception 'CUSTOMER_BLOCKED' using errcode = 'P0001';
  end if;

  -- Ensure customer + bridge exist
  insert into public.customers (id, display_name)
  values (p_customer_id, null)
  on conflict (id) do nothing;

  insert into public.tenant_customers (tenant_id, customer_id)
  values (v_slot.tenant_id, p_customer_id)
  on conflict (tenant_id, customer_id) do nothing;

  -- Lock slot to pending
  update public.availability_slots
  set status = 'pending', updated_at = now()
  where id = p_slot_id;

  -- Create booking
  insert into public.bookings (
    tenant_id, slot_id, customer_id, service_id, status, customer_notes
  ) values (
    v_slot.tenant_id, p_slot_id, p_customer_id, v_slot.service_id, 'pending', p_customer_notes
  )
  returning * into v_booking;

  return v_booking;
end;
$$;
