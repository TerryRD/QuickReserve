-- S4: cancel_booking now refunds classes_used on the booking's purchase.
-- Without this, a student/coach cancellation silently eats one class.

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

  -- Refund the purchase's class count (S4)
  update public.customer_purchases
    set classes_used = classes_used - 1
    where id = v_booking.purchase_id and classes_used > 0;

  update public.bookings
    set status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid()
    where id = p_booking_id
    returning * into v_booking;
  update public.availability_slots set status = 'available' where id = v_booking.slot_id;
  return v_booking;
end;
$$;

grant execute on function public.cancel_booking(uuid) to authenticated;
