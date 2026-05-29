-- A-6 group slot lifecycle fix.
-- Spec: docs/superpowers/specs/2026-05-29-group-slot-lifecycle-design.md
--
-- Three RPCs over-set slot.status in ways that break group classes
-- (max_capacity > 1):
--   book_with_purchase     marks 'booked' at min_attendance (not at full)
--   cancel_booking         marks 'available' on every cancel
--   reschedule_booking     same as cancel, plus rejects 'pending' destinations
--
-- Corrected lifecycle:
--   available = 0 active bookings
--   pending   = 1 ≤ count < max_capacity
--   booked    = count ≥ max_capacity
--
-- For 1-on-1 (max=1, min=1) the observable behaviour is unchanged: first
-- booking pushes count to 1 = max, slot jumps straight to 'booked'.

-- ============================================================================
-- book_with_purchase: split auto-confirm and capacity-full into independent checks
-- ============================================================================

create or replace function public.book_with_purchase(
  p_slot_id uuid,
  p_customer_id uuid,
  p_customer_notes text default null,
  p_purchase_id uuid default null
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
  v_purchase_valid boolean;
  v_existing_count int;
  v_new_booking_id uuid;
  v_auto_confirmed boolean := false;
begin
  -- Guard: authenticated callers may only book for themselves.
  if auth.role() <> 'service_role' then
    if auth.uid() is null or p_customer_id <> auth.uid() then
      raise exception 'FORBIDDEN' using errcode = '42501';
    end if;
  end if;

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

  -- 4. Choose purchase
  if p_purchase_id is not null then
    select true into v_purchase_valid
      from public.customer_purchases
      where id = p_purchase_id
        and customer_id = p_customer_id
        and service_id = v_slot.service_id
        and approval_status = 'confirmed'
        and classes_used < classes_total
        and (expires_at is null or expires_at > now())
      for update;
    if v_purchase_valid is null then
      raise exception 'PURCHASE_INVALID' using errcode = 'P0001';
    end if;
    v_purchase_id := p_purchase_id;
  else
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
  end if;

  -- 5. Ensure tenant_customers bridge
  insert into public.tenant_customers (tenant_id, customer_id)
    values (v_slot.tenant_id, p_customer_id)
    on conflict (tenant_id, customer_id) do nothing;

  -- 6. Increment classes_used on chosen purchase
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

  -- 8. Mark slot pending (after first booking; idempotent for groups)
  update public.availability_slots
    set status = 'pending', updated_at = now()
    where id = p_slot_id;

  -- 9a. Auto-confirm all pending bookings once min_attendance is reached
  if v_existing_count + 1 >= v_service.min_attendance then
    update public.bookings
      set status = 'confirmed'
      where slot_id = p_slot_id
        and status = 'pending';
    v_auto_confirmed := true;
  end if;

  -- 9b. Mark slot fully booked only when capacity is filled
  if v_existing_count + 1 >= v_service.max_capacity then
    update public.availability_slots
      set status = 'booked'
      where id = p_slot_id;
  end if;

  booking_id := v_new_booking_id;
  auto_confirmed := v_auto_confirmed;
  return next;
end;
$$;

grant execute on function public.book_with_purchase(uuid, uuid, text, uuid) to authenticated;

-- ============================================================================
-- cancel_booking: rebuild slot status from remaining active bookings
-- ============================================================================

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
  v_remaining int;
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

  -- Refund the purchase's class count
  update public.customer_purchases
    set classes_used = classes_used - 1
    where id = v_booking.purchase_id and classes_used > 0;

  -- Cancel the booking row
  update public.bookings
    set status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid()
    where id = p_booking_id
    returning * into v_booking;

  -- Rebuild slot status from remaining active bookings on the same slot
  select count(*) into v_remaining
    from public.bookings
    where slot_id = v_booking.slot_id and status <> 'cancelled';
  update public.availability_slots
    set status = case when v_remaining = 0 then 'available' else 'pending' end
    where id = v_booking.slot_id;

  return v_booking;
end;
$$;

grant execute on function public.cancel_booking(uuid) to authenticated;

-- ============================================================================
-- reschedule_booking: accept pending destinations, rebuild old slot, apply
-- auto-confirm + capacity-full logic on the new slot
-- ============================================================================

create or replace function public.reschedule_booking(
  p_old_booking_id uuid,
  p_new_slot_id uuid
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old public.bookings%rowtype;
  v_new_slot record;
  v_service record;
  v_new_booking public.bookings%rowtype;
  v_is_customer boolean;
  v_is_member boolean;
  v_remaining_old int;
  v_existing_count int;
begin
  -- Lock old booking
  select * into v_old from public.bookings where id = p_old_booking_id for update;
  if not found then raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0002'; end if;

  -- Caller must be the customer OR a tenant member
  v_is_customer := (v_old.customer_id = auth.uid());
  select exists (
    select 1 from public.tenant_members
    where tenant_id = v_old.tenant_id and user_id = auth.uid() and status = 'active'
  ) into v_is_member;
  if not v_is_customer and not v_is_member then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if v_old.status not in ('pending', 'confirmed') then
    raise exception 'INVALID_STATE' using errcode = 'P0001';
  end if;

  -- Lock new slot
  select id, tenant_id, service_id, status, start_at, end_at
    into v_new_slot
    from public.availability_slots where id = p_new_slot_id for update;
  if not found then raise exception 'SLOT_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_new_slot.status not in ('available', 'pending') then
    raise exception 'SLOT_UNAVAILABLE' using errcode = 'P0001';
  end if;
  if v_new_slot.tenant_id <> v_old.tenant_id then
    raise exception 'CROSS_TENANT' using errcode = 'P0001';
  end if;

  -- Load service for capacity / min_attendance on new slot
  select id, max_capacity, min_attendance
    into v_service
    from public.services
    where id = v_new_slot.service_id;

  -- Capacity check on new slot (count excludes the OLD booking — different slot)
  select count(*) into v_existing_count
    from public.bookings
    where slot_id = p_new_slot_id and status <> 'cancelled';
  if v_existing_count >= v_service.max_capacity then
    raise exception 'SLOT_FULL' using errcode = 'P0001';
  end if;

  -- Cancel old booking row
  update public.bookings
    set status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid()
    where id = p_old_booking_id;

  -- Rebuild old slot's status from remaining active bookings
  select count(*) into v_remaining_old
    from public.bookings
    where slot_id = v_old.slot_id and status <> 'cancelled';
  update public.availability_slots
    set status = case when v_remaining_old = 0 then 'available' else 'pending' end
    where id = v_old.slot_id;

  -- Mark new slot pending (no-op if already pending)
  update public.availability_slots
    set status = 'pending', updated_at = now()
    where id = p_new_slot_id;

  -- Insert new booking, carrying purchase_id forward
  insert into public.bookings (
    tenant_id, slot_id, customer_id, service_id, status, customer_notes, purchase_id
  ) values (
    v_new_slot.tenant_id, p_new_slot_id, v_old.customer_id, v_new_slot.service_id,
    'pending', v_old.customer_notes, v_old.purchase_id
  )
  returning * into v_new_booking;

  -- Auto-confirm all pending bookings in the new slot if min_attendance reached.
  -- `returning into` would error if multiple rows are updated, so refetch the
  -- newly-inserted booking after the bulk confirm.
  if v_existing_count + 1 >= v_service.min_attendance then
    update public.bookings
      set status = 'confirmed'
      where slot_id = p_new_slot_id
        and status = 'pending';
    select * into v_new_booking
      from public.bookings
      where id = v_new_booking.id;
  end if;

  -- Mark new slot fully booked only when capacity is filled
  if v_existing_count + 1 >= v_service.max_capacity then
    update public.availability_slots
      set status = 'booked'
      where id = p_new_slot_id;
  end if;

  return v_new_booking;
end;
$$;

grant execute on function public.reschedule_booking(uuid, uuid) to authenticated;
