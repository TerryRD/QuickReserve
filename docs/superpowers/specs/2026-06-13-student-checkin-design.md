# 學員簽到機制 — 設計文件

- 日期：2026-06-13
- 狀態：已實作（2026-06-13）— pg_cron 排程待部署後設定
- 目標：學員「有來上課」要自己**簽到**；簽到即視為完課。教練端收到簽到通知；若上課時間到了學員仍未簽到，提醒開課教練、老闆與學員。

---

## 1. 目標與範圍

### 必達
- 學員可在自己的預約詳情頁**自助簽到**（信任制按鈕，不做 QR/定位）。
- 簽到 = 完課：booking 轉 `completed`，記錄 `checked_in_at`。
- 三個通知流（全部沿用現有 push 基礎設施）：
  1. **學員完成簽到** → 通知該堂課的開課教練。
  2. **課前 N 分鐘**（全店設定、預設 15、可關閉）→ 提醒學員記得簽到。
  3. **`start_at` 到、仍未簽到** → 提醒開課教練 + 老闆(owner) + 學員。
- 分鐘級提醒透過 **Supabase pg_cron**（免費、不依賴 Vercel 付費方案）驅動。
- 團班（`max_capacity > 1`）：每位學員各自簽到；給教練的「未簽到」提醒**整堂彙整成一則**。

### 不做（YAGNI）
- **簽退**：經討論移除。人到場簽到後幾乎不可能簽完即走，簽退徒增「忘記簽退」的尾巴問題。
- **合教模型 / 一堂課多教練**：實際情境（如桌球 A/B/C 桌）是「同時段多堂獨立課」＝多個獨立 slot，現有模型已能正確區分，無需新增關聯。
- **購買綁教練**：現況購買綁的是「服務 + tenant」，教練在學員預約特定 slot 時才決定。維持現狀。
- **自動 no-show 處理**：從未簽到的 booking v1 維持 `confirmed`，不自動標記/取消/退堂。之後再做出勤統計。
- Email 通道（依專案既有決定不做）。

### 關鍵前提（已查證）
- `bookings.slot_id` → `availability_slots.member_id` 是**單一明確**的開課教練；booking → 教練不靠時間配對，零歧義。
- `services`、`customer_purchases` 皆**未綁教練**。
- `tenants` 無獨立 settings 表，慣例直接加欄位（先前 contact/intro/hero 皆如此）。
- `pg_cron` (1.6.4)、`pg_net` (0.20.0)、`supabase_vault` (0.3.1) 在本專案（Supabase 免費方案）皆可用 / 已啟用。

---

## 2. 資料模型變更

### 2.1 `bookings` 加兩欄
```sql
alter table public.bookings
  add column checked_in_at timestamptz,            -- null = 未簽到
  add column checked_in_by uuid references auth.users(id);  -- 通常 = 學員 user_id；保留彈性供未來代簽
```
- 簽到時：`checked_in_at = now()`、`checked_in_by = auth.uid()`、`status = 'completed'`。
- 無破壞性變更；既有 `status` enum (`pending/confirmed/completed/cancelled`) 不動。

### 2.2 `tenants` 加課前提醒設定
```sql
alter table public.tenants
  add column checkin_reminder_minutes int default 15
    check (checkin_reminder_minutes is null or checkin_reminder_minutes >= 1);
-- null = 關閉課前提醒；>=1 = 課前該分鐘數提醒學員
```

---

## 3. 簽到動作（學員端）

### 3.1 可簽到時間窗
- 允許範圍：`start_at − 30 分鐘` ≤ `now()` ≤ `end_at`。
- 太早（>30 分前）按鈕不出現/不可按；課程結束後（> `end_at`）不可補簽。

### 3.2 RPC `checkin_booking(p_booking_id uuid)`
`security definer`，驗證後寫入。流程：
1. 取 booking + 連 slot（`start_at`/`end_at`）。
2. 驗證呼叫者 = 該 booking 的 `customer_id` 對應 user（擁有權）。
3. 驗證 booking 目前為 `confirmed`（已確認才可簽到）；非 `confirmed` → 回錯。
4. 驗證已簽到過則 → 回錯（冪等保護，避免重複）。
5. 驗證 `now()` 在時間窗內，否則回對應 errcode（太早 / 已逾時）。
6. 寫入 `checked_in_at = now()`、`checked_in_by = auth.uid()`、`status = 'completed'`。
7. 觸發「學員已簽到」通知（見 §4 流程 1）。

> errcode 依專案 RPC 約定（見 error-handling 規範）回 `PXXXX` 自訂碼，前端對應友善訊息。

### 3.3 前端
- 學員預約詳情頁：在時間窗內顯示「簽到」按鈕；簽到後顯示「已於 HH:mm 簽到」狀態。
- 走現有 server action / RPC 呼叫慣例 + 樂觀更新 + toast。

---

## 4. 通知流

全部沿用 `src/lib/push.ts` 的 `pushToUser()` 與 `notification_log` 去重，新增通知 `type`：

| # | 觸發 | 對象 | type | related_id | 內容範例 |
|---|------|------|------|-----------|---------|
| 1 | 學員完成簽到（RPC 內） | 開課教練 `slot.member_id` 的 user | `checkin_done` | booking_id | 「○○○ 已簽到（□□ 課）」 |
| 2 | 課前 N 分（cron） | 學員本人 | `checkin_reminder` | booking_id | 「記得簽到：□□ 課 HH:mm 開始」 |
| 3 | `start_at` 到仍未簽（cron） | 開課教練 + owner + 學員 | `checkin_missing` | booking_id（教練彙整則用 slot_id） | 學員：「您尚未簽到」／教練：「○○○ 尚未簽到」 |

### 4.1 對象計算
- **開課教練**：`availability_slots.member_id` → `tenant_members.user_id`。
- **老闆**：該 tenant 內 `role = 'owner'` 的 `tenant_members.user_id`。
- 若開課教練本人就是 owner → 去重後只發一則（`pushToUser` + log 天然去重）。

### 4.2 團班彙整（流程 3）
- 同一 slot 多筆未簽到 booking：給**教練/老闆**的提醒**每 slot 彙整一則**（「N 位未簽到：A、B、C」），related_id 用 slot_id 去重。
- 給**學員**的提醒仍各自一則（related_id = booking_id）。

### 4.3 去重
- 每則提醒以 `notification_log` 的 `(user_id, type, related_id, scheduled_for)` 唯一鍵去重，確保只發一次。

---

## 5. 排程架構（pg_cron + pg_net）

```
Supabase pg_cron（* * * * *，每分鐘）
   └─ pg_net.http_post ──▶ POST /api/cron/checkin-reminder
                              headers: { Authorization: Bearer <CRON_SECRET 取自 Vault> }
   /api/cron/checkin-reminder：
     1. 驗證 Authorization（與既有 cron route 相同守門）
     2. 查「課前 N 分」應提醒的 confirmed 未簽到 booking（依各 tenant 的 checkin_reminder_minutes）
     3. 查「now() 已過 start_at、仍未簽到」的 confirmed booking（彙整 per slot）
     4. 沿用 pushToUser 發流程 2、3 的推播
```

### 5.1 一次性 migration
- `create extension pg_cron; create extension pg_net;`（若未啟用）。
- 用 `vault.create_secret` 存 cron 端點 base URL 與 cron secret。
- `cron.schedule('checkin-reminder', '* * * * *', $$ ... net.http_post(...) $$)`。

### 5.2 守門
- `/api/cron/checkin-reminder` 沿用既有 cron route 的 `CRON_SECRET` Bearer 驗證，拒絕未授權呼叫。

### 5.3 鋪路（非本次範圍）
- 此每分鐘 tick 之後可順帶復活目前**未被排程**的 `pre-event-reminder` route（本次不做，但機制共用）。

---

## 6. 邊界與預設

- **從未簽到**：booking 維持 `confirmed`（非 `completed`）；不自動 no-show。教練可從未簽到狀態自行判讀。
- **課前提醒關閉**：tenant `checkin_reminder_minutes = null` → 跳過流程 2，流程 3 仍照常。
- **重複簽到**：RPC 冪等保護，第二次回錯不重複轉狀態 / 不重複通知。
- **時區**：沿用現有 UTC 儲存、UTC+8 顯示。
- **效能**：cron route 查詢以 `start_at` + `status` + `checked_in_at is null` 過濾，需確認 `bookings`/`slots` 既有索引足以支撐每分鐘查詢（必要時加部分索引）。

---

## 7. RLS / 資安

- RPC `checkin_booking` 為 `security definer`，內部嚴格驗證擁有權（呼叫者必須是該 booking 的學員），不可代簽他人。
- 新欄位 `checked_in_at` / `checked_in_by` 的讀取沿用 `bookings` 既有 RLS（學員看自己的、教練看自己 tenant 的）。
- cron secret 存於 Vault，不入 repo / 不入 client。
- DDL/migration 後跑 Supabase Security + Performance Advisor 並回報。

---

## 8. 測試

- **單元**：
  - 時間窗驗證（太早 / 窗內 / 逾時）。
  - 狀態轉換（confirmed→completed；非 confirmed 拒絕；重複簽到拒絕）。
  - 通知對象計算（教練=owner 時去重；staff 開課時 教練+owner 兩人）。
  - 團班彙整（N 位未簽到 → 教練一則、學員各一則）。
- **RPC 測試**：擁有權（他人 booking 拒絕）、冪等、時間窗 errcode。
- **cron route 測試**：給定 fixture bookings（不同 `start_at`、簽到狀態、tenant 設定），斷言發出的通知集合正確、去重正確。

---

## 9. 交付清單（供實作計畫拆解）

1. Migration：`bookings` 兩欄 + `tenants.checkin_reminder_minutes`。
2. Migration / SQL：`checkin_booking` RPC。
3. Migration：啟用 pg_cron/pg_net + Vault secret + cron schedule。
4. `/api/cron/checkin-reminder` route + 查詢邏輯。
5. 通知：新增 `checkin_done` / `checkin_reminder` / `checkin_missing` type 的 dispatch（沿用 pushToUser）。
6. 前端：學員預約詳情頁簽到按鈕 + 狀態。
7. tenant 設定 UI：課前提醒分鐘數（預設 15 / 可調 / 關閉）。
8. 測試（§8）。
9. 文件更新（README 通知章節 / 本 spec 標記完成）+ Advisor 回報。
