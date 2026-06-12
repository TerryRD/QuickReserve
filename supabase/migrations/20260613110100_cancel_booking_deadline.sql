-- Cancel-deadline refund (spec 2026-06-13): customer cancels refund ONLY within
-- the service's cancel_deadline_hours; staff/admin cancels always refund. Late
-- customer cancels still cancel the booking + free the slot, but forfeit the class.
-- Also block re-cancelling terminal states incl. the new 'no_show'.

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
  v_is_admin boolean;
  v_remaining int;
  v_slot record;
  v_refund boolean;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0002'; end if;

  v_is_customer := (v_booking.customer_id = auth.uid());
  select exists (
    select 1 from public.tenant_members
    where tenant_id = v_booking.tenant_id and user_id = auth.uid() and status = 'active'
  ) into v_is_member;
  v_is_admin := public.is_platform_admin();
  if not v_is_customer and not v_is_member and not v_is_admin then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if v_booking.status in ('cancelled', 'completed', 'no_show') then
    raise exception 'INVALID_STATE' using errcode = 'P0001';
  end if;

  -- Refund eligibility: staff/admin always refund; customer only within deadline.
  if v_is_member or v_is_admin then
    v_refund := true;
  else
    select s.start_at as start_at, sv.cancel_deadline_hours as deadline_hours
      into v_slot
      from public.availability_slots s
      join public.services sv on sv.id = s.service_id
      where s.id = v_booking.slot_id;
    v_refund := now() <= v_slot.start_at - (v_slot.deadline_hours || ' hours')::interval;
  end if;

  if v_refund then
    update public.customer_purchases
      set classes_used = classes_used - 1
      where id = v_booking.purchase_id and classes_used > 0;
  end if;

  update public.bookings
    set status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid()
    where id = p_booking_id
    returning * into v_booking;

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
