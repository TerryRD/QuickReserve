-- checkin_booking (spec 2026-06-13): student self check-in.
-- Confirmed + within [start-30min, end] + owned by caller -> completed.

create or replace function public.checkin_booking(p_booking_id uuid)
returns table (booking_id uuid, checked_in_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking record;
  v_slot record;
  v_open_from timestamptz;
begin
  select b.id, b.customer_id, b.status, b.checked_in_at, b.slot_id
    into v_booking
    from public.bookings b
    where b.id = p_booking_id
    for update;
  if not found then
    raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- Ownership: authenticated callers may only check in their own booking.
  if auth.role() <> 'service_role' then
    if auth.uid() is null or v_booking.customer_id <> auth.uid() then
      raise exception 'FORBIDDEN' using errcode = '42501';
    end if;
  end if;

  if v_booking.checked_in_at is not null then
    raise exception 'ALREADY_CHECKED_IN' using errcode = 'P0001';
  end if;
  if v_booking.status <> 'confirmed' then
    raise exception 'NOT_CONFIRMED' using errcode = 'P0001';
  end if;

  select s.start_at, s.end_at into v_slot
    from public.availability_slots s
    where s.id = v_booking.slot_id;

  v_open_from := v_slot.start_at - interval '30 minutes';
  if now() < v_open_from then
    raise exception 'CHECKIN_TOO_EARLY' using errcode = 'P0001';
  end if;
  if now() > v_slot.end_at then
    raise exception 'CHECKIN_CLOSED' using errcode = 'P0001';
  end if;

  update public.bookings
    set checked_in_at = now(),
        checked_in_by = coalesce(auth.uid(), v_booking.customer_id),
        status = 'completed',
        updated_at = now()
    where id = p_booking_id
    returning id, bookings.checked_in_at into booking_id, checked_in_at;
  return next;
end;
$$;

grant execute on function public.checkin_booking(uuid) to authenticated;
