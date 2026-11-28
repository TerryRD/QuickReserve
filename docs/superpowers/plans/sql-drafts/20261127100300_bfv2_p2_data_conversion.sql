-- ============================================================================
-- 預約流程改版 v2 / P2 — Migration 4：既有資料轉換（純資料，只做一次）
-- 【草稿，尚未執行；需 terry 同意後由 terry 執行】
-- 前置：20261126120000（站內通知欄位）、20261127100000、20261127100100 已執行。
--
-- 白話說明（設計文件 §16）：
--   尚未開課的「待確認」預約 → 改成「已確認」，並在預約歷程記一筆「系統轉換」。
--   第 2 階段起用堂數預約一律直接成立；現存的待確認都是「還沒達開班人數的團班」預約。
--   不發推播；改成替每位學員寫一筆站內通知（terry 2026-11-26 決議），鈴鐺的未讀數字會 +1，
--   點進去是那筆預約的明細頁。
--   已經過了上課時間卻還停在待確認的預約：第一段不動它們。
--   檔案最下方的第二段專門處理這種預約：以人數不足（系統）取消並退回堂數（terry 2026-11-26 決定要做）。
--
--   （現存時段補成班時間不在這個檔：它必須跟函式同一次執行，已放在 20261127100100 的最後一段。）
--
--   只做一次：做完會在平台設定寫一個記號（bfv2_p2_converted_at）。重跑時看到記號就整段跳過，
--   避免第 3 階段之後把「真的需要教練確認」的待確認預約也改掉。
--
-- 執行前預覽（terry 先跑，確認數字合理）：
--   -- A. 會被改成已確認的預約
--   select b.id, b.customer_id, s.start_at, sv.name
--     from public.bookings b
--     join public.availability_slots s on s.id = b.slot_id
--     join public.services sv on sv.id = b.service_id
--    where b.status = 'pending' and s.start_at > now()
--    order by s.start_at;
--   -- B. 已過上課時間卻還是待確認的預約（這次不動，列出來給 terry 決定）
--   select b.id, b.customer_id, s.start_at
--     from public.bookings b join public.availability_slots s on s.id = b.slot_id
--    where b.status = 'pending' and s.start_at <= now();
--
-- 執行後驗證：
--   select count(*) from public.bookings b join public.availability_slots s on s.id = b.slot_id
--    where b.status = 'pending' and s.start_at > now();                                -- 預期 0
--   select key, value from public.platform_settings where key = 'bfv2_p2_converted_at'; -- 1 列
--   select count(*) from public.notification_log
--    where channel = 'in_app' and body like '系統改版調整：%';                          -- ＝被轉換的預約數
--
-- 回滾：無法自動還原（轉換前的狀態沒有另外保存）。需要時依歷程還原：
--   update public.bookings b set status = 'pending'
--    where b.status = 'confirmed'
--      and exists (select 1 from public.activity_log al
--                   where al.booking_id = b.id and al.event = 'booking.confirmed'
--                     and al.detail ->> 'trigger' = 'p2_conversion');
--   delete from public.notification_log where channel = 'in_app' and body like '系統改版調整：%';
--   delete from public.platform_settings where key = 'bfv2_p2_converted_at';
-- ============================================================================

do $$
begin
  if exists (select 1 from public.platform_settings where key = 'bfv2_p2_converted_at') then
    raise notice '已轉換過，跳過';
    return;
  end if;

  with upd as (
    update public.bookings b
       set status = 'confirmed'
      from public.availability_slots s
     where s.id = b.slot_id
       and b.status = 'pending'
       and s.start_at > now()
    returning b.id, b.tenant_id, b.customer_id, b.service_id, s.start_at
  ),
  logged as (
    insert into public.activity_log (
      tenant_id, subject_type, subject_id, booking_id, customer_id,
      event, actor_user_id, actor_role, detail
    )
    select upd.tenant_id, 'booking', upd.id, upd.id, upd.customer_id,
           'booking.confirmed', null, 'system',
           jsonb_build_object('auto', true, 'trigger', 'p2_conversion')
      from upd
    returning 1
  )
  -- 站內通知（不推播）：每位學員一筆，未讀
  insert into public.notification_log (
    user_id, type, related_id, channel, status, title, body, url
  )
  select upd.customer_id, 'booking_status', upd.id, 'in_app', 'sent',
         '預約已確認',
         '系統改版調整：你在 '
           || to_char(upd.start_at at time zone 'Asia/Taipei', 'MM/DD HH24:MI')
           || ' 的「' || sv.name || '」預約已改為已確認。',
         '/my-bookings/' || upd.id
    from upd
    join public.services sv on sv.id = upd.service_id;

  insert into public.platform_settings (key, value)
  values ('bfv2_p2_converted_at', to_jsonb(now()));
end
$$;

-- ============================================================================
-- 第二段：已過上課時間卻還停在「待確認」的舊預約 → 以「人數不足（系統）」取消並退回
--   terry 2026-11-26 決定：取消並退回堂數。這一段與上面的轉換各自獨立、各有自己的「只做一次」記號。
--
--   背景：2026-11-26 terry 跑預覽查詢 B 得到 1 筆——
--     預約 d00f3b93-6295-4b78-91a7-3659886ed924、學員 beac3794-3f24-4db8-a2ff-523c9355da33、
--     原上課時間 2026-06-02 06:00（UTC）。這堂課當時沒有成立，也沒有被自動取消，堂數一直被扣著。
--
--   這一段做什麼（只處理「上課時間已過」而且「狀態是待確認」的預約，不寫死上面那個 id）：
--     1. 退回 1 堂。原購買還沒過期 → 加回原購買；已過期 → 改發 1 堂補堂（到期日＝執行當下＋補堂寬限天數）。
--     2. 預約改成已取消：類別「人數不足」、取消人「系統」、堂數處理「退回」。
--     3. 寫預約歷程；有審核中的請假申請就讓它失效（這種舊資料不會有，保險起見）。
--     4. 依剩下的預約重算時段狀態（時段已過，只是讓資料一致）。
--     5. 替學員寫一筆站內通知（不推播）。
--   只做一次：做完寫記號 bfv2_p2_stale_pending_cleaned_at，重跑會跳過。
--
--   處理前預覽（會被取消的預約，以及它用的那筆購買現在的狀態）：
--     select b.id as booking_id, b.customer_id, s.start_at, sv.name as service_name,
--            cp.id as purchase_id, cp.classes_total, cp.classes_used, cp.expires_at,
--            (cp.expires_at is not null and cp.expires_at <= now()) as will_issue_makeup
--       from public.bookings b
--       join public.availability_slots s on s.id = b.slot_id
--       join public.services sv on sv.id = b.service_id
--       left join public.customer_purchases cp on cp.id = b.purchase_id
--      where b.status = 'pending' and s.start_at <= now();
--     -- will_issue_makeup = true：會發補堂；false：會加回原購買（classes_used 減 1）
--
--   處理後驗證：
--     select count(*) from public.bookings b join public.availability_slots s on s.id = b.slot_id
--      where b.status = 'pending' and s.start_at <= now();                       -- 預期 0
--     select b.id, b.status, b.cancel_category, b.cancel_actor_role, b.class_disposition, b.cancel_reason
--       from public.bookings b
--      where b.cancel_reason = '改版前未成班、當時未被自動取消，系統補取消';      -- 預期＝預覽的筆數
--     select id, origin, classes_total, classes_used, expires_at, source_booking_id
--       from public.customer_purchases
--      where origin = 'makeup' and source_booking_id in (
--        select id from public.bookings
--         where cancel_reason = '改版前未成班、當時未被自動取消，系統補取消');    -- 有發補堂才會有列
--
--   還原：沒有一鍵還原。要還原需逐筆把預約改回待確認、把退回的那 1 堂扣回或刪掉補堂，
--         而且堂數明細只能新增不能改——請確定要做再執行。
-- ============================================================================
do $$
declare
  v_b record;
  v_refund text;
  v_reason constant text := '改版前未成班、當時未被自動取消，系統補取消';
begin
  if exists (select 1 from public.platform_settings where key = 'bfv2_p2_stale_pending_cleaned_at') then
    raise notice '已處理過，跳過';
    return;
  end if;

  for v_b in
    select b.id, b.tenant_id, b.customer_id, b.slot_id, s.start_at, sv.name as service_name
      from public.bookings b
      join public.availability_slots s on s.id = b.slot_id
      join public.services sv on sv.id = b.service_id
     where b.status = 'pending'
       and s.start_at <= now()
     order by b.id
       for update of b
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
    perform public.refresh_slot_status(v_b.slot_id);

    perform public.log_activity(
      v_b.tenant_id, 'booking', v_b.id, v_b.id, v_b.customer_id,
      'booking.cancelled', null, 'system', v_reason,
      jsonb_build_object(
        'category', 'under_min',
        'disposition', 'refunded',
        'previous_status', 'pending',
        'class_returned', v_refund = 'returned',
        'refund_result', v_refund,
        'trigger', 'p2_stale_pending'
      )
    );

    insert into public.notification_log (
      user_id, type, related_id, channel, status, title, body, url
    ) values (
      v_b.customer_id, 'booking_status', v_b.id, 'in_app', 'sent',
      '預約已取消',
      '系統改版調整：你在 '
        || to_char(v_b.start_at at time zone 'Asia/Taipei', 'YYYY/MM/DD HH24:MI')
        || ' 的「' || v_b.service_name || '」當時人數不足沒有開課，'
        || case v_refund
             when 'makeup' then '原本的堂數已過期，已改發補堂 1 堂。'
             when 'returned' then '已退回 1 堂。'
             else '這筆預約已取消。'
           end,
      '/my-bookings/' || v_b.id
    );
  end loop;

  insert into public.platform_settings (key, value)
  values ('bfv2_p2_stale_pending_cleaned_at', to_jsonb(now()));
end
$$;
