-- ============================================================================
-- 預約流程改版 v2 / P1 — Migration 4：資料庫函式
-- 可重複執行。需在 Migration 1、2 之後執行（建議也在 3 之後）。
--
-- 共通原則：
--   * 鎖定順序一律：時段 → 預約 → 購買
--   * 權限照設計文件 §12 最終版：Owner、該時段的助教；平台管理員不可代操作
--   * 預約或堂數的任何變更，同一交易寫入 activity_log 與 class_ledger
--   * 原因去頭尾空白時，換行、定位字元、全形空白都算空白（btrim 只去半形空白）
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 輔助 1：呼叫者在這個租戶、對這個時段的身分
--   'owner'  ：租戶的 Owner
--   'staff'  ：助教，而且這個時段的負責成員就是他
--   null     ：其他（非成員、或助教但不是自己的時段）
-- ----------------------------------------------------------------------------
create or replace function public.tenant_actor_role(p_tenant_id uuid, p_slot_member_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
           when m.role = 'owner' then 'owner'
           when m.role = 'staff' and m.id = p_slot_member_id then 'staff'
         end
    from public.tenant_members m
   where m.tenant_id = p_tenant_id
     and m.user_id = auth.uid()
     and m.status = 'active'
   limit 1;
$$;

revoke execute on function public.tenant_actor_role(uuid, uuid) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 輔助 2：寫一筆歷程
-- ----------------------------------------------------------------------------
create or replace function public.log_activity(
  p_tenant_id uuid,
  p_subject_type text,
  p_subject_id uuid,
  p_booking_id uuid,
  p_customer_id uuid,
  p_event text,
  p_actor_user_id uuid,
  p_actor_role text,
  p_reason text default null,
  p_detail jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.activity_log (
    tenant_id, subject_type, subject_id, booking_id, customer_id,
    event, actor_user_id, actor_role, reason, detail
  ) values (
    p_tenant_id, p_subject_type, p_subject_id, p_booking_id, p_customer_id,
    p_event,
    case when p_actor_role = 'system' then null else p_actor_user_id end,
    p_actor_role,
    nullif(regexp_replace(coalesce(p_reason, ''), '^[\s　]+|[\s　]+$', '', 'g'), ''),
    coalesce(p_detail, '{}'::jsonb)
  );
$$;

revoke execute on function public.log_activity(uuid, text, uuid, uuid, uuid, text, uuid, text, text, jsonb)
  from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 輔助 3：調整已用堂數並寫明細（兩件事綁在一起，確保加總永遠對得上）
--   p_delta 是「剩餘堂數的變化」：扣一堂 -1、退一堂 +1
--   回傳 true ＝有調整；false ＝沒有調整（沒有購買，或調整後會超出 0～總堂數）
-- ----------------------------------------------------------------------------
create or replace function public.apply_class_delta(
  p_purchase_id uuid,
  p_booking_id uuid,
  p_delta int,
  p_reason_code text,
  p_actor_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows int;
begin
  if p_purchase_id is null or p_delta = 0 then
    return false;
  end if;

  update public.customer_purchases
     set classes_used = classes_used - p_delta
   where id = p_purchase_id
     and classes_used - p_delta between 0 and classes_total;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    return false;
  end if;

  insert into public.class_ledger (purchase_id, booking_id, delta, reason_code, actor_user_id)
  values (p_purchase_id, p_booking_id, p_delta, p_reason_code, p_actor_user_id);
  return true;
end;
$$;

revoke execute on function public.apply_class_delta(uuid, uuid, int, text, uuid)
  from public, anon, authenticated;

-- ============================================================================
-- 1. book_with_purchase：存取消期限、寫明細與歷程
--    其餘邏輯與 20261125100000_booking_guard_fixes.sql 相同（含封鎖檢查、成班自動確認）
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
  v_actor_role text;
  v_deadline timestamptz;
begin
  -- 登入者只能替自己預約
  if auth.role() <> 'service_role' then
    if auth.uid() is null or p_customer_id <> auth.uid() then
      raise exception 'FORBIDDEN' using errcode = '42501';
    end if;
  end if;
  v_actor_role := case when auth.uid() = p_customer_id then 'customer' else 'system' end;

  -- 鎖定時段
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

  -- 被這位教練封鎖的學員不可預約
  select is_blocked into v_blocked
    from public.tenant_customers
   where tenant_id = v_slot.tenant_id and customer_id = p_customer_id;
  if v_blocked then
    raise exception 'CUSTOMER_BLOCKED' using errcode = 'P0001';
  end if;

  select id, max_capacity, min_attendance, cancel_deadline_hours
    into v_service
    from public.services
   where id = v_slot.service_id;

  -- 取消期限：成立時算好存在預約上
  v_deadline := v_slot.start_at - v_service.cancel_deadline_hours * interval '1 hour';

  -- 名額檢查
  select count(*) into v_existing_count
    from public.bookings
   where slot_id = p_slot_id and status <> 'cancelled';
  if v_existing_count >= v_service.max_capacity then
    raise exception 'SLOT_FULL' using errcode = 'P0001';
  end if;

  -- 選購買（並鎖定）
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

  insert into public.tenant_customers (tenant_id, customer_id)
    values (v_slot.tenant_id, p_customer_id)
    on conflict (tenant_id, customer_id) do nothing;

  -- 建立預約
  insert into public.bookings (
    tenant_id, slot_id, customer_id, service_id, status,
    customer_notes, purchase_id, cancel_deadline_at
  ) values (
    v_slot.tenant_id, p_slot_id, p_customer_id, v_slot.service_id, 'pending',
    p_customer_notes, v_purchase_id, v_deadline
  )
  returning id into v_new_booking_id;

  -- 扣 1 堂（同時寫明細）
  if not public.apply_class_delta(v_purchase_id, v_new_booking_id, -1, 'booking', auth.uid()) then
    raise exception 'NO_BALANCE' using errcode = 'P0001';
  end if;

  perform public.log_activity(
    v_slot.tenant_id, 'booking', v_new_booking_id, v_new_booking_id, p_customer_id,
    'booking.created', auth.uid(), v_actor_role, null,
    jsonb_build_object(
      'slot_id', p_slot_id,
      'purchase_id', v_purchase_id,
      'cancel_deadline_at', v_deadline
    )
  );

  update public.availability_slots
     set status = 'pending', updated_at = now()
   where id = p_slot_id;

  -- 達開班人數 → 所有待確認一起自動確認（P1 沿用；P2 移除）
  if v_existing_count + 1 >= v_service.min_attendance then
    with upd as (
      update public.bookings
         set status = 'confirmed'
       where slot_id = p_slot_id
         and status = 'pending'
      returning id, tenant_id, customer_id
    )
    insert into public.activity_log (
      tenant_id, subject_type, subject_id, booking_id, customer_id,
      event, actor_user_id, actor_role, detail
    )
    select upd.tenant_id, 'booking', upd.id, upd.id, upd.customer_id,
           'booking.confirmed', null, 'system',
           jsonb_build_object('auto', true, 'trigger', 'min_attendance')
      from upd;
    v_auto_confirmed := true;
  end if;

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

revoke execute on function public.book_with_purchase(uuid, uuid, text, uuid) from public, anon;
grant execute on function public.book_with_purchase(uuid, uuid, text, uuid) to authenticated;

-- ============================================================================
-- 2. confirm_booking：權限收緊（Owner／該時段的助教）、寫歷程
-- ============================================================================
create or replace function public.confirm_booking(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
  v_slot record;
  v_slot_id uuid;
  v_actor_role text;
  v_max_capacity int;
  v_active_count int;
begin
  select slot_id into v_slot_id from public.bookings where id = p_booking_id;
  if not found then
    raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- 鎖定順序：時段 → 預約
  select id, member_id into v_slot
    from public.availability_slots
   where id = v_slot_id
     for update;

  select * into v_booking from public.bookings where id = p_booking_id for update;

  v_actor_role := public.tenant_actor_role(v_booking.tenant_id, v_slot.member_id);
  if v_actor_role is null then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if v_booking.status <> 'pending' then
    raise exception 'INVALID_STATE' using errcode = 'P0001';
  end if;

  update public.bookings
     set status = 'confirmed'
   where id = p_booking_id
  returning * into v_booking;

  -- 時段狀態依有效預約數重算（沿用 #22）
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

  perform public.log_activity(
    v_booking.tenant_id, 'booking', p_booking_id, p_booking_id, v_booking.customer_id,
    'booking.confirmed', auth.uid(), v_actor_role, null, '{}'::jsonb
  );

  return v_booking;
end;
$$;

revoke execute on function public.confirm_booking(uuid) from public, anon;
grant execute on function public.confirm_booking(uuid) to authenticated;

-- ============================================================================
-- 3. cancel_booking：原因必填、寫取消紀錄、讀預約上的取消期限
--    簽章由 (uuid) 改為 (uuid, text)；舊簽章刪除，避免被直接呼叫繞過「原因必填」
-- ============================================================================
drop function if exists public.cancel_booking(uuid);

create or replace function public.cancel_booking(
  p_booking_id uuid,
  p_reason text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
  v_slot record;
  v_slot_id uuid;
  v_actor_role text;
  v_reason text := nullif(regexp_replace(coalesce(p_reason, ''), '^[\s　]+|[\s　]+$', '', 'g'), '');
  v_prev_status text;
  v_deadline timestamptz;
  v_category text;
  v_disposition text;
  v_returned boolean := false;
begin
  select slot_id into v_slot_id from public.bookings where id = p_booking_id;
  if not found then
    raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- 鎖定順序：時段 → 預約
  select s.id, s.member_id, s.start_at, sv.cancel_deadline_hours
    into v_slot
    from public.availability_slots s
    join public.services sv on sv.id = s.service_id
   where s.id = v_slot_id
     for update of s;

  select * into v_booking from public.bookings where id = p_booking_id for update;

  -- 身分：學員本人，或 Owner／該時段的助教
  if v_booking.customer_id = auth.uid() then
    v_actor_role := 'customer';
  else
    v_actor_role := public.tenant_actor_role(v_booking.tenant_id, v_slot.member_id);
  end if;
  if v_actor_role is null then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if v_booking.status not in ('pending', 'confirmed') then
    raise exception 'INVALID_STATE' using errcode = 'P0001';
  end if;

  if v_reason is null then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001';
  end if;
  if char_length(v_reason) > 500 then
    raise exception 'REASON_TOO_LONG' using errcode = 'P0001';
  end if;

  v_prev_status := v_booking.status;
  -- 取消期限讀預約上的值；舊資料沒有值時才用服務當下的時數推算
  v_deadline := coalesce(
    v_booking.cancel_deadline_at,
    v_slot.start_at - v_slot.cancel_deadline_hours * interval '1 hour'
  );

  if v_actor_role = 'customer' then
    if now() >= v_slot.start_at then
      raise exception 'SLOT_STARTED' using errcode = 'P0001';
    end if;
    v_category := 'customer';
    -- 待確認：一律退回。已確認：期限內退回；逾期不退回（P1 過渡行為，P2 改為擋下）
    v_disposition := case
      when v_prev_status = 'pending' or now() <= v_deadline then 'refunded'
      else 'forfeited'
    end;
  else
    -- 教練對待確認＝拒絕；對已確認＝教練取消。兩者一律退回
    v_category := case when v_prev_status = 'pending' then 'coach_rejected' else 'coach_cancelled' end;
    v_disposition := 'refunded';
  end if;

  if v_disposition = 'refunded' then
    v_returned := public.apply_class_delta(v_booking.purchase_id, p_booking_id, 1, 'cancel_refund', auth.uid());
  end if;

  update public.bookings
     set status = 'cancelled',
         cancelled_at = now(),
         cancelled_by = auth.uid(),
         cancel_category = v_category,
         cancel_reason = v_reason,
         cancel_actor_role = v_actor_role,
         class_disposition = v_disposition
   where id = p_booking_id
  returning * into v_booking;

  -- 時段狀態依剩下的有效預約重算（沿用現況）
  update public.availability_slots
     set status = case
       when exists (
         select 1 from public.bookings
          where slot_id = v_booking.slot_id and status <> 'cancelled'
       ) then 'pending'
       else 'available'
     end
   where id = v_booking.slot_id;

  perform public.log_activity(
    v_booking.tenant_id, 'booking', p_booking_id, p_booking_id, v_booking.customer_id,
    'booking.cancelled', auth.uid(), v_actor_role, v_reason,
    jsonb_build_object(
      'category', v_category,
      'disposition', v_disposition,
      'previous_status', v_prev_status,
      'cancel_deadline_at', v_deadline,
      'class_returned', v_returned
    )
  );

  return v_booking;
end;
$$;

revoke execute on function public.cancel_booking(uuid, text) from public, anon;
grant execute on function public.cancel_booking(uuid, text) to authenticated;

-- ============================================================================
-- 4. reschedule_booking：寫取消紀錄（改期／轉到新預約）、明細一對、歷程兩筆互相連結
--    簽章由 (uuid, uuid) 改為 (uuid, uuid, text)
--    權限以「舊時段」為準；新時段可以是同租戶任何成員的時段（§7.1）
-- ============================================================================
drop function if exists public.reschedule_booking(uuid, uuid);

create or replace function public.reschedule_booking(
  p_old_booking_id uuid,
  p_new_slot_id uuid,
  p_reason text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old public.bookings%rowtype;
  v_old_slot record;
  v_old_slot_id uuid;
  v_new_slot record;
  v_service record;
  v_new_booking public.bookings%rowtype;
  v_actor_role text;
  v_reason text := nullif(regexp_replace(coalesce(p_reason, ''), '^[\s　]+|[\s　]+$', '', 'g'), '');
  v_existing_count int;
  v_blocked boolean;
  v_new_deadline timestamptz;
begin
  select slot_id into v_old_slot_id from public.bookings where id = p_old_booking_id;
  if not found then
    raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_old_slot_id = p_new_slot_id then
    raise exception 'SAME_SLOT' using errcode = 'P0001';
  end if;

  -- 兩個時段依 id 順序鎖定，避免兩筆互換改期時互相卡死
  perform 1
     from public.availability_slots
    where id in (v_old_slot_id, p_new_slot_id)
    order by id
      for update;

  select id, member_id, start_at into v_old_slot
    from public.availability_slots
   where id = v_old_slot_id;

  select * into v_old from public.bookings where id = p_old_booking_id for update;

  -- 身分：學員本人，或 Owner／舊時段的助教
  if v_old.customer_id = auth.uid() then
    v_actor_role := 'customer';
  else
    v_actor_role := public.tenant_actor_role(v_old.tenant_id, v_old_slot.member_id);
  end if;
  if v_actor_role is null then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if v_old.status not in ('pending', 'confirmed') then
    raise exception 'INVALID_STATE' using errcode = 'P0001';
  end if;

  select id, tenant_id, service_id, status, start_at, end_at
    into v_new_slot
    from public.availability_slots
   where id = p_new_slot_id;
  if not found then
    raise exception 'SLOT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_new_slot.status not in ('available', 'pending') then
    raise exception 'SLOT_UNAVAILABLE' using errcode = 'P0001';
  end if;
  if v_new_slot.tenant_id <> v_old.tenant_id then
    raise exception 'CROSS_TENANT' using errcode = 'P0001';
  end if;
  if v_new_slot.service_id <> v_old.service_id then
    raise exception 'SERVICE_MISMATCH' using errcode = 'P0001';
  end if;
  if v_new_slot.start_at <= now() then
    raise exception 'SLOT_PAST' using errcode = 'P0001';
  end if;

  if v_actor_role = 'customer' then
    if now() >= v_old_slot.start_at then
      raise exception 'SLOT_STARTED' using errcode = 'P0001';
    end if;
    select is_blocked into v_blocked
      from public.tenant_customers
     where tenant_id = v_old.tenant_id and customer_id = v_old.customer_id;
    if v_blocked then
      raise exception 'CUSTOMER_BLOCKED' using errcode = 'P0001';
    end if;
  else
    -- 教練代改期必填原因；學員自己改期免填
    if v_reason is null then
      raise exception 'REASON_REQUIRED' using errcode = 'P0001';
    end if;
  end if;
  if v_reason is not null and char_length(v_reason) > 500 then
    raise exception 'REASON_TOO_LONG' using errcode = 'P0001';
  end if;

  select id, max_capacity, min_attendance, cancel_deadline_hours
    into v_service
    from public.services
   where id = v_new_slot.service_id;

  select count(*) into v_existing_count
    from public.bookings
   where slot_id = p_new_slot_id and status <> 'cancelled';
  if v_existing_count >= v_service.max_capacity then
    raise exception 'SLOT_FULL' using errcode = 'P0001';
  end if;

  v_new_deadline := v_new_slot.start_at - v_service.cancel_deadline_hours * interval '1 hour';

  -- 舊預約：取消（類別：改期；堂數處理：轉到新預約）
  update public.bookings
     set status = 'cancelled',
         cancelled_at = now(),
         cancelled_by = auth.uid(),
         cancel_category = 'rescheduled',
         cancel_reason = v_reason,
         cancel_actor_role = v_actor_role,
         class_disposition = 'transferred'
   where id = p_old_booking_id;

  update public.availability_slots
     set status = case
       when exists (
         select 1 from public.bookings
          where slot_id = v_old.slot_id and status <> 'cancelled'
       ) then 'pending'
       else 'available'
     end
   where id = v_old.slot_id;

  update public.availability_slots
     set status = 'pending', updated_at = now()
   where id = p_new_slot_id;

  -- 新預約：沿用同一筆購買，記錄由哪一筆改期而來
  insert into public.bookings (
    tenant_id, slot_id, customer_id, service_id, status, customer_notes,
    purchase_id, cancel_deadline_at, rescheduled_from_booking_id
  ) values (
    v_new_slot.tenant_id, p_new_slot_id, v_old.customer_id, v_new_slot.service_id,
    'pending', v_old.customer_notes,
    v_old.purchase_id, v_new_deadline, p_old_booking_id
  )
  returning * into v_new_booking;

  -- 明細：一退一扣，加總為 0，不動已用堂數
  if v_old.purchase_id is not null then
    insert into public.class_ledger (purchase_id, booking_id, delta, reason_code, actor_user_id)
    values
      (v_old.purchase_id, p_old_booking_id, 1, 'reschedule_out', auth.uid()),
      (v_old.purchase_id, v_new_booking.id, -1, 'reschedule_in', auth.uid());
  end if;

  -- 歷程：舊、新各一筆並互相連結
  perform public.log_activity(
    v_old.tenant_id, 'booking', p_old_booking_id, p_old_booking_id, v_old.customer_id,
    'booking.rescheduled_out', auth.uid(), v_actor_role, v_reason,
    jsonb_build_object(
      'to_booking_id', v_new_booking.id,
      'to_slot_id', p_new_slot_id,
      'category', 'rescheduled',
      'disposition', 'transferred'
    )
  );
  perform public.log_activity(
    v_old.tenant_id, 'booking', v_new_booking.id, v_new_booking.id, v_old.customer_id,
    'booking.rescheduled_in', auth.uid(), v_actor_role, v_reason,
    jsonb_build_object(
      'from_booking_id', p_old_booking_id,
      'from_slot_id', v_old.slot_id,
      'cancel_deadline_at', v_new_deadline
    )
  );

  -- 達開班人數 → 自動確認（P1 沿用；P2 移除）
  if v_existing_count + 1 >= v_service.min_attendance then
    with upd as (
      update public.bookings
         set status = 'confirmed'
       where slot_id = p_new_slot_id
         and status = 'pending'
      returning id, tenant_id, customer_id
    )
    insert into public.activity_log (
      tenant_id, subject_type, subject_id, booking_id, customer_id,
      event, actor_user_id, actor_role, detail
    )
    select upd.tenant_id, 'booking', upd.id, upd.id, upd.customer_id,
           'booking.confirmed', null, 'system',
           jsonb_build_object('auto', true, 'trigger', 'min_attendance')
      from upd;

    select * into v_new_booking
      from public.bookings
     where id = v_new_booking.id;
  end if;

  if v_existing_count + 1 >= v_service.max_capacity then
    update public.availability_slots
       set status = 'booked'
     where id = p_new_slot_id;
  end if;

  return v_new_booking;
end;
$$;

revoke execute on function public.reschedule_booking(uuid, uuid, text) from public, anon;
grant execute on function public.reschedule_booking(uuid, uuid, text) to authenticated;

-- ============================================================================
-- 5. checkin_booking：寫歷程（其餘與 20260613100100 相同）
-- ============================================================================
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
  select b.id, b.tenant_id, b.customer_id, b.status, b.checked_in_at, b.slot_id
    into v_booking
    from public.bookings b
   where b.id = p_booking_id
     for update;
  if not found then
    raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0002';
  end if;

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

  perform public.log_activity(
    v_booking.tenant_id, 'booking', p_booking_id, p_booking_id, v_booking.customer_id,
    'booking.checked_in', auth.uid(),
    case when auth.uid() = v_booking.customer_id then 'customer' else 'system' end,
    null,
    jsonb_build_object('source', 'customer_checkin')
  );

  return next;
end;
$$;

revoke execute on function public.checkin_booking(uuid) from public, anon;
grant execute on function public.checkin_booking(uuid) to authenticated;

-- ============================================================================
-- 6. auto_cancel_group_slot：寫取消紀錄（人數不足／系統／退回）、明細、歷程
--    回傳欄位不變（排程 route 依賴）。只取消待確認、已確認的預約。
-- ============================================================================
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
  v_b record;
  v_count int := 0;
  v_returned boolean;
  v_reason constant text := '人數不足，系統自動取消';
begin
  select id, tenant_id, service_id, member_id, start_at, status
    into v_slot
    from public.availability_slots
   where id = p_slot_id
     for update;
  if not found then
    raise exception 'SLOT_NOT_FOUND' using errcode = 'P0002';
  end if;
  -- 已經關閉過就不重做
  if v_slot.status = 'cancelled' then
    return;
  end if;

  select sv.name into v_service_name from public.services sv where sv.id = v_slot.service_id;
  select m.user_id into v_member_user_id from public.tenant_members m where m.id = v_slot.member_id;

  for v_b in
    select b.id, b.customer_id, b.purchase_id, b.status
      from public.bookings b
     where b.slot_id = p_slot_id
       and b.status in ('pending', 'confirmed')
     order by b.id
       for update
  loop
    v_returned := public.apply_class_delta(v_b.purchase_id, v_b.id, 1, 'cancel_refund', null);

    update public.bookings
       set status = 'cancelled',
           cancelled_at = now(),
           cancelled_by = null,
           cancel_category = 'under_min',
           cancel_reason = v_reason,
           cancel_actor_role = 'system',
           class_disposition = 'refunded'
     where id = v_b.id;

    perform public.log_activity(
      v_slot.tenant_id, 'booking', v_b.id, v_b.id, v_b.customer_id,
      'booking.cancelled', null, 'system', v_reason,
      jsonb_build_object(
        'category', 'under_min',
        'disposition', 'refunded',
        'previous_status', v_b.status,
        'class_returned', v_returned
      )
    );

    v_count := v_count + 1;
    affected_customer_id := v_b.customer_id;
    affected_member_user_id := v_member_user_id;
    service_name := v_service_name;
    slot_start_at := v_slot.start_at;
    return next;
  end loop;

  update public.availability_slots
     set status = 'cancelled', updated_at = now()
   where id = p_slot_id;

  perform public.log_activity(
    v_slot.tenant_id, 'slot', p_slot_id, null, null,
    'slot.closed', null, 'system', v_reason,
    jsonb_build_object('cancelled_bookings', v_count)
  );
end;
$$;

revoke execute on function public.auto_cancel_group_slot(uuid) from public, anon, authenticated;
grant execute on function public.auto_cancel_group_slot(uuid) to service_role;

-- ============================================================================
-- 7. mark_no_show_bookings（新增）：課程結束仍未簽到的已確認預約 → 未出席，並寫歷程
--    取代 checkin-reminder 排程裡直接 update bookings 的做法。
--    只是標記，不動堂數（堂數在預約時已扣，不退回即為不退）。P4 會以待點名流程取代。
-- ============================================================================
create or replace function public.mark_no_show_bookings(p_lookback interval default interval '30 days')
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  with upd as (
    update public.bookings b
       set status = 'no_show'
      from public.availability_slots s
     where s.id = b.slot_id
       and b.status = 'confirmed'
       and b.checked_in_at is null
       and s.end_at < now()
       and s.end_at >= now() - p_lookback
    returning b.id, b.tenant_id, b.customer_id
  ),
  ins as (
    insert into public.activity_log (
      tenant_id, subject_type, subject_id, booking_id, customer_id,
      event, actor_user_id, actor_role, detail
    )
    select upd.tenant_id, 'booking', upd.id, upd.id, upd.customer_id,
           'booking.no_show', null, 'system',
           jsonb_build_object('source', 'system')
      from upd
    returning 1
  )
  select count(*) into v_count from ins;
  return v_count;
end;
$$;

revoke execute on function public.mark_no_show_bookings(interval) from public, anon, authenticated;
grant execute on function public.mark_no_show_bookings(interval) to service_role;
