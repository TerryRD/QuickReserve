-- ============================================================================
-- 預約流程改版 v2 / P2 — Migration 2：預約、取消、改期、成班的資料庫函式
-- 【草稿，尚未執行；需 terry 同意後由 terry 執行】可重複執行。
-- 前置：20261126110000（slot_taken_count）、20261127100000（formed_at、leave_requests、source_booking_id）。
--
-- 白話說明（與現行的差異，請逐項看）：
--   A. 預約 book_with_purchase
--      1. 用堂數預約一送出就是「已確認」（原本先「待確認」）。
--      2. 拿掉「達開班人數就把所有待確認一起自動確認」。
--      3. 團班人數第一次達開班人數時記下成班時間（只記一次）。
--      4. 到期檢查改看上課時間：上課時間不可晚於那筆購買的到期日（原本只看「現在」過期沒）。
--      5. 名額＝未取消的預約＋「學員臨時取消」的已取消預約（原本只算未取消）。
--      6. 被記過「學員臨時取消」的學員不可再預約同一個時段。
--      7. 回傳欄位改為（預約 id、預約狀態、這次是否剛好成班）；原本是（預約 id、是否自動確認）。
--   B. 取消 cancel_booking
--      1. 學員取消已確認的預約：過了取消期限 → 擋下（原本可取消、不退回）。
--      2. 學員取消已確認的團班預約：已成班、而且取消後人數會低於開班人數 → 擋下。
--      3. 教練取消：開課後 → 擋下（原本沒擋）。
--      4. 退回時若原購買已過期 → 不退回原購買，改發 1 堂補堂（到期日＝當下＋平台設定的補堂寬限天數）。
--      5. 這筆預約若有審核中的請假申請 → 申請失效。
--   C. 改期 reschedule_booking
--      1. 待確認的預約不可改期。
--      2. 學員改期：過了取消期限 → 擋下；已成班且改走後人數會低於開班人數 → 擋下。
--      3. 教練代改期：開課前任何時間都可以，不受團班人數限制（terry 2026-11-26 決議）。
--      4. 新預約直接「已確認」；拿掉自動確認；新時段達開班人數時記成班。
--      5. 新時段的上課時間不可晚於那筆購買的到期日。
--   D. 新增：學員臨時取消（教練代登）late_cancel_booking——只限 Owner、取消期限之後到開課之前、必填原因、不退回、名額繼續佔用。
--   E. 新增：關閉時段 close_slot——對每筆未上課的預約做一次教練取消（同一個原因）、退回，時段關閉。
--   F. 人數不足自動取消：改看「有沒有成過班」，成過班就不再自動取消；挑時段的判斷搬進資料庫
--      （新增 auto_cancel_unformed_slots，排程改呼叫它）。
--   G. 確認 confirm_booking、簽到 checkin_booking：只改時段狀態的算法／簽到時讓審核中的請假申請失效。
--
-- 新增的錯誤代碼（畫面訊息對照寫在 src/lib/booking-rpc-errors.ts，一律中文白話）：
--   PAST_CANCEL_DEADLINE、GROUP_MIN_LOCKED、PENDING_CANNOT_RESCHEDULE、PURCHASE_EXPIRES_BEFORE_CLASS、
--   ALREADY_BOOKED、LATE_CANCEL_NO_REBOOK、NOT_IN_LATE_WINDOW、SLOT_ALREADY_CLOSED、SLOT_HAS_ATTENDANCE、
--   SETTING_MISSING
--
-- 上線注意：這個檔一執行，舊版程式的「預約」會讀不到是否自動確認（不影響預約本身），
--   學員逾期取消會被擋下並顯示通用錯誤。請與新版程式部署接連進行。
--
-- 回滾：重新執行 20261126100300_bfv2_p1_functions.sql（會把 6 支函式還原成第 1 階段的版本），
--   再執行本檔最下方「回滾用」註解裡的 drop。
-- ============================================================================

-- ============================================================================
-- 輔助函式（只給其他函式用，登入者不可直接呼叫）
-- ============================================================================

-- 有效預約數（待確認＋已確認）：成班判定與「取消後會不會低於開班人數」用這個數
create or replace function public.slot_active_count(p_slot_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
    from public.bookings b
   where b.slot_id = p_slot_id
     and b.status in ('pending', 'confirmed');
$$;

revoke execute on function public.slot_active_count(uuid) from public, anon, authenticated;

-- 給畫面顯示「尚未成班（3/5）／已成班」用：有效預約數、開班人數、成班時間。
-- 只回給與這個時段有關的人：在這個時段有預約的學員、這個租戶的成員、平台管理員；其他人拿到空結果。
create or replace function public.slot_formation_info(p_slot_id uuid)
returns table (
  active_count int,
  min_attendance int,
  formed_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select public.slot_active_count(s.id), sv.min_attendance, s.formed_at
    from public.availability_slots s
    join public.services sv on sv.id = s.service_id
   where s.id = p_slot_id
     and (
       is_platform_admin()
       or s.tenant_id in (select current_user_tenant_ids())
       or exists (
         select 1 from public.bookings b
          where b.slot_id = s.id and b.customer_id = auth.uid()
       )
     );
$$;

revoke execute on function public.slot_formation_info(uuid) from public, anon;
grant execute on function public.slot_formation_info(uuid) to authenticated;

-- 依已佔名額重算時段狀態：0 → available；未滿 → pending；滿 → booked。已關閉的時段不動。
create or replace function public.refresh_slot_status(p_slot_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_max int;
  v_taken int;
begin
  select s.status, sv.max_capacity
    into v_status, v_max
    from public.availability_slots s
    join public.services sv on sv.id = s.service_id
   where s.id = p_slot_id;
  if not found or v_status = 'cancelled' then
    return;
  end if;

  v_taken := public.slot_taken_count(p_slot_id);

  update public.availability_slots
     set status = case
           when v_taken >= v_max then 'booked'
           when v_taken > 0 then 'pending'
           else 'available'
         end,
         updated_at = now()
   where id = p_slot_id;
end;
$$;

revoke execute on function public.refresh_slot_status(uuid) from public, anon, authenticated;

-- 成班判定：團班（開班人數 ≥ 2）有效預約數第一次達開班人數 → 記成班時間、寫歷程。回傳這次是否剛成班。
create or replace function public.mark_slot_formed(p_slot_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_formed_at timestamptz;
  v_min int;
  v_active int;
begin
  select s.tenant_id, s.formed_at, sv.min_attendance
    into v_tenant_id, v_formed_at, v_min
    from public.availability_slots s
    join public.services sv on sv.id = s.service_id
   where s.id = p_slot_id;
  if not found or v_min < 2 or v_formed_at is not null then
    return false;
  end if;

  v_active := public.slot_active_count(p_slot_id);
  if v_active < v_min then
    return false;
  end if;

  update public.availability_slots
     set formed_at = now(), updated_at = now()
   where id = p_slot_id;

  perform public.log_activity(
    v_tenant_id, 'slot', p_slot_id, null, null,
    'slot.formed', null, 'system', null,
    jsonb_build_object('active_count', v_active, 'min_attendance', v_min)
  );
  return true;
end;
$$;

revoke execute on function public.mark_slot_formed(uuid) from public, anon, authenticated;

-- 讀平台設定的整數值；沒有這個設定就報錯，不用寫死的預設值頂替
create or replace function public.platform_setting_int(p_key text)
returns int
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_value int;
begin
  select (ps.value #>> '{}')::int into v_value
    from public.platform_settings ps
   where ps.key = p_key;
  if v_value is null then
    raise exception 'SETTING_MISSING' using errcode = 'P0001';
  end if;
  return v_value;
end;
$$;

revoke execute on function public.platform_setting_int(text) from public, anon, authenticated;

-- 退回 1 堂。原購買已過期 → 改發補堂。
--   回傳 'returned'（已退回原購買）／'makeup'（已發補堂）／'none'（沒有可退的，例如沒有對應購買）
create or replace function public.refund_class(
  p_booking_id uuid,
  p_reason_code text,
  p_actor_user_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_b record;
  v_p record;
  v_days int;
  v_makeup_id uuid;
  v_makeup_expires timestamptz;
begin
  select b.tenant_id, b.customer_id, b.purchase_id, b.service_id
    into v_b
    from public.bookings b
   where b.id = p_booking_id;
  if not found or v_b.purchase_id is null then
    return 'none';
  end if;

  select cp.id, cp.expires_at
    into v_p
    from public.customer_purchases cp
   where cp.id = v_b.purchase_id
     for update;

  if v_p.expires_at is not null and v_p.expires_at <= now() then
    v_days := public.platform_setting_int('makeup_grace_days');
    v_makeup_expires := now() + v_days * interval '1 day';

    insert into public.customer_purchases (
      tenant_id, customer_id, service_id, package_id,
      classes_total, classes_used, expires_at,
      payment_self_reported, approval_status, approved_at, approved_by,
      origin, source_booking_id
    ) values (
      v_b.tenant_id, v_b.customer_id, v_b.service_id, null,
      1, 0, v_makeup_expires,
      'claimed_paid', 'confirmed', now(), null,
      'makeup', p_booking_id
    )
    returning id into v_makeup_id;

    perform public.log_activity(
      v_b.tenant_id, 'purchase', v_makeup_id, p_booking_id, v_b.customer_id,
      'purchase.makeup_issued', null, 'system', null,
      jsonb_build_object(
        'source_purchase_id', v_b.purchase_id,
        'source_booking_id', p_booking_id,
        'expires_at', v_makeup_expires
      )
    );
    return 'makeup';
  end if;

  if public.apply_class_delta(v_b.purchase_id, p_booking_id, 1, p_reason_code, p_actor_user_id) then
    return 'returned';
  end if;
  return 'none';
end;
$$;

revoke execute on function public.refund_class(uuid, text, uuid) from public, anon, authenticated;

-- 讓這筆預約審核中的請假申請失效（預約被取消、改期、已簽到時呼叫）
create or replace function public.void_pending_leave(p_booking_id uuid, p_cause text)
returns void
language sql
security definer
set search_path = public
as $$
  with upd as (
    update public.leave_requests
       set status = 'void',
           handled_at = now(),
           handled_by = null,
           handled_by_system = true
     where booking_id = p_booking_id
       and status = 'pending'
    returning id, tenant_id, booking_id, customer_id
  )
  insert into public.activity_log (
    tenant_id, subject_type, subject_id, booking_id, customer_id,
    event, actor_user_id, actor_role, detail
  )
  select upd.tenant_id, 'leave_request', upd.id, upd.booking_id, upd.customer_id,
         'leave_request.voided', null, 'system',
         jsonb_build_object('cause', p_cause)
    from upd;
$$;

revoke execute on function public.void_pending_leave(uuid, text) from public, anon, authenticated;

-- ============================================================================
-- 1. book_with_purchase
--    回傳欄位改變，必須先刪除舊函式再建立
-- ============================================================================
drop function if exists public.book_with_purchase(uuid, uuid, text, uuid);

create function public.book_with_purchase(
  p_slot_id uuid,
  p_customer_id uuid,
  p_customer_notes text default null,
  p_purchase_id uuid default null
)
returns table (
  booking_id uuid,
  booking_status text,
  slot_formed boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot record;
  v_service record;
  v_prev record;
  v_p record;
  v_purchase_id uuid;
  v_new_booking_id uuid;
  v_blocked boolean;
  v_actor_role text;
  v_deadline timestamptz;
  v_formed boolean;
begin
  -- 登入者只能替自己預約
  if auth.role() <> 'service_role' then
    if auth.uid() is null or p_customer_id <> auth.uid() then
      raise exception 'FORBIDDEN' using errcode = '42501';
    end if;
  end if;
  v_actor_role := case when auth.uid() = p_customer_id then 'customer' else 'system' end;

  -- 鎖定時段
  select s.id, s.tenant_id, s.service_id, s.status, s.start_at, s.end_at
    into v_slot
    from public.availability_slots s
   where s.id = p_slot_id
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
  select tc.is_blocked into v_blocked
    from public.tenant_customers tc
   where tc.tenant_id = v_slot.tenant_id and tc.customer_id = p_customer_id;
  if v_blocked then
    raise exception 'CUSTOMER_BLOCKED' using errcode = 'P0001';
  end if;

  -- 同一學員同一時段：已有預約不可重複；被記過「學員臨時取消」不可再訂
  select b.status
    into v_prev
    from public.bookings b
   where b.slot_id = p_slot_id
     and b.customer_id = p_customer_id
     and (b.status <> 'cancelled' or b.cancel_category = 'late_cancel')
   order by (b.status <> 'cancelled') desc
   limit 1;
  if found then
    if v_prev.status <> 'cancelled' then
      raise exception 'ALREADY_BOOKED' using errcode = 'P0001';
    end if;
    raise exception 'LATE_CANCEL_NO_REBOOK' using errcode = 'P0001';
  end if;

  select sv.id, sv.max_capacity, sv.min_attendance, sv.cancel_deadline_hours
    into v_service
    from public.services sv
   where sv.id = v_slot.service_id;

  -- 取消期限：成立時算好存在預約上
  v_deadline := v_slot.start_at - v_service.cancel_deadline_hours * interval '1 hour';

  -- 名額檢查（含「學員臨時取消」佔用的名額）
  if public.slot_taken_count(p_slot_id) >= v_service.max_capacity then
    raise exception 'SLOT_FULL' using errcode = 'P0001';
  end if;

  -- 選購買（並鎖定）。上課時間不可晚於到期日。
  if p_purchase_id is not null then
    select cp.id, cp.expires_at
      into v_p
      from public.customer_purchases cp
     where cp.id = p_purchase_id
       and cp.customer_id = p_customer_id
       and cp.service_id = v_slot.service_id
       and cp.approval_status = 'confirmed'
       and cp.classes_used < cp.classes_total
       and (cp.expires_at is null or cp.expires_at > now())
       for update;
    if not found then
      raise exception 'PURCHASE_INVALID' using errcode = 'P0001';
    end if;
    if v_p.expires_at is not null and v_p.expires_at < v_slot.start_at then
      raise exception 'PURCHASE_EXPIRES_BEFORE_CLASS' using errcode = 'P0001';
    end if;
    v_purchase_id := p_purchase_id;
  else
    select cp.id into v_purchase_id
      from public.customer_purchases cp
     where cp.customer_id = p_customer_id
       and cp.service_id = v_slot.service_id
       and cp.approval_status = 'confirmed'
       and cp.classes_used < cp.classes_total
       and (cp.expires_at is null or cp.expires_at >= v_slot.start_at)
     order by
       case when cp.expires_at is null then 1 else 0 end,
       cp.expires_at asc nulls last,
       cp.approved_at asc
     limit 1
       for update;
    if v_purchase_id is null then
      -- 有還沒過期的堂數、只是到期日早於上課時間 → 給明確的訊息
      if exists (
        select 1
          from public.customer_purchases cp
         where cp.customer_id = p_customer_id
           and cp.service_id = v_slot.service_id
           and cp.approval_status = 'confirmed'
           and cp.classes_used < cp.classes_total
           and cp.expires_at > now()
      ) then
        raise exception 'PURCHASE_EXPIRES_BEFORE_CLASS' using errcode = 'P0001';
      end if;
      raise exception 'NO_BALANCE' using errcode = 'P0001';
    end if;
  end if;

  insert into public.tenant_customers (tenant_id, customer_id)
    values (v_slot.tenant_id, p_customer_id)
    on conflict (tenant_id, customer_id) do nothing;

  -- 建立預約：用堂數預約直接成立（設計文件 §4.2；「一律需要教練確認」開關在第 3 階段才加）
  insert into public.bookings (
    tenant_id, slot_id, customer_id, service_id, status,
    customer_notes, purchase_id, cancel_deadline_at
  ) values (
    v_slot.tenant_id, p_slot_id, p_customer_id, v_slot.service_id, 'confirmed',
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
      'cancel_deadline_at', v_deadline,
      'status', 'confirmed'
    )
  );

  v_formed := public.mark_slot_formed(p_slot_id);
  perform public.refresh_slot_status(p_slot_id);

  booking_id := v_new_booking_id;
  booking_status := 'confirmed';
  slot_formed := v_formed;
  return next;
end;
$$;

revoke execute on function public.book_with_purchase(uuid, uuid, text, uuid) from public, anon;
grant execute on function public.book_with_purchase(uuid, uuid, text, uuid) to authenticated, service_role;

-- ============================================================================
-- 2. confirm_booking：只改時段狀態的算法（其餘與第 1 階段相同）
--    第 2 階段用堂數預約不會再產生待確認；這支留給第 3 階段的單堂預約與「一律需要教練確認」。
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
begin
  select b.slot_id into v_slot_id from public.bookings b where b.id = p_booking_id;
  if not found then
    raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- 鎖定順序：時段 → 預約
  select s.id, s.member_id into v_slot
    from public.availability_slots s
   where s.id = v_slot_id
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

  perform public.refresh_slot_status(v_booking.slot_id);

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
-- 3. cancel_booking：學員取消（受取消期限與團班門檻限制）、教練拒絕／教練取消（開課前）
-- ============================================================================
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
  v_refund text;
begin
  select b.slot_id into v_slot_id from public.bookings b where b.id = p_booking_id;
  if not found then
    raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- 鎖定順序：時段 → 預約
  select s.id, s.member_id, s.start_at, s.formed_at,
         sv.cancel_deadline_hours, sv.min_attendance
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

  -- 開課後：學員不可取消；教練也不可取消（只能點名，第 4 階段）
  if now() >= v_slot.start_at then
    raise exception 'SLOT_STARTED' using errcode = 'P0001';
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
    v_category := 'customer';
    -- 待確認：開課前隨時可取消（教練尚未承諾）。已確認：受取消期限與團班門檻限制。
    if v_prev_status = 'confirmed' then
      -- 「剛好等於期限」算在期限之前
      if now() > v_deadline then
        raise exception 'PAST_CANCEL_DEADLINE' using errcode = 'P0001';
      end if;
      -- 團班已成班，取消後人數會低於開班人數 → 只能送請假申請
      if v_slot.min_attendance >= 2
         and v_slot.formed_at is not null
         and public.slot_active_count(v_slot_id) - 1 < v_slot.min_attendance then
        raise exception 'GROUP_MIN_LOCKED' using errcode = 'P0001';
      end if;
    end if;
  else
    -- 教練對待確認＝拒絕；對已確認＝教練取消
    v_category := case when v_prev_status = 'pending' then 'coach_rejected' else 'coach_cancelled' end;
  end if;

  -- 這裡的取消一律退回（原購買已過期則發補堂）
  v_refund := public.refund_class(p_booking_id, 'cancel_refund', auth.uid());

  update public.bookings
     set status = 'cancelled',
         cancelled_at = now(),
         cancelled_by = auth.uid(),
         cancel_category = v_category,
         cancel_reason = v_reason,
         cancel_actor_role = v_actor_role,
         class_disposition = 'refunded'
   where id = p_booking_id
  returning * into v_booking;

  perform public.void_pending_leave(p_booking_id, 'booking_cancelled');
  perform public.refresh_slot_status(v_booking.slot_id);

  perform public.log_activity(
    v_booking.tenant_id, 'booking', p_booking_id, p_booking_id, v_booking.customer_id,
    'booking.cancelled', auth.uid(), v_actor_role, v_reason,
    jsonb_build_object(
      'category', v_category,
      'disposition', 'refunded',
      'previous_status', v_prev_status,
      'cancel_deadline_at', v_deadline,
      'class_returned', v_refund = 'returned',
      'refund_result', v_refund
    )
  );

  return v_booking;
end;
$$;

revoke execute on function public.cancel_booking(uuid, text) from public, anon;
grant execute on function public.cancel_booking(uuid, text) to authenticated;

-- ============================================================================
-- 4. late_cancel_booking（新增）：學員臨時取消・教練代登
--    只限 Owner；取消期限之後、開課之前；必填原因；不退回；名額繼續佔用。
-- ============================================================================
create or replace function public.late_cancel_booking(
  p_booking_id uuid,
  p_reason text
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
  v_deadline timestamptz;
begin
  select b.slot_id into v_slot_id from public.bookings b where b.id = p_booking_id;
  if not found then
    raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0002';
  end if;

  select s.id, s.member_id, s.start_at, sv.cancel_deadline_hours
    into v_slot
    from public.availability_slots s
    join public.services sv on sv.id = s.service_id
   where s.id = v_slot_id
     for update of s;

  select * into v_booking from public.bookings where id = p_booking_id for update;

  -- 只限 Owner（設計文件 §12）
  v_actor_role := public.tenant_actor_role(v_booking.tenant_id, v_slot.member_id);
  if v_actor_role is distinct from 'owner' then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if v_booking.status <> 'confirmed' then
    raise exception 'INVALID_STATE' using errcode = 'P0001';
  end if;

  v_deadline := coalesce(
    v_booking.cancel_deadline_at,
    v_slot.start_at - v_slot.cancel_deadline_hours * interval '1 hour'
  );
  -- 只在取消期限之後、開課之前
  if now() <= v_deadline or now() >= v_slot.start_at then
    raise exception 'NOT_IN_LATE_WINDOW' using errcode = 'P0001';
  end if;

  if v_reason is null then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001';
  end if;
  if char_length(v_reason) > 500 then
    raise exception 'REASON_TOO_LONG' using errcode = 'P0001';
  end if;

  update public.bookings
     set status = 'cancelled',
         cancelled_at = now(),
         cancelled_by = auth.uid(),
         cancel_category = 'late_cancel',
         cancel_reason = v_reason,
         cancel_actor_role = v_actor_role,
         class_disposition = 'forfeited'
   where id = p_booking_id
  returning * into v_booking;

  perform public.void_pending_leave(p_booking_id, 'booking_cancelled');
  -- 名額不釋出：slot_taken_count 仍把這筆算進去，時段狀態通常不變
  perform public.refresh_slot_status(v_booking.slot_id);

  perform public.log_activity(
    v_booking.tenant_id, 'booking', p_booking_id, p_booking_id, v_booking.customer_id,
    'booking.cancelled', auth.uid(), v_actor_role, v_reason,
    jsonb_build_object(
      'category', 'late_cancel',
      'disposition', 'forfeited',
      'previous_status', 'confirmed',
      'cancel_deadline_at', v_deadline,
      'class_returned', false
    )
  );

  return v_booking;
end;
$$;

revoke execute on function public.late_cancel_booking(uuid, text) from public, anon;
grant execute on function public.late_cancel_booking(uuid, text) to authenticated;

-- ============================================================================
-- 5. 改期
--    reschedule_booking_core：實際搬移（只給其他函式用）。
--    reschedule_booking：學員自己改期、教練代改期的入口（簽章不變）。
--    同意請假改期由 resolve_leave_request（下一個 migration）呼叫 core。
-- ============================================================================
create or replace function public.reschedule_booking_core(
  p_old_booking_id uuid,
  p_new_slot_id uuid,
  p_actor_role text,
  p_reason text,
  p_customer_rules boolean,
  p_via text
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
  v_prev record;
  v_p_expires timestamptz;
  v_blocked boolean;
  v_old_deadline timestamptz;
  v_new_deadline timestamptz;
  v_formed boolean;
begin
  select b.slot_id into v_old_slot_id from public.bookings b where b.id = p_old_booking_id;
  if not found then
    raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_old_slot_id = p_new_slot_id then
    raise exception 'SAME_SLOT' using errcode = 'P0001';
  end if;

  -- 兩個時段依 id 順序鎖定，避免兩筆互換改期時互相卡死
  perform 1
     from public.availability_slots s
    where s.id in (v_old_slot_id, p_new_slot_id)
    order by s.id
      for update;

  select s.id, s.member_id, s.start_at, s.formed_at,
         sv.cancel_deadline_hours, sv.min_attendance
    into v_old_slot
    from public.availability_slots s
    join public.services sv on sv.id = s.service_id
   where s.id = v_old_slot_id;

  select * into v_old from public.bookings where id = p_old_booking_id for update;

  -- 待確認不可改期（先取消再重新預約）
  if v_old.status = 'pending' then
    raise exception 'PENDING_CANNOT_RESCHEDULE' using errcode = 'P0001';
  end if;
  if v_old.status <> 'confirmed' then
    raise exception 'INVALID_STATE' using errcode = 'P0001';
  end if;

  -- 開課後誰都不可改期
  if now() >= v_old_slot.start_at then
    raise exception 'SLOT_STARTED' using errcode = 'P0001';
  end if;

  -- 學員自己改期才套用的規則（教練代改、同意請假改期不套用）
  if p_customer_rules then
    v_old_deadline := coalesce(
      v_old.cancel_deadline_at,
      v_old_slot.start_at - v_old_slot.cancel_deadline_hours * interval '1 hour'
    );
    if now() > v_old_deadline then
      raise exception 'PAST_CANCEL_DEADLINE' using errcode = 'P0001';
    end if;
    if v_old_slot.min_attendance >= 2
       and v_old_slot.formed_at is not null
       and public.slot_active_count(v_old_slot_id) - 1 < v_old_slot.min_attendance then
      raise exception 'GROUP_MIN_LOCKED' using errcode = 'P0001';
    end if;
    select tc.is_blocked into v_blocked
      from public.tenant_customers tc
     where tc.tenant_id = v_old.tenant_id and tc.customer_id = v_old.customer_id;
    if v_blocked then
      raise exception 'CUSTOMER_BLOCKED' using errcode = 'P0001';
    end if;
  end if;

  -- 新時段
  select s.id, s.tenant_id, s.service_id, s.status, s.start_at, s.end_at
    into v_new_slot
    from public.availability_slots s
   where s.id = p_new_slot_id;
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

  -- 這位學員在新時段：已有預約不可重複；被記過「學員臨時取消」不可再訂
  select b.status
    into v_prev
    from public.bookings b
   where b.slot_id = p_new_slot_id
     and b.customer_id = v_old.customer_id
     and (b.status <> 'cancelled' or b.cancel_category = 'late_cancel')
   order by (b.status <> 'cancelled') desc
   limit 1;
  if found then
    if v_prev.status <> 'cancelled' then
      raise exception 'ALREADY_BOOKED' using errcode = 'P0001';
    end if;
    raise exception 'LATE_CANCEL_NO_REBOOK' using errcode = 'P0001';
  end if;

  select sv.id, sv.max_capacity, sv.cancel_deadline_hours
    into v_service
    from public.services sv
   where sv.id = v_new_slot.service_id;

  if public.slot_taken_count(p_new_slot_id) >= v_service.max_capacity then
    raise exception 'SLOT_FULL' using errcode = 'P0001';
  end if;

  -- 新時段的上課時間不可晚於那筆購買的到期日（鎖定順序：時段 → 預約 → 購買）
  if v_old.purchase_id is not null then
    select cp.expires_at into v_p_expires
      from public.customer_purchases cp
     where cp.id = v_old.purchase_id
       for update;
    if v_p_expires is not null and v_p_expires < v_new_slot.start_at then
      raise exception 'PURCHASE_EXPIRES_BEFORE_CLASS' using errcode = 'P0001';
    end if;
  end if;

  v_new_deadline := v_new_slot.start_at - v_service.cancel_deadline_hours * interval '1 hour';

  -- 舊預約：取消（類別：改期；堂數處理：轉到新預約）
  update public.bookings
     set status = 'cancelled',
         cancelled_at = now(),
         cancelled_by = auth.uid(),
         cancel_category = 'rescheduled',
         cancel_reason = p_reason,
         cancel_actor_role = p_actor_role,
         class_disposition = 'transferred'
   where id = p_old_booking_id;

  -- 新預約：直接已確認（§7.1；學員自己改期依 §4.2，用堂數＝已確認）
  insert into public.bookings (
    tenant_id, slot_id, customer_id, service_id, status, customer_notes,
    purchase_id, cancel_deadline_at, rescheduled_from_booking_id
  ) values (
    v_new_slot.tenant_id, p_new_slot_id, v_old.customer_id, v_new_slot.service_id,
    'confirmed', v_old.customer_notes,
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
    'booking.rescheduled_out', auth.uid(), p_actor_role, p_reason,
    jsonb_build_object(
      'to_booking_id', v_new_booking.id,
      'to_slot_id', p_new_slot_id,
      'category', 'rescheduled',
      'disposition', 'transferred',
      'via', p_via
    )
  );
  perform public.log_activity(
    v_old.tenant_id, 'booking', v_new_booking.id, v_new_booking.id, v_old.customer_id,
    'booking.rescheduled_in', auth.uid(), p_actor_role, p_reason,
    jsonb_build_object(
      'from_booking_id', p_old_booking_id,
      'from_slot_id', v_old.slot_id,
      'cancel_deadline_at', v_new_deadline,
      'status', 'confirmed',
      'via', p_via
    )
  );

  -- 舊預約若還有審核中的請假申請 → 失效（同意請假改期時，申請已先改成同意，不會被這裡動到）
  perform public.void_pending_leave(p_old_booking_id, 'booking_rescheduled');

  v_formed := public.mark_slot_formed(p_new_slot_id);
  perform public.refresh_slot_status(v_old.slot_id);
  perform public.refresh_slot_status(p_new_slot_id);

  return v_new_booking;
end;
$$;

revoke execute on function public.reschedule_booking_core(uuid, uuid, text, text, boolean, text)
  from public, anon, authenticated;

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
  v_ctx record;
  v_actor_role text;
  v_reason text := nullif(regexp_replace(coalesce(p_reason, ''), '^[\s　]+|[\s　]+$', '', 'g'), '');
begin
  select b.customer_id, b.tenant_id, s.member_id
    into v_ctx
    from public.bookings b
    join public.availability_slots s on s.id = b.slot_id
   where b.id = p_old_booking_id;
  if not found then
    raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- 身分：學員本人，或 Owner／舊時段的助教（權限以舊時段為準，§7.1）
  if v_ctx.customer_id = auth.uid() then
    v_actor_role := 'customer';
  else
    v_actor_role := public.tenant_actor_role(v_ctx.tenant_id, v_ctx.member_id);
  end if;
  if v_actor_role is null then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  -- 教練代改期必填原因；學員自己改期免填
  if v_actor_role <> 'customer' and v_reason is null then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001';
  end if;
  if v_reason is not null and char_length(v_reason) > 500 then
    raise exception 'REASON_TOO_LONG' using errcode = 'P0001';
  end if;

  return public.reschedule_booking_core(
    p_old_booking_id, p_new_slot_id, v_actor_role, v_reason,
    v_actor_role = 'customer',   -- 取消期限與團班門檻只限制學員自己改期
    'direct'
  );
end;
$$;

revoke execute on function public.reschedule_booking(uuid, uuid, text) from public, anon;
grant execute on function public.reschedule_booking(uuid, uuid, text) to authenticated;

-- ============================================================================
-- 6. checkin_booking：簽到時讓審核中的請假申請失效（其餘與第 1 階段相同）
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

  perform public.void_pending_leave(p_booking_id, 'checked_in');

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
grant execute on function public.checkin_booking(uuid) to authenticated, service_role;

-- ============================================================================
-- 7. 人數不足自動取消
--    auto_cancel_group_slot：多一道「成過班就不取消」；退回改走 refund_class；請假申請失效。
--    auto_cancel_unformed_slots（新增）：挑出「到了取消期限仍未成班」的團班時段逐一取消，排程改呼叫這支。
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
  v_refund text;
  v_reason constant text := '人數不足，系統自動取消';
begin
  select s.id, s.tenant_id, s.service_id, s.member_id, s.start_at, s.status, s.formed_at
    into v_slot
    from public.availability_slots s
   where s.id = p_slot_id
     for update;
  if not found then
    raise exception 'SLOT_NOT_FOUND' using errcode = 'P0002';
  end if;
  -- 已經關閉過、或已經成過班 → 不取消（§6.4：已成班的時段不論人數如何變化都不自動取消）
  if v_slot.status = 'cancelled' or v_slot.formed_at is not null then
    return;
  end if;

  select sv.name into v_service_name from public.services sv where sv.id = v_slot.service_id;
  select m.user_id into v_member_user_id from public.tenant_members m where m.id = v_slot.member_id;

  for v_b in
    select b.id, b.customer_id, b.status
      from public.bookings b
     where b.slot_id = p_slot_id
       and b.status in ('pending', 'confirmed')
     order by b.id
       for update
  loop
    v_refund := public.refund_class(v_b.id, 'cancel_refund', null);

    update public.bookings
       set status = 'cancelled',
           cancelled_at = now(),
           cancelled_by = null,
           cancel_category = 'under_min',
           cancel_reason = v_reason,
           cancel_actor_role = 'system',
           class_disposition = 'refunded'
     where id = v_b.id;

    perform public.void_pending_leave(v_b.id, 'booking_cancelled');

    perform public.log_activity(
      v_slot.tenant_id, 'booking', v_b.id, v_b.id, v_b.customer_id,
      'booking.cancelled', null, 'system', v_reason,
      jsonb_build_object(
        'category', 'under_min',
        'disposition', 'refunded',
        'previous_status', v_b.status,
        'class_returned', v_refund = 'returned',
        'refund_result', v_refund
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
    jsonb_build_object('cancelled_bookings', v_count, 'cause', 'under_min')
  );
end;
$$;

revoke execute on function public.auto_cancel_group_slot(uuid) from public, anon, authenticated;
grant execute on function public.auto_cancel_group_slot(uuid) to service_role;

-- 時段層級的判定：到「開課時間 − 服務當下的取消期限時數」仍未成班（§6.3，不看個別預約上存的期限）
create or replace function public.auto_cancel_unformed_slots()
returns table (
  slot_id uuid,
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
  v_s record;
  v_r record;
begin
  for v_s in
    select s.id
      from public.availability_slots s
      join public.services sv on sv.id = s.service_id
     where s.status <> 'cancelled'
       and s.formed_at is null
       and sv.min_attendance >= 2
       and s.start_at > now()
       and s.start_at - sv.cancel_deadline_hours * interval '1 hour' <= now()
     order by s.start_at, s.id
  loop
    for v_r in select * from public.auto_cancel_group_slot(v_s.id)
    loop
      slot_id := v_s.id;
      affected_customer_id := v_r.affected_customer_id;
      affected_member_user_id := v_r.affected_member_user_id;
      service_name := v_r.service_name;
      slot_start_at := v_r.slot_start_at;
      return next;
    end loop;
  end loop;
end;
$$;

revoke execute on function public.auto_cancel_unformed_slots() from public, anon, authenticated;
grant execute on function public.auto_cancel_unformed_slots() to service_role;

-- ============================================================================
-- 8. close_slot（新增）：關閉時段
--    對每筆未上課的預約做一次「教練取消」（同一個原因）、退回，時段關閉（§7.3）。
--    Owner 或該時段的助教；開課後不可；已有學員簽到的時段不可。
--    回傳被取消的預約（給通知用）。沒有預約的時段可以不填原因。
-- ============================================================================
create or replace function public.close_slot(
  p_slot_id uuid,
  p_reason text default null
)
returns table (
  cancelled_booking_id uuid,
  cancelled_customer_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot record;
  v_actor_role text;
  v_reason text := nullif(regexp_replace(coalesce(p_reason, ''), '^[\s　]+|[\s　]+$', '', 'g'), '');
  v_b record;
  v_count int := 0;
  v_refund text;
begin
  select s.id, s.tenant_id, s.member_id, s.start_at, s.status
    into v_slot
    from public.availability_slots s
   where s.id = p_slot_id
     for update;
  if not found then
    raise exception 'SLOT_NOT_FOUND' using errcode = 'P0002';
  end if;

  v_actor_role := public.tenant_actor_role(v_slot.tenant_id, v_slot.member_id);
  if v_actor_role is null then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if v_slot.status = 'cancelled' then
    raise exception 'SLOT_ALREADY_CLOSED' using errcode = 'P0001';
  end if;
  if now() >= v_slot.start_at then
    raise exception 'SLOT_STARTED' using errcode = 'P0001';
  end if;
  -- 已有學員簽到（開課前 30 分鐘起可簽到）→ 不可整堂關閉
  if exists (
    select 1 from public.bookings b
     where b.slot_id = p_slot_id and b.status in ('completed', 'no_show')
  ) then
    raise exception 'SLOT_HAS_ATTENDANCE' using errcode = 'P0001';
  end if;

  -- 有預約要取消時，原因必填
  if exists (
    select 1 from public.bookings b
     where b.slot_id = p_slot_id and b.status in ('pending', 'confirmed')
  ) then
    if v_reason is null then
      raise exception 'REASON_REQUIRED' using errcode = 'P0001';
    end if;
  end if;
  if v_reason is not null and char_length(v_reason) > 500 then
    raise exception 'REASON_TOO_LONG' using errcode = 'P0001';
  end if;

  for v_b in
    select b.id, b.customer_id, b.status
      from public.bookings b
     where b.slot_id = p_slot_id
       and b.status in ('pending', 'confirmed')
     order by b.id
       for update
  loop
    v_refund := public.refund_class(v_b.id, 'cancel_refund', auth.uid());

    update public.bookings
       set status = 'cancelled',
           cancelled_at = now(),
           cancelled_by = auth.uid(),
           cancel_category = 'coach_cancelled',
           cancel_reason = v_reason,
           cancel_actor_role = v_actor_role,
           class_disposition = 'refunded'
     where id = v_b.id;

    perform public.void_pending_leave(v_b.id, 'booking_cancelled');

    perform public.log_activity(
      v_slot.tenant_id, 'booking', v_b.id, v_b.id, v_b.customer_id,
      'booking.cancelled', auth.uid(), v_actor_role, v_reason,
      jsonb_build_object(
        'category', 'coach_cancelled',
        'disposition', 'refunded',
        'previous_status', v_b.status,
        'class_returned', v_refund = 'returned',
        'refund_result', v_refund,
        'via', 'slot_closed'
      )
    );

    v_count := v_count + 1;
    cancelled_booking_id := v_b.id;
    cancelled_customer_id := v_b.customer_id;
    return next;
  end loop;

  update public.availability_slots
     set status = 'cancelled', updated_at = now()
   where id = p_slot_id;

  perform public.log_activity(
    v_slot.tenant_id, 'slot', p_slot_id, null, null,
    'slot.closed', auth.uid(), v_actor_role, v_reason,
    jsonb_build_object('cancelled_bookings', v_count, 'cause', 'coach')
  );
end;
$$;

revoke execute on function public.close_slot(uuid, text) from public, anon;
grant execute on function public.close_slot(uuid, text) to authenticated;

-- ============================================================================
-- 9. 現存時段補上成班時間（純資料；必須跟上面的函式同一次執行）
--    自動取消從這個檔開始改看「有沒有成班時間」。上線當下人數已達開班人數的團班時段
--    如果沒有同時補上成班時間，會在下一次排程（5 分鐘內）被誤判為未成班而整堂取消。
--    可重複執行：只補還沒有成班時間的時段。
--
--    執行前預覽（會被補上成班時間的時段）：
--      select s.id, s.start_at, sv.name, sv.min_attendance,
--             (select count(*) from public.bookings b
--               where b.slot_id = s.id and b.status in ('pending', 'confirmed')) as active
--        from public.availability_slots s join public.services sv on sv.id = s.service_id
--       where sv.min_attendance >= 2 and s.formed_at is null
--         and s.status <> 'cancelled' and s.start_at > now()
--         and (select count(*) from public.bookings b
--               where b.slot_id = s.id and b.status in ('pending', 'confirmed')) >= sv.min_attendance;
-- ============================================================================
with f as (
  update public.availability_slots s
     set formed_at = now()
    from public.services sv
   where sv.id = s.service_id
     and sv.min_attendance >= 2
     and s.formed_at is null
     and s.status <> 'cancelled'
     and s.start_at > now()
     and (
       select count(*) from public.bookings b
        where b.slot_id = s.id and b.status in ('pending', 'confirmed')
     ) >= sv.min_attendance
  returning s.id, s.tenant_id
)
insert into public.activity_log (
  tenant_id, subject_type, subject_id, booking_id, customer_id,
  event, actor_user_id, actor_role, detail
)
select f.tenant_id, 'slot', f.id, null, null,
       'slot.formed', null, 'system',
       jsonb_build_object('trigger', 'p2_conversion')
  from f;

-- ============================================================================
-- 回滾用（先重新執行 20261126100300_bfv2_p1_functions.sql，再執行下面這段）
-- ============================================================================
-- drop function if exists public.close_slot(uuid, text);
-- drop function if exists public.auto_cancel_unformed_slots();
-- drop function if exists public.late_cancel_booking(uuid, text);
-- drop function if exists public.reschedule_booking_core(uuid, uuid, text, text, boolean, text);
-- drop function if exists public.void_pending_leave(uuid, text);
-- drop function if exists public.refund_class(uuid, text, uuid);
-- drop function if exists public.platform_setting_int(text);
-- drop function if exists public.mark_slot_formed(uuid);
-- drop function if exists public.refresh_slot_status(uuid);
-- drop function if exists public.slot_formation_info(uuid);
-- drop function if exists public.slot_active_count(uuid);
-- 注意：book_with_purchase 的回傳欄位不同，重新執行第 1 階段的檔之前要先
--   drop function if exists public.book_with_purchase(uuid, uuid, text, uuid);
