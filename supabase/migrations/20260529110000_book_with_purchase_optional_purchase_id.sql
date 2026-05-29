-- A-1 (spec 2026-05-29-interactive-purchase-selection-on-book-design):
-- Allow caller to pick which purchase package to spend. The 3-arg form
-- silently consumed the oldest-expiring active purchase; the new 4-arg form
-- honours an explicit p_purchase_id when supplied (validated for ownership +
-- service + active + remaining classes) and falls back to oldest-expiring
-- when null. New error PURCHASE_INVALID (P0001) covers all 4 failure modes.
--
-- DROP the 3-arg signature first — adding a default-null arg creates a new
-- overload, leaving the old version coexisting and silently winning for any
-- caller that omits the new arg. Drop + recreate is the only way to retire
-- the old signature cleanly.

drop function if exists public.book_with_purchase(uuid, uuid, text);

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
    -- Validate caller-supplied selection: must belong to p_customer_id,
    -- match the slot's service, be confirmed, have remaining classes,
    -- and not be expired. Lock for update to prevent double-spend.
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
    -- Fall back to oldest-expiring active purchase (legacy behaviour)
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

  -- 8. Update slot status
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

grant execute on function public.book_with_purchase(uuid, uuid, text, uuid) to authenticated;
