-- Carry purchase_id forward on reschedule (S4: bookings.purchase_id is now NOT NULL).
-- Reschedule does not consume a new class — it just moves the existing booking
-- to a new slot. classes_used stays the same.

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
  v_new_booking public.bookings%rowtype;
  v_is_customer boolean;
  v_is_member boolean;
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
  select id, tenant_id, service_id, status into v_new_slot
  from public.availability_slots where id = p_new_slot_id for update;
  if not found then raise exception 'SLOT_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_new_slot.status <> 'available' then
    raise exception 'SLOT_UNAVAILABLE' using errcode = 'P0001';
  end if;
  -- Must be same tenant (no cross-tenant reschedule)
  if v_new_slot.tenant_id <> v_old.tenant_id then
    raise exception 'CROSS_TENANT' using errcode = 'P0001';
  end if;

  -- Cancel old: booking → cancelled, slot → available
  update public.bookings
  set status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid()
  where id = p_old_booking_id;
  update public.availability_slots set status = 'available' where id = v_old.slot_id;

  -- Mark new slot pending before inserting the booking
  update public.availability_slots set status = 'pending', updated_at = now()
  where id = p_new_slot_id;

  -- Insert new booking, carrying purchase_id forward (no balance change)
  insert into public.bookings (
    tenant_id, slot_id, customer_id, service_id, status, customer_notes, purchase_id
  ) values (
    v_new_slot.tenant_id, p_new_slot_id, v_old.customer_id, v_new_slot.service_id,
    'pending', v_old.customer_notes, v_old.purchase_id
  )
  returning * into v_new_booking;

  return v_new_booking;
end;
$$;

grant execute on function public.reschedule_booking(uuid, uuid) to authenticated;
