-- auto_cancel_group_slot: invoked by cron when a group slot fails to reach
-- min_attendance by the cancel deadline. Cancels slot, all bookings, refunds
-- classes_used on each purchase. Returns list of affected (customer_id, member_user_id)
-- so the cron can fan out push notifications.

create or replace function public.auto_cancel_group_slot(p_slot_id uuid)
returns table (
  affected_customer_id uuid,
  affected_member_user_id uuid,
  service_name text,
  slot_start_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot record;
  v_service_name text;
  v_member_user_id uuid;
begin
  -- Lock slot
  select id, tenant_id, service_id, member_id, start_at
    into v_slot
    from public.availability_slots
    where id = p_slot_id
    for update;
  if not found then
    raise exception 'SLOT_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- Look up service name + member user_id (for notify)
  select name into v_service_name from public.services where id = v_slot.service_id;
  select user_id into v_member_user_id from public.tenant_members where id = v_slot.member_id;

  -- Refund each non-cancelled booking's purchase
  update public.customer_purchases cp
    set classes_used = classes_used - 1
    from public.bookings b
    where b.slot_id = p_slot_id
      and b.status <> 'cancelled'
      and b.purchase_id = cp.id
      and cp.classes_used > 0;

  -- Cancel all non-cancelled bookings & return customer IDs for notify fan-out
  return query
    update public.bookings
      set status = 'cancelled', cancelled_at = now(), cancelled_by = null
      where slot_id = p_slot_id
        and status <> 'cancelled'
    returning customer_id, v_member_user_id, v_service_name, v_slot.start_at;

  -- Mark slot cancelled
  update public.availability_slots
    set status = 'cancelled', updated_at = now()
    where id = p_slot_id;
end;
$$;

grant execute on function public.auto_cancel_group_slot(uuid) to service_role;
-- service_role only; cron uses admin client. authenticated callers go through
-- cancel_booking (per-booking) instead.
