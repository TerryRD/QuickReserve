-- ============================================================================
-- 預約流程改版 v2 / P1 — Migration 5：防線
-- 可重複執行。必須在 Migration 4 之後執行。
-- ============================================================================

-- 1. 補抓 Migration 3 之後才被舊函式取消的預約
update public.bookings
   set cancel_category = 'legacy'
 where status = 'cancelled'
   and cancel_category is null;

-- 2. 取消紀錄一致性
alter table public.bookings drop constraint if exists bookings_cancel_record_check;
alter table public.bookings add constraint bookings_cancel_record_check
  -- 用 case 寫，確保每個分支都得到 true／false。
  -- （用 or 串接時，取消類別為 null 會讓整個式子變成 null，而 check 遇到 null 視為通過。）
  check (
    case
      -- 未取消：不得有取消紀錄
      when status <> 'cancelled' then
        cancel_category is null
        and cancel_actor_role is null
        and class_disposition is null
      -- 已取消：一定要有類別
      when cancel_category is null then false
      -- 已取消的舊資料：只有類別
      when cancel_category = 'legacy' then true
      -- 已取消的新資料：取消人身分、堂數處理都要有
      else cancel_actor_role is not null and class_disposition is not null
    end
  );

-- 3. 預約只能經由資料庫函式新增與修改
drop policy if exists bookings_insert on public.bookings;
drop policy if exists bookings_update on public.bookings;
