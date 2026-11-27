-- ============================================================================
-- 推播偏好整合成一份（站內通知 B；純資料，只做一次）
-- 【草稿，尚未執行；需 terry 同意後由 terry 執行】不改任何資料表結構。
-- 執行時機：站內通知 B 的 PR 合併部署「前一刻」。跑完立刻部署。
--
-- 白話說明：
--   現況：同一位使用者的推播設定有兩份，存在 notification_preferences 同一列的不同欄位——
--     A. 四個舊開關（有作用，學員端畫面在改）：
--          booking_status_changes_enabled 預約狀態變更
--          pre_event_enabled              課前提醒
--          daily_reminder_enabled         每日提醒
--          weekly_summary_enabled         每週摘要
--     B. 勾選表（沒有作用，教練端畫面在改）：channels 這個 JSON 欄位裡的 web_push 一組，
--        每個事件一個開關。
--   terry 2026-11-26 決定：整合成一份，以勾選表（B）為唯一來源；四個舊開關轉進去之後停用。
--
--   這個檔做的事：把 A 的值搬進 B。對每一位有設定紀錄的使用者、每一個事件：
--       新的值 ＝ 「對應的舊開關是開的」而且「勾選表原本不是關的」
--     也就是「關的優先」：任何一邊關過，轉換後就是關。
--       * 學員以前用舊開關關掉的通知 → 轉換後仍然是關（不會被打開）。
--       * 教練以前在勾選表關掉、但一直沒有作用的勾選 → 轉換後開始有作用。
--         （terry 2026-11-26 決定採用「關的優先」。上線時要公告提醒教練：
--           先前在推播偏好關掉的項目會開始生效。）
--   舊開關對應到哪些事件：
--       預約狀態變更 → 新預約、預約已確認、預約取消、預約改期、購買申請、購買申請結果、請假申請
--       課前提醒 → 課前提醒；每日提醒 → 每日提醒；每週摘要 → 每週摘要
--
--   不動的東西：
--     * 四個舊開關的欄位與值都留著（新版程式不再讀寫；之後確定不需要退版時可以另外清掉）。
--     * 每日提醒的時間 daily_reminder_hour、課前提醒的分鐘數 pre_event_minutes：這兩個是參數不是開關，
--       繼續沿用原欄位。
--     * 勿擾時段 quiet_hours_start／quiet_hours_end：沿用原欄位。
--     * channels 裡沒有作用的 in_app 一組：留著不讀。
--     * 沒有設定紀錄的使用者：不新增紀錄，維持「全部開」。
--
--   只做一次：做完寫記號 notification_prefs_unified_at，重跑會跳過。
--   （不能重跑的原因：轉換後使用者會在新畫面改設定，重跑會用早就不準的舊開關把人家重新關掉。）
--
-- 轉換前預覽（請先跑，看會影響多少人）：
--   -- A. 兩邊各有多少人關過東西
--   select
--     count(*) as users_with_prefs,
--     count(*) filter (where not booking_status_changes_enabled) as legacy_booking_off,
--     count(*) filter (where not pre_event_enabled)              as legacy_pre_event_off,
--     count(*) filter (where not daily_reminder_enabled)         as legacy_daily_off,
--     count(*) filter (where not weekly_summary_enabled)         as legacy_weekly_off,
--     count(*) filter (where exists (
--       select 1 from jsonb_each(coalesce(channels -> 'web_push', '{}'::jsonb)) e
--        where e.value = 'false'::jsonb))                         as matrix_any_off,
--     count(*) filter (where quiet_hours_start is not null and quiet_hours_end is not null)
--                                                                as with_quiet_hours
--     from public.notification_preferences;
--   -- matrix_any_off 與 with_quiet_hours 的人：以前設了沒效，新版上線後會開始生效。
--
--   -- B. 逐人逐事件看轉換結果（只列「轉換後是關」的）
--   select np.user_id, m.event_key, m.legacy_on,
--          coalesce((np.channels -> 'web_push' ->> m.event_key)::boolean, true) as matrix_on
--     from public.notification_preferences np
--     cross join lateral (values
--       ('booking_created',     np.booking_status_changes_enabled),
--       ('booking_confirmed',   np.booking_status_changes_enabled),
--       ('booking_cancelled',   np.booking_status_changes_enabled),
--       ('booking_rescheduled', np.booking_status_changes_enabled),
--       ('package_request',     np.booking_status_changes_enabled),
--       ('package_approved',    np.booking_status_changes_enabled),
--       ('leave_request',       np.booking_status_changes_enabled),
--       ('pre_event',           np.pre_event_enabled),
--       ('daily_reminder',      np.daily_reminder_enabled),
--       ('weekly_summary',      np.weekly_summary_enabled)
--     ) as m(event_key, legacy_on)
--    where not (m.legacy_on
--               and coalesce((np.channels -> 'web_push' ->> m.event_key)::boolean, true))
--    order by np.user_id, m.event_key;
--
-- 轉換後驗證：
--   -- 舊開關是關、勾選表卻是開的（應該 0 列）
--   select np.user_id, m.event_key
--     from public.notification_preferences np
--     cross join lateral (values
--       ('booking_created',     np.booking_status_changes_enabled),
--       ('booking_confirmed',   np.booking_status_changes_enabled),
--       ('booking_cancelled',   np.booking_status_changes_enabled),
--       ('booking_rescheduled', np.booking_status_changes_enabled),
--       ('package_request',     np.booking_status_changes_enabled),
--       ('package_approved',    np.booking_status_changes_enabled),
--       ('leave_request',       np.booking_status_changes_enabled),
--       ('pre_event',           np.pre_event_enabled),
--       ('daily_reminder',      np.daily_reminder_enabled),
--       ('weekly_summary',      np.weekly_summary_enabled)
--     ) as m(event_key, legacy_on)
--    where not m.legacy_on
--      and coalesce((np.channels -> 'web_push' ->> m.event_key)::boolean, true);
--   select key, value from public.platform_settings where key = 'notification_prefs_unified_at';  -- 1 列
--
-- 還原：
--   四個舊開關的值沒有被動到，所以程式退版後行為與轉換前完全相同，不需要還原資料。
--   勾選表被改過的值沒辦法逐筆復原（被改掉的都是以前沒有作用的值）。
--   要重新轉換時：delete from public.platform_settings where key = 'notification_prefs_unified_at';
-- ============================================================================

do $$
begin
  if exists (select 1 from public.platform_settings where key = 'notification_prefs_unified_at') then
    raise notice '已整合過，跳過';
    return;
  end if;

  update public.notification_preferences np
     set channels = jsonb_set(
           coalesce(np.channels, '{}'::jsonb),
           '{web_push}',
           coalesce(np.channels -> 'web_push', '{}'::jsonb) || (
             select jsonb_object_agg(
                      m.event_key,
                      -- ★ 關的優先：舊開關是開的，而且勾選表原本不是關的
                      m.legacy_on
                        and coalesce((np.channels -> 'web_push' ->> m.event_key)::boolean, true)
                    )
               from (values
                 ('booking_created',     np.booking_status_changes_enabled),
                 ('booking_confirmed',   np.booking_status_changes_enabled),
                 ('booking_cancelled',   np.booking_status_changes_enabled),
                 ('booking_rescheduled', np.booking_status_changes_enabled),
                 ('package_request',     np.booking_status_changes_enabled),
                 ('package_approved',    np.booking_status_changes_enabled),
                 ('leave_request',       np.booking_status_changes_enabled),
                 ('pre_event',           np.pre_event_enabled),
                 ('daily_reminder',      np.daily_reminder_enabled),
                 ('weekly_summary',      np.weekly_summary_enabled)
               ) as m(event_key, legacy_on)
           ),
           true
         );

  insert into public.platform_settings (key, value)
  values ('notification_prefs_unified_at', to_jsonb(now()));
end
$$;
