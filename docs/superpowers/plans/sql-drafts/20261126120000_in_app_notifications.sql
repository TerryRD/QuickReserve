-- ============================================================================
-- 站內通知（預約流程改版 v2 / P2 的第二組任務，可單獨上線）
-- 【草稿，尚未執行；需 terry 同意後由 terry 執行】可重複執行。只新增欄位，不動既有資料。
-- 不依賴第 2 階段其他 SQL。
--
-- 白話說明：
--   現況：通知紀錄表 notification_log 只記「發過哪一類推播、什麼時候、成功沒」，
--   沒有標題與內文；而且使用者沒開推播或關掉那一類通知時，連紀錄都不寫。
--   所以沒辦法拿它來做「鈴鐺＋通知清單」。
--
--   這次加 3 個欄位，讓每一則通知不論有沒有推播出去，都留下一筆看得懂的站內紀錄：
--     title  標題
--     body   內文
--     url    點了要去哪一頁（站內路徑，例如 /my-bookings/<預約 id>）
--   「已讀時間」read_at 與「未讀」用的索引今年 5 月已經有了，不用再加。
--
--   舊紀錄的這 3 欄是空的；畫面遇到空的就照舊只顯示通知類型。
--
--   誰讀得到、誰能寫，規則都不變：
--     讀：只有自己（與平台管理員）
--     改：只有自己（用來標為已讀）
--     新增：只有後端（service role）
--
-- 執行後驗證：
--   select column_name, is_nullable from information_schema.columns
--    where table_schema = 'public' and table_name = 'notification_log'
--      and column_name in ('title', 'body', 'url');          -- 3 列，皆可空
--
-- 回滾（新版程式先退版）：
--   alter table public.notification_log
--     drop constraint if exists notification_log_url_internal_check,
--     drop column if exists title,
--     drop column if exists body,
--     drop column if exists url;
-- ============================================================================

alter table public.notification_log
  add column if not exists title text,
  add column if not exists body text,
  add column if not exists url text;

comment on column public.notification_log.title is '站內通知的標題（舊紀錄為空）';
comment on column public.notification_log.body is '站內通知的內文（舊紀錄為空）';
comment on column public.notification_log.url is '點通知要前往的站內路徑，一定以 / 開頭（舊紀錄為空）';

-- 連結只能是站內路徑，避免通知被拿來導向站外
alter table public.notification_log drop constraint if exists notification_log_url_internal_check;
alter table public.notification_log add constraint notification_log_url_internal_check
  check (url is null or (url like '/%' and url not like '//%'));
