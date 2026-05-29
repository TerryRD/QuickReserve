-- S7 audit finding (2026-05-29-security-definer-rpc-audit.md): both booking RPCs
-- accept `p_customer_id` and are granted to `authenticated`, but neither verifies
-- that the JWT subject matches the supplied customer_id. A signed-in customer
-- could hit /rest/v1/rpc directly and book on behalf of any other customer —
-- consuming the victim's purchase package in the case of book_with_purchase.
--
-- The guard checks auth.role() so service_role paths (cron jobs, admin tooling,
-- integration tests using SERVICE_ROLE_KEY) are not affected. Only the
-- `authenticated` role is required to match its own auth.uid().

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
  -- Guard: authenticated callers may only book for themselves.
  if auth.role() <> 'service_role' then
    if auth.uid() is null or p_customer_id <> auth.uid() then
      raise exception 'FORBIDDEN' using errcode = '42501';
    end if;
  end if;

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

  select is_blocked into v_blocked
  from public.tenant_customers
  where tenant_id = v_slot.tenant_id and customer_id = p_customer_id;

  if v_blocked then
    raise exception 'CUSTOMER_BLOCKED' using errcode = 'P0001';
  end if;

  insert into public.customers (id, display_name)
  values (p_customer_id, null)
  on conflict (id) do nothing;

  insert into public.tenant_customers (tenant_id, customer_id)
  values (v_slot.tenant_id, p_customer_id)
  on conflict (tenant_id, customer_id) do nothing;

  update public.availability_slots
  set status = 'pending', updated_at = now()
  where id = p_slot_id;

  insert into public.bookings (
    tenant_id, slot_id, customer_id, service_id, status, customer_notes
  ) values (
    v_slot.tenant_id, p_slot_id, p_customer_id, v_slot.service_id, 'pending', p_customer_notes
  )
  returning * into v_booking;

  return v_booking;
end;
$$;

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
  -- Guard: authenticated callers may only book for themselves.
  if auth.role() <> 'service_role' then
    if auth.uid() is null or p_customer_id <> auth.uid() then
      raise exception 'FORBIDDEN' using errcode = '42501';
    end if;
  end if;

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

  select id, max_capacity, min_attendance
    into v_service
    from public.services
    where id = v_slot.service_id;

  select count(*) into v_existing_count
    from public.bookings
    where slot_id = p_slot_id and status <> 'cancelled';
  if v_existing_count >= v_service.max_capacity then
    raise exception 'SLOT_FULL' using errcode = 'P0001';
  end if;

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

  insert into public.tenant_customers (tenant_id, customer_id)
    values (v_slot.tenant_id, p_customer_id)
    on conflict (tenant_id, customer_id) do nothing;

  update public.customer_purchases
    set classes_used = classes_used + 1
    where id = v_purchase_id;

  insert into public.bookings (
    tenant_id, slot_id, customer_id, service_id, status,
    customer_notes, purchase_id
  ) values (
    v_slot.tenant_id, p_slot_id, p_customer_id, v_slot.service_id, 'pending',
    p_customer_notes, v_purchase_id
  )
  returning id into v_new_booking_id;

  update public.availability_slots
    set status = 'pending', updated_at = now()
    where id = p_slot_id;

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
