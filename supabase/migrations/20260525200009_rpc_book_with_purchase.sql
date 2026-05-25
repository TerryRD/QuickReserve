-- book_with_purchase: replaces book_slot_atomic
--
-- Atomically:
--   1. Lock the slot row (FOR UPDATE) to serialize concurrent booking attempts
--   2. Verify slot is bookable (status='available' or 'pending' for groups)
--   3. Verify capacity not exceeded
--   4. Pick oldest-expiring active purchase for this (customer, service)
--   5. Increment classes_used on that purchase
--   6. Insert the booking with purchase_id
--   7. If post-insert count >= min_attendance: bulk confirm all bookings in slot
--   8. Return booking + auto_confirmed flag

create or replace function public.book_with_purchase(
  p_slot_id uuid,
  p_customer_id uuid,
  p_customer_notes text default null
)
returns table (
  booking_id uuid,
  auto_confirmed boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot record;
  v_service record;
  v_purchase_id uuid;
  v_existing_count int;
  v_new_booking_id uuid;
  v_auto_confirmed boolean := false;
begin
  -- 1. Lock slot
  select id, tenant_id, service_id, status, start_at, end_at
    into v_slot
    from public.availability_slots
    where id = p_slot_id
    for update;
  if not found then
    raise exception 'SLOT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_slot.status not in ('available', 'pending') then
    raise exception 'SLOT_UNAVAILABLE' using errcode = 'P0001';
  end if;
  if v_slot.start_at <= now() then
    raise exception 'SLOT_PAST' using errcode = 'P0001';
  end if;

  -- 2. Load service capacity / min
  select id, max_capacity, min_attendance
    into v_service
    from public.services
    where id = v_slot.service_id;

  -- 3. Capacity check
  select count(*) into v_existing_count
    from public.bookings
    where slot_id = p_slot_id and status <> 'cancelled';
  if v_existing_count >= v_service.max_capacity then
    raise exception 'SLOT_FULL' using errcode = 'P0001';
  end if;

  -- 4. Pick oldest-expiring active purchase (skip NULL expires_at first,
  --    they're permanent — use them after dated ones)
  select id into v_purchase_id
    from public.customer_purchases
    where customer_id = p_customer_id
      and service_id = v_slot.service_id
      and approval_status = 'confirmed'
      and classes_used < classes_total
      and (expires_at is null or expires_at > now())
    order by
      case when expires_at is null then 1 else 0 end,
      expires_at asc nulls last,
      approved_at asc
    limit 1
    for update;
  if v_purchase_id is null then
    raise exception 'NO_BALANCE' using errcode = 'P0001';
  end if;

  -- 5. Ensure tenant_customers bridge
  insert into public.tenant_customers (tenant_id, customer_id)
    values (v_slot.tenant_id, p_customer_id)
    on conflict (tenant_id, customer_id) do nothing;

  -- 6. Increment classes_used
  update public.customer_purchases
    set classes_used = classes_used + 1
    where id = v_purchase_id;

  -- 7. Insert booking
  insert into public.bookings (
    tenant_id, slot_id, customer_id, service_id, status,
    customer_notes, purchase_id
  ) values (
    v_slot.tenant_id, p_slot_id, p_customer_id, v_slot.service_id, 'pending',
    p_customer_notes, v_purchase_id
  )
  returning id into v_new_booking_id;

  -- 8. Update slot status: pending if first, stays pending for group
  update public.availability_slots
    set status = 'pending', updated_at = now()
    where id = p_slot_id;

  -- 9. Auto-confirm if reached min_attendance
  if v_existing_count + 1 >= v_service.min_attendance then
    update public.bookings
      set status = 'confirmed'
      where slot_id = p_slot_id
        and status = 'pending';
    update public.availability_slots
      set status = 'booked'
      where id = p_slot_id;
    v_auto_confirmed := true;
  end if;

  booking_id := v_new_booking_id;
  auto_confirmed := v_auto_confirmed;
  return next;
end;
$$;

grant execute on function public.book_with_purchase(uuid, uuid, text) to authenticated;
