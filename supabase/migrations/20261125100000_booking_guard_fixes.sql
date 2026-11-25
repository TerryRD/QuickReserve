-- 2026-11-25 線上問題修正（三項）
--
-- 1. book_with_purchase 沒有擋被封鎖的學員。
--    舊的 book_slot_atomic 有 CUSTOMER_BLOCKED 檢查，改用 book_with_purchase 後漏掉，
--    封鎖功能形同失效。這裡在鎖定時段後、扣堂數前補上同一段檢查。
--    函式其餘內容與 20260529140000_group_slot_lifecycle_fix.sql 相同。
--
-- 2. confirm_booking 一確認就把時段標成 'booked'，不看名額。
--    團班（max_capacity > 1）只要教練手動確認一筆，整個時段就額滿、後面的人約不進來。
--    改成依目前有效預約數重算：count >= max_capacity 才 'booked'，否則 'pending'
--    （與 20260529140000 定義的時段生命週期一致）。
--
-- 3. 團班人數不足自動取消的排程原本在 vercel.json 一天只跑一次（00:00 UTC），
--    取消期限落在兩次執行之間的團班永遠不會被取消。
--    比照 checkin-reminder，改由 pg_cron 每 5 分鐘呼叫一次（vercel.json 同步移除）。
--    route 可重複執行：已取消的時段會被 status 條件排除。
--    需要的 Vault secrets（app_base_url、cron_secret）已由 20260613100200 建立過。

-- ============================================================================
-- 1. book_with_purchase：補上封鎖檢查
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
  v_blocked boolean;
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

  -- 1b. Reject customers blocked by this tenant (restored from book_slot_atomic)
  select is_blocked into v_blocked
    from public.tenant_customers
    where tenant_id = v_slot.tenant_id and customer_id = p_customer_id;
  if v_blocked then
    raise exception 'CUSTOMER_BLOCKED' using errcode = 'P0001';
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
-- 2. confirm_booking：時段狀態依有效預約數重算
-- ============================================================================

create or replace function public.confirm_booking(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
  v_is_member boolean;
  v_max_capacity int;
  v_active_count int;
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

  -- Lock the slot, then rebuild its status from active bookings vs capacity.
  perform 1 from public.availability_slots where id = v_booking.slot_id for update;

  select max_capacity into v_max_capacity
    from public.services
    where id = v_booking.service_id;

  select count(*) into v_active_count
    from public.bookings
    where slot_id = v_booking.slot_id and status <> 'cancelled';

  update public.availability_slots
    set status = case when v_active_count >= v_max_capacity then 'booked' else 'pending' end,
        updated_at = now()
    where id = v_booking.slot_id;

  return v_booking;
end;
$$;

revoke execute on function public.confirm_booking(uuid) from public, anon;
grant execute on function public.confirm_booking(uuid) to authenticated;

-- ============================================================================
-- 3. 團班人數不足自動取消：改由 pg_cron 每 5 分鐘觸發
-- ============================================================================

select cron.schedule(
  'auto-cancel-group-class',
  '*/5 * * * *',
  $$
  select net.http_get(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'app_base_url')
           || '/api/cron/auto-cancel-group-class',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    timeout_milliseconds := 10000
  );
  $$
);
