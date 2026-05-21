-- book_slot_atomic: atomic booking creation
--
-- Locks the slot row, validates it's available, sets it to pending,
-- and inserts a booking. All within a single transaction.
-- Returns the new booking row, or raises an exception on failure.

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
begin
  -- Lock the slot for this transaction
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

  -- Make sure the customer exists in customers table (idempotent)
  insert into public.customers (id, display_name)
  values (p_customer_id, null)
  on conflict (id) do nothing;

  -- Ensure tenant_customers bridge exists
  insert into public.tenant_customers (tenant_id, customer_id)
  values (v_slot.tenant_id, p_customer_id)
  on conflict (tenant_id, customer_id) do nothing;

  -- Lock the slot to pending
  update public.availability_slots
  set status = 'pending', updated_at = now()
  where id = p_slot_id;

  -- Create the booking
  insert into public.bookings (
    tenant_id, slot_id, customer_id, service_id, status, customer_notes
  ) values (
    v_slot.tenant_id, p_slot_id, p_customer_id, v_slot.service_id, 'pending', p_customer_notes
  )
  returning * into v_booking;

  return v_booking;
end;
$$;

-- Allow authenticated users to call this RPC
grant execute on function public.book_slot_atomic(uuid, uuid, text) to authenticated;

-- ──────────────────────────────────────────────────
-- Companion: state-changing functions for confirm / cancel
-- ──────────────────────────────────────────────────

-- Coach confirms a pending booking: booking → confirmed, slot → booked
create or replace function public.confirm_booking(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
  v_is_member boolean;
begin
  -- Lock booking
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0002'; end if;

  -- Verify caller is a member of the tenant
  select exists (
    select 1 from public.tenant_members
    where tenant_id = v_booking.tenant_id and user_id = auth.uid() and status = 'active'
  ) into v_is_member;
  if not v_is_member and not public.is_platform_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if v_booking.status <> 'pending' then
    raise exception 'INVALID_STATE' using errcode = 'P0001';
  end if;

  update public.bookings set status = 'confirmed' where id = p_booking_id returning * into v_booking;
  update public.availability_slots set status = 'booked' where id = v_booking.slot_id;
  return v_booking;
end;
$$;
grant execute on function public.confirm_booking(uuid) to authenticated;

-- Cancel a booking: booking → cancelled, slot → available again (release)
create or replace function public.cancel_booking(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
  v_is_customer boolean;
  v_is_member boolean;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0002'; end if;

  -- Caller must be the customer OR a tenant member OR a platform admin
  v_is_customer := (v_booking.customer_id = auth.uid());
  select exists (
    select 1 from public.tenant_members
    where tenant_id = v_booking.tenant_id and user_id = auth.uid() and status = 'active'
  ) into v_is_member;
  if not v_is_customer and not v_is_member and not public.is_platform_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if v_booking.status in ('cancelled', 'completed') then
    raise exception 'INVALID_STATE' using errcode = 'P0001';
  end if;

  update public.bookings
    set status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid()
    where id = p_booking_id
    returning * into v_booking;
  update public.availability_slots set status = 'available' where id = v_booking.slot_id;
  return v_booking;
end;
$$;
grant execute on function public.cancel_booking(uuid) to authenticated;
