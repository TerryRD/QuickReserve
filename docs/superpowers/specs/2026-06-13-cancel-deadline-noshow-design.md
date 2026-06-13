# 取消期限退費 + 未到場標記 — 設計文件

- 日期：2026-06-13
- 狀態：已實作（2026-06-13）
- 目標：堂數退費改由「取消期限」唯一決定——期限內取消才退，超過期限取消或沒來都不退；並把「沒簽到」的預約主動標記為「未到場（no_show）」供教練做出勤紀錄。

---

## 1. 背景與最終規則

### 現況
- 預約成功 → `customer_purchases.classes_used += 1`（預約當下扣堂）。
- `cancel_booking` → `classes_used -= 1`（**無條件退**，不卡任何期限）。
- `checkin_booking` → 標 `completed`，不動堂數。
- 沒簽到 → 維持 `confirmed`，堂數照扣（不退），無標記。

### 最終規則（本次要達成）
| 情況 | 堂數 | 狀態 |
|------|------|------|
| 預約成功 | 扣 1 堂 | `pending`/`confirmed` |
| **期限內**取消（`now() ≤ start_at − cancel_deadline_hours`） | **退還 1 堂** | `cancelled` |
| **超過期限**才取消（仍允許取消、釋出時段） | **不退** | `cancelled` |
| 沒簽到（過了 `end_at` 仍 `confirmed` 未簽到） | **不退**（本來就沒退過） | `no_show` |
| 有簽到 | 扣著 | `completed` |
| **教練 / 平台 admin** 主動取消 | **一律退還**（不可抗力，不卡學員期限） | `cancelled` |

> 釐清：「沒簽到不退」**不是獨立規則**，是「沒在期限內取消」的自然結果（堂數預約時已扣、且未在期限內退）。因此 no_show 排程**完全不碰堂數**，唯一作用是加上「未到場」標記。
>
> 釐清：扣堂時點維持「預約當下」，簽到只確認出席。最初口語的「簽到才扣課」並未實作，這才是實際採用的（罰則版）。

### 一致套用
個別課（1v1/1v2）、團體課、試上一律適用同規則，不特例。團體課「人數不足系統自動取消並退」是另一條既有路徑（系統發起、一律退），不受本次影響。

---

## 2. 資料模型變更

`bookings.status` 新增 `no_show`：
```sql
-- 既有 CHECK 為 inline 自動命名；用 do-block 查實際名稱後 drop 再重建。
alter table public.bookings drop constraint <existing_status_check>;
alter table public.bookings
  add constraint bookings_status_check
  check (status in ('pending', 'confirmed', 'completed', 'cancelled', 'no_show'));
```
無其他欄位變更。`no_show` 是終態（與 `cancelled`/`completed` 同級）。

---

## 3. `cancel_booking` RPC：卡取消期限

在現有 `cancel_booking`（`supabase/migrations/20260529140000_group_slot_lifecycle_fix.sql` 的版本）加入退費條件：

1. 取 booking + 連 slot 的 `start_at`、連 service 的 `cancel_deadline_hours`。
2. 擁有權檢查同現況（customer / member / admin）。
3. 終態擋下：`status in ('cancelled','completed','no_show')` → `INVALID_STATE`。
4. **退費判斷**：
   - 若取消者為 **member 或 platform admin** → `v_refund := true`（一律退）。
   - 否則（學員本人取消）→ `v_refund := now() <= start_at - (cancel_deadline_hours || ' hours')::interval`。
5. `if v_refund then` 才 `classes_used -= 1`。
6. booking → `cancelled`、重建 slot 狀態（同現況）。
7. **回傳值**加 `refunded boolean`，讓前端能即時顯示「已退還 / 未退還」。

> 超過期限**仍允許取消**（釋出時段），只是不退。

---

## 4. 未到場掃描（沿用現有 cron）

不另開 cron。擴充現有每分鐘的 `/api/cron/checkin-reminder`（pg_cron 已驅動），新增一段純標記掃描：

```
找出 bookings where status='confirmed' and checked_in_at is null
  and slot.end_at < now() and slot.end_at > now() - interval '30 days'
→ update status = 'no_show'
```
- **不動 `classes_used`**（堂數已在預約時扣、未退；no_show 只是標記）。
- 標記後該筆不再是 `confirmed`，不會再觸發「未簽到」提醒，也不會被重複掃。
- 30 天下界只為避免首次執行掃過久遠資料；標記後天然離開集合。
- slot 不動（課已過）。
- 回傳值加 `noShowMarked` 計數供觀測。

---

## 5. 前端

1. **狀態徽章** `src/components/ui/badge.tsx`（`StatusBadge` / `StatusType`）：新增 `no_show`，標籤「未到場」，樣式比照 `cancelled`（灰/弱化）。
2. **學員「我的預約」** `src/app/(customer)/my-bookings/my-bookings-content.tsx`：
   - `BookingRow.status` 已是 string，分組 `groupKey` 把 `no_show` 歸「已過」。
   - 完成狀態文案區分：`no_show` 顯示「未到場 · 未退還堂數」。
3. **取消鈕** `src/app/(customer)/my-bookings/cancel-button.tsx`（`CancelMyBookingButton`）：
   - 新增 prop：是否在退費期限內（由 content 端用 `start_at` + service `cancel_deadline_hours` 算）。
   - 期限內：確認文案維持「取消後時段釋出…」。
   - **超過期限**：確認文案改為「⚠️ 已超過免費取消期限，取消將**不退還**此堂課，仍要取消嗎？」。
   - content 的 bookings 查詢需補 `services(cancel_deadline_hours)`。
4. **教練端**（`bookings` / `calendar` 列表）：狀態顯示走同一個 `StatusBadge`，自動支援 `no_show`；確認列表/篩選不會把 `no_show` 當成 `confirmed`。

---

## 6. 邊界與預設

- 超過期限**允許取消但不退**（非禁止取消）。
- 教練 / admin 取消一律退（不可抗力）。
- no_show 為終態；已 `no_show` 的預約不可再取消（RPC 擋下）。
- 團體課人數不足的系統自動取消（`auto_cancel_group_slot`）維持一律退，不受影響。
- **為何 no_show 只掃 `confirmed`**：1v1（`min_attendance=1`）預約當下即 auto-confirm；團體課未達開班人數的 `pending` 預約，會由既有的 `auto-cancel-group-class` 排程在期限前自動取消並退費。因此到上課時間，預約不是 `confirmed` 就是已被取消——`pending` 不會殘留到課後，no_show 掃 `confirmed` 即足夠。
- 時區沿用 UTC 儲存、UTC+8 顯示。

---

## 7. 資安 / RLS

- `cancel_booking` 維持 `security definer` + 擁有權檢查；退費條件在函式內判斷，學員無法繞過期限。
- no_show 標記由 cron（service_role）執行，沿用 `/api/cron/checkin-reminder` 既有 Bearer 守門。
- DDL / migration 後跑 Supabase Security + Performance Advisor 並回報。

---

## 8. 測試

- **RPC `cancel_booking`（整合測試）**：
  - 學員期限內取消 → `refunded=true`、`classes_used` 減 1、status `cancelled`。
  - 學員超過期限取消 → `refunded=false`、`classes_used` 不變、status `cancelled`。
  - 教練取消（即使超過期限）→ `refunded=true`。
  - 終態（completed / no_show / cancelled）再取消 → `INVALID_STATE`。
- **no_show 掃描**：
  - confirmed + 未簽到 + 已過 end_at → 變 `no_show`、`classes_used` 不變。
  - confirmed + 已簽到（completed）→ 不動。
  - confirmed + 未到 end_at → 不動。
- **純函式（若抽出退費判斷）**：`shouldRefund(now, startAt, deadlineHours, isStaffCancel)` 單元測試（邊界：期限前一刻/後一刻、staff 永遠 true）。
- 全套 `npm test` / `typecheck` / `lint` 不回歸。

---

## 9. 交付清單

1. Migration：`bookings.status` 加 `no_show`。
2. Migration：`cancel_booking` 卡期限 + 回傳 `refunded`。
3. `/api/cron/checkin-reminder` route：加 no_show 掃描。
4. 純函式 `shouldRefund(...)` + 單元測試（前後端共用退費判斷）。
5. 前端：StatusBadge `no_show`、my-bookings 文案 + 取消鈕期限警示 + 查詢補 `cancel_deadline_hours`。
6. 型別重生（`no_show` 進 enum）。
7. 測試（§8）。
8. 文件：README 更新 + 第一批租戶 LINE 文案（堂數扣抵/取消/未到場段落）更新 + Advisor 回報。
