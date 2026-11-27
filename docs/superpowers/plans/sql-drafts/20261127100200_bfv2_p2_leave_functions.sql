-- ============================================================================
-- 預約流程改版 v2 / P2 — Migration 3：請假申請的資料庫函式
-- 【草稿，尚未執行；需 terry 同意後由 terry 執行】可重複執行。
-- 前置：20261127100000（leave_requests）、20261127100100（reschedule_booking_core、refund_class 等）。
--
-- 白話說明（設計文件 §3.7、§7.2）：
--   1. submit_leave_request   學員送出請假申請。
--        條件：預約已確認、尚未開課，而且「已過取消期限」或「團班已成班、自己取消會讓人數低於開班人數」。
--        原因必填；可附一個想改去的時段（同一位教練、同一個服務、還沒開課、還有名額）。
--        同一筆預約同時只能有一筆審核中；被不同意過就不能再送；撤回後可以再送（terry 2026-11-26 決議）。
--   2. withdraw_leave_request 學員在教練處理前撤回。
--   3. resolve_leave_request  教練處理（Owner 或該時段的助教）：
--        approve_reschedule 同意改期——只能同意學員附的時段，同意當下重新檢查名額、到期日、時段是否還在。
--        approve_refund     同意退回——預約取消（類別：請假、來源：學員申請），退回。
--        reject             不同意——預約維持已確認。必填處理說明（另兩種選填）。
--   4. expire_leave_requests  系統：開課時仍審核中 → 自動不同意（給排程呼叫）。
--   5. leave_requests_due_reminder 系統：到「開課前提醒提前量」時還沒處理、而且是更早之前送出的
--        → 回傳要再提醒教練一次的申請，並寫一筆歷程避免重複提醒（給排程呼叫）。
--
-- 新增的錯誤代碼：LEAVE_NOT_NEEDED、LEAVE_ALREADY_PENDING、LEAVE_ALREADY_REJECTED、LEAVE_SLOT_INVALID、
--   LEAVE_NO_SLOT、LEAVE_NOT_FOUND、INVALID_DECISION
--
-- 回滾：
--   drop function if exists public.leave_requests_due_reminder();
--   drop function if exists public.expire_leave_requests();
--   drop function if exists public.resolve_leave_request(uuid, text, text);
--   drop function if exists public.withdraw_leave_request(uuid);
--   drop function if exists public.submit_leave_request(uuid, text, uuid);
-- ============================================================================

-- ============================================================================
-- 1. 學員送出請假申請
-- ============================================================================
create or replace function public.submit_leave_request(
  p_booking_id uuid,
  p_reason text,
  p_requested_slot_id uuid default null
)
returns public.leave_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
  v_slot record;
  v_slot_id uuid;
  v_req_slot record;
  v_reason text := nullif(regexp_replace(coalesce(p_reason, ''), '^[\s　]+|[\s　]+$', '', 'g'), '');
  v_deadline timestamptz;
  v_past_deadline boolean;
  v_group_locked boolean;
  v_request public.leave_requests%rowtype;
begin
  select b.slot_id into v_slot_id from public.bookings b where b.id = p_booking_id;
  if not found then
    raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- 鎖定順序：時段 → 預約
  select s.id, s.start_at, s.formed_at, sv.cancel_deadline_hours, sv.min_attendance
    into v_slot
    from public.availability_slots s
    join public.services sv on sv.id = s.service_id
   where s.id = v_slot_id
     for update of s;

  select * into v_booking from public.bookings where id = p_booking_id for update;

  -- 只有學員本人
  if auth.uid() is null or v_booking.customer_id <> auth.uid() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if v_booking.status <> 'confirmed' then
    raise exception 'INVALID_STATE' using errcode = 'P0001';
  end if;
  if now() >= v_slot.start_at then
    raise exception 'SLOT_STARTED' using errcode = 'P0001';
  end if;

  -- 可送出的條件：已過取消期限，或被團班門檻擋下（§7.2）
  v_deadline := coalesce(
    v_booking.cancel_deadline_at,
    v_slot.start_at - v_slot.cancel_deadline_hours * interval '1 hour'
  );
  v_past_deadline := now() > v_deadline;
  v_group_locked := v_slot.min_attendance >= 2
    and v_slot.formed_at is not null
    and public.slot_active_count(v_slot_id) - 1 < v_slot.min_attendance;
  if not v_past_deadline and not v_group_locked then
    -- 還可以自己取消或改期，不需要請假申請
    raise exception 'LEAVE_NOT_NEEDED' using errcode = 'P0001';
  end if;

  if v_reason is null then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001';
  end if;
  if char_length(v_reason) > 500 then
    raise exception 'REASON_TOO_LONG' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.leave_requests lr
     where lr.booking_id = p_booking_id and lr.status = 'pending'
  ) then
    raise exception 'LEAVE_ALREADY_PENDING' using errcode = 'P0001';
  end if;
  -- 被不同意過（含開課時系統自動不同意）就不能再送
  if exists (
    select 1 from public.leave_requests lr
     where lr.booking_id = p_booking_id and lr.status = 'rejected'
  ) then
    raise exception 'LEAVE_ALREADY_REJECTED' using errcode = 'P0001';
  end if;

  -- 想改去的時段（可不附）：同租戶、同服務、不是原時段、還沒開課、還能預約、還有名額
  if p_requested_slot_id is not null then
    select s.id, s.tenant_id, s.service_id, s.status, s.start_at, sv.max_capacity
      into v_req_slot
      from public.availability_slots s
      join public.services sv on sv.id = s.service_id
     where s.id = p_requested_slot_id;
    if not found
       or v_req_slot.id = v_slot_id
       or v_req_slot.tenant_id <> v_booking.tenant_id
       or v_req_slot.service_id <> v_booking.service_id
       or v_req_slot.status not in ('available', 'pending')
       or v_req_slot.start_at <= now()
       or public.slot_taken_count(p_requested_slot_id) >= v_req_slot.max_capacity then
      raise exception 'LEAVE_SLOT_INVALID' using errcode = 'P0001';
    end if;
  end if;

  insert into public.leave_requests (
    tenant_id, booking_id, customer_id, reason, requested_slot_id
  ) values (
    v_booking.tenant_id, p_booking_id, v_booking.customer_id, v_reason, p_requested_slot_id
  )
  returning * into v_request;

  perform public.log_activity(
    v_booking.tenant_id, 'leave_request', v_request.id, p_booking_id, v_booking.customer_id,
    'leave_request.submitted', auth.uid(), 'customer', v_reason,
    jsonb_build_object(
      'requested_slot_id', p_requested_slot_id,
      'past_deadline', v_past_deadline,
      'group_locked', v_group_locked
    )
  );

  return v_request;
end;
$$;

revoke execute on function public.submit_leave_request(uuid, text, uuid) from public, anon;
grant execute on function public.submit_leave_request(uuid, text, uuid) to authenticated;

-- ============================================================================
-- 2. 學員撤回（教練處理前）
-- ============================================================================
create or replace function public.withdraw_leave_request(p_request_id uuid)
returns public.leave_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.leave_requests%rowtype;
begin
  select * into v_request from public.leave_requests where id = p_request_id for update;
  if not found then
    raise exception 'LEAVE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if auth.uid() is null or v_request.customer_id <> auth.uid() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if v_request.status <> 'pending' then
    raise exception 'INVALID_STATE' using errcode = 'P0001';
  end if;

  update public.leave_requests
     set status = 'withdrawn',
         handled_at = now(),
         handled_by = auth.uid()
   where id = p_request_id
  returning * into v_request;

  perform public.log_activity(
    v_request.tenant_id, 'leave_request', v_request.id, v_request.booking_id, v_request.customer_id,
    'leave_request.withdrawn', auth.uid(), 'customer', null, '{}'::jsonb
  );

  return v_request;
end;
$$;

revoke execute on function public.withdraw_leave_request(uuid) from public, anon;
grant execute on function public.withdraw_leave_request(uuid) to authenticated;

-- ============================================================================
-- 3. 教練處理
--    p_decision：'approve_reschedule' | 'approve_refund' | 'reject'
--    p_note：處理說明（不同意時必填；其餘選填；上限 500 字）
-- ============================================================================
create or replace function public.resolve_leave_request(
  p_request_id uuid,
  p_decision text,
  p_note text default null
)
returns public.leave_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_peek record;
  v_request public.leave_requests%rowtype;
  v_booking public.bookings%rowtype;
  v_slot record;
  v_actor_role text;
  v_note text := nullif(regexp_replace(coalesce(p_note, ''), '^[\s　]+|[\s　]+$', '', 'g'), '');
  v_new_booking public.bookings%rowtype;
  v_refund text;
  v_new_status text;
  v_event text;
begin
  if p_decision is null or p_decision not in ('approve_reschedule', 'approve_refund', 'reject') then
    raise exception 'INVALID_DECISION' using errcode = 'P0001';
  end if;

  -- 先不加鎖讀出要鎖的對象
  select lr.booking_id, lr.requested_slot_id, b.slot_id
    into v_peek
    from public.leave_requests lr
    join public.bookings b on b.id = lr.booking_id
   where lr.id = p_request_id;
  if not found then
    raise exception 'LEAVE_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- 鎖定順序：時段（依 id）→ 預約 → 請假申請。與改期函式一致，避免互相卡死。
  perform 1
     from public.availability_slots s
    where s.id in (v_peek.slot_id, v_peek.requested_slot_id)
    order by s.id
      for update;

  select s.id, s.member_id, s.start_at
    into v_slot
    from public.availability_slots s
   where s.id = v_peek.slot_id;

  select * into v_booking from public.bookings where id = v_peek.booking_id for update;
  select * into v_request from public.leave_requests where id = p_request_id for update;

  -- Owner 或該時段的助教（權限以原時段為準）
  v_actor_role := public.tenant_actor_role(v_booking.tenant_id, v_slot.member_id);
  if v_actor_role is null then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if v_request.status <> 'pending' or v_booking.status <> 'confirmed' then
    raise exception 'INVALID_STATE' using errcode = 'P0001';
  end if;
  -- 開課後不能再處理（排程會自動改成不同意）
  if now() >= v_slot.start_at then
    raise exception 'SLOT_STARTED' using errcode = 'P0001';
  end if;
  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'REASON_TOO_LONG' using errcode = 'P0001';
  end if;
  -- 不同意必填處理說明；同意改期、同意退回選填（terry 2026-11-26 決議）
  if p_decision = 'reject' and v_note is null then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001';
  end if;
  if p_decision = 'approve_reschedule' and v_request.requested_slot_id is null then
    raise exception 'LEAVE_NO_SLOT' using errcode = 'P0001';
  end if;

  v_new_status := case p_decision
    when 'approve_reschedule' then 'approved_reschedule'
    when 'approve_refund' then 'approved_refund'
    else 'rejected'
  end;
  v_event := 'leave_request.' || v_new_status;

  -- 先把申請改成已處理，後面的取消／改期就不會把它當成「審核中」而改成失效
  update public.leave_requests
     set status = v_new_status,
         handled_at = now(),
         handled_by = auth.uid(),
         handle_note = v_note
   where id = p_request_id
  returning * into v_request;

  if p_decision = 'approve_reschedule' then
    -- 只能同意學員附的時段；名額、到期日、時段是否還在，都在這裡重新檢查（不過就整筆退回原狀）
    v_new_booking := public.reschedule_booking_core(
      v_booking.id, v_request.requested_slot_id, v_actor_role, v_request.reason,
      false,            -- 不套用學員自己改期的限制
      'leave_request'
    );
  elsif p_decision = 'approve_refund' then
    v_refund := public.refund_class(v_booking.id, 'cancel_refund', auth.uid());

    update public.bookings
       set status = 'cancelled',
           cancelled_at = now(),
           cancelled_by = auth.uid(),
           cancel_category = 'leave',
           cancel_reason = v_request.reason,
           cancel_actor_role = v_actor_role,
           class_disposition = 'refunded',
           leave_source = 'request'
     where id = v_booking.id;

    perform public.refresh_slot_status(v_booking.slot_id);

    perform public.log_activity(
      v_booking.tenant_id, 'booking', v_booking.id, v_booking.id, v_booking.customer_id,
      'booking.cancelled', auth.uid(), v_actor_role, v_request.reason,
      jsonb_build_object(
        'category', 'leave',
        'leave_source', 'request',
        'disposition', 'refunded',
        'previous_status', 'confirmed',
        'class_returned', v_refund = 'returned',
        'refund_result', v_refund,
        'leave_request_id', v_request.id
      )
    );
  end if;

  perform public.log_activity(
    v_request.tenant_id, 'leave_request', v_request.id, v_request.booking_id, v_request.customer_id,
    v_event, auth.uid(), v_actor_role, v_note,
    jsonb_build_object(
      'requested_slot_id', v_request.requested_slot_id,
      'new_booking_id', v_new_booking.id
    )
  );

  return v_request;
end;
$$;

revoke execute on function public.resolve_leave_request(uuid, text, text) from public, anon;
grant execute on function public.resolve_leave_request(uuid, text, text) to authenticated;

-- ============================================================================
-- 4. 系統：開課時仍審核中 → 自動不同意（排程呼叫）
-- ============================================================================
create or replace function public.expire_leave_requests()
returns table (
  request_id uuid,
  request_booking_id uuid,
  request_customer_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_r record;
begin
  for v_r in
    select lr.id, lr.tenant_id, lr.booking_id, lr.customer_id
      from public.leave_requests lr
      join public.bookings b on b.id = lr.booking_id
      join public.availability_slots s on s.id = b.slot_id
     where lr.status = 'pending'
       and s.start_at <= now()
     order by lr.id
       for update of lr
  loop
    update public.leave_requests
       set status = 'rejected',
           handled_at = now(),
           handled_by = null,
           handled_by_system = true
     where id = v_r.id;

    perform public.log_activity(
      v_r.tenant_id, 'leave_request', v_r.id, v_r.booking_id, v_r.customer_id,
      'leave_request.auto_rejected', null, 'system', null, '{}'::jsonb
    );

    request_id := v_r.id;
    request_booking_id := v_r.booking_id;
    request_customer_id := v_r.customer_id;
    return next;
  end loop;
end;
$$;

revoke execute on function public.expire_leave_requests() from public, anon, authenticated;
grant execute on function public.expire_leave_requests() to service_role;

-- ============================================================================
-- 5. 系統：請假申請的第二次提醒（排程呼叫）
--    條件：仍審核中；現在已進入「開課前提醒提前量」之內、但還沒開課；
--          申請是在提醒時間點之前送出的（之後才送出的，送出當下已經通知過）；還沒提醒過。
--    回傳要提醒的申請，同時寫一筆歷程，下次就不會再回傳。
-- ============================================================================
create or replace function public.leave_requests_due_reminder()
returns table (
  request_id uuid,
  request_booking_id uuid,
  request_customer_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead interval := public.platform_setting_int('reminder_lead_hours') * interval '1 hour';
  v_r record;
begin
  for v_r in
    select lr.id, lr.tenant_id, lr.booking_id, lr.customer_id
      from public.leave_requests lr
      join public.bookings b on b.id = lr.booking_id
      join public.availability_slots s on s.id = b.slot_id
     where lr.status = 'pending'
       and s.start_at > now()
       and s.start_at - v_lead <= now()
       and lr.created_at < s.start_at - v_lead
       and not exists (
         select 1 from public.activity_log al
          where al.subject_type = 'leave_request'
            and al.subject_id = lr.id
            and al.event = 'leave_request.reminded'
       )
     order by lr.id
       for update of lr
  loop
    perform public.log_activity(
      v_r.tenant_id, 'leave_request', v_r.id, v_r.booking_id, v_r.customer_id,
      'leave_request.reminded', null, 'system', null, '{}'::jsonb
    );

    request_id := v_r.id;
    request_booking_id := v_r.booking_id;
    request_customer_id := v_r.customer_id;
    return next;
  end loop;
end;
$$;

revoke execute on function public.leave_requests_due_reminder() from public, anon, authenticated;
grant execute on function public.leave_requests_due_reminder() to service_role;
