# 預約流程改版 v2 — 第 1 階段（P1 基礎）實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓每一個會改變預約或堂數的動作都留下「誰、何時、做了什麼、為什麼」，取消一律要有原因與取消紀錄，取消期限固定在預約上，並把全站用語換成設計文件 §2 的唯一用語。

**Architecture:** 沿用現有模式（設計文件 §14.1 做法 A）：規則全部放在 `security definer` 資料庫函式，同一交易內寫入歷程表 `activity_log` 與堂數異動明細 `class_ledger`。P1 只新增三張表與 `bookings`／`customer_purchases` 的少數欄位，改寫六支既有函式並新增一支系統函式；畫面只做改名、取消原因輸入、預約明細頁（含歷程）。

**Tech Stack:** Next.js 15 App Router、TypeScript、next-safe-action、zod、Supabase PostgreSQL（RLS、security definer RPC、pg_cron）、vitest。

**Spec:** `docs/superpowers/specs/2026-11-25-booking-flow-v2-design.md`（P1 範圍看 §18；其餘章節是 P1 必須相容的最終樣貌）

**前提：**
- PR #22（`fix/booking-guard-fixes`，commit 28b244b，新增 `supabase/migrations/20261125100000_booking_guard_fixes.sql`）與 PR #23（排版）已合併進 master。所有實作分支以合併後的 master 為基底。**#23 會重排大量檔案，未合併前不要開工，否則每條線都會衝突。**
- 本計畫的 migration 時間戳為 `202611261000xx`，晚於 #22。若合併時 master 已有更晚的 migration，五個檔案一起改成更晚的時間戳，順序不變。

**專案慣例（已在 repo 內核對）：**
- RPC 寫法：`language plpgsql security definer set search_path = public`；錯誤用 `raise exception '<代碼>' using errcode = '42501' | 'P0001' | 'P0002'`。
- 整合測試：`tests/integration/*.test.ts`，`// @vitest-environment node`，用 service role 建立測試租戶與資料、用 anon key 登入的 client 呼叫 RPC，`afterAll` 刪掉租戶。範本：`tests/integration/cancel-booking-deadline.test.ts`。**整合測試連的是 `.env.local` 指向的 Supabase（會寫入資料），必須等 terry 執行完 migration 並明確同意後才跑**（見「風險與未決事項」R2）。
- Server Action：`actionClient.inputSchema(zod).action(...)`，錯誤丟 `AppError(code, 中文訊息)`。
- 這個專案不強制 TDD：每個任務列出「要補的測試」與「驗證指令」，不要求先寫失敗測試。
- **不 commit、不 push、不切分支**，除非 terry 明確指示（全域規則 B7.1）。每個任務的最後一步是「回報改了哪些檔案」，不是 commit。
- **SQL 一律由 terry 審閱後親自執行**（B2.4）。實作代理只把 SQL 寫成 migration 檔，不得執行任何 Supabase 指令。

## Global Constraints

- 畫面、通知、手冊、錯誤訊息一律使用設計文件 §2 的畫面用語。禁用詞：**套裝、課卡、方案（指預購堂數時）、已完成、未到場**。本計畫另把「套票」視為同類一併清除。
- 代碼不變：`completed`、`no_show`、`pending_review`、`confirmed`、`rejected`、`service_packages`、`customer_purchases` 都不改名，只改畫面用語。
- 購買申請的 `confirmed` 在畫面上一律稱「**已核准**」，不得出現「已確認」。
- 學員端永遠只出現「教練」，不出現 Owner／助教。
- 給使用者看的文字不得含錯誤代碼、欄位名或資料庫原始錯誤訊息（B1.3）。未知錯誤一律顯示「操作失敗，請稍後再試」。
- 每個新寫或改寫的資料庫函式，一開始就照 §12 最終權限：**助教只能動自己時段的預約；平台管理員不可代為操作**。
- **P1 過渡行為**：學員過了取消期限仍可取消，記為取消類別 `customer` ＋ 堂數處理 `forfeited`（不退回）。P2 才改成擋下並導向請假申請。
- P1 不做：請假申請、成班（`formed_at`）、移除成班自動確認、到期檢查、補堂、單堂預約、點名／待點名／改判、異議、購買撤回／作廢。
- 數值不寫死：取消期限時數取自 `services.cancel_deadline_hours`；常用取消原因取自 `platform_settings`。
- 全文與所有新增文字用繁體中文（台灣用語），不得出現簡體字或日文漢字。

## Review Focus

以下五種情況設計文件有暗示、但容易沒被測到，各自已掛到負責任務的測試裡：

1. **原因只有空白字元**（`'   '`、換行）——應視為未填，回 `REASON_REQUIRED`，預約不變。→ 任務 10 案例 4。
2. **動作失敗時不得留下半套紀錄**——例如原因未填被擋，`activity_log` 與 `class_ledger` 筆數必須不變。→ 任務 12 案例 11。
3. **服務的取消期限時數在預約成立後被改**——已成立預約的退或不退必須照預約上存的 `cancel_deadline_at`。→ 任務 10 案例 8。
4. **不經 RPC 直接改 `bookings` 表**（PostgREST `PATCH`）——必須改不到資料。→ 任務 10 案例 11（依賴任務 5，見 R1）。
5. **改期到不同服務的時段**——舊購買不得被拿去抵另一個服務的課。→ 任務 12 案例 6。

---

## 欄位切分：P1 做哪些、哪些留給後面

設計文件 §15 的 13 項變更，P1 只做下表「P1」欄打勾的部分。原則：**P1 的函式會讀或寫的欄位才加**；沒有任何程式會碰的欄位現在加只會多出空欄位與無法驗證的限制。

| §15 # | 內容 | P1 | 留到 | 理由 |
|---|---|---|---|---|
| 1 | `services` 三個開關 | — | P3 | 單堂預約才用得到 |
| 2 | `service_packages.class_count >= 2` | — | P5 | 連同既有 1 堂商品清單一起處理 |
| 3 | `bookings.purchase_id` 可空、付款欄位 | — | P3 | 單堂預約才用得到 |
| 4 | 取消紀錄欄位 `cancel_category`、`cancel_reason`、`cancel_actor_role`、`class_disposition`、`leave_source` | ✓ | — | P1 核心。`leave_source` P1 不會寫入，但屬於同一組取消紀錄，限制條件一次定好，P2 不必再改表 |
| 4 | 狀態加入 `awaiting_attendance` | — | P4 | 點名才用得到 |
| 5 | `cancel_deadline_at`、`rescheduled_from_booking_id` | ✓ | — | P1 核心 |
| 5 | `confirm_deadline_at` | — | P3 | 確認期限只適用單堂／一律確認 |
| 6 | `attendance_source`、`attendance_decided_at` | — | P4 | 點名才用得到 |
| 7 | `availability_slots.formed_at` | — | P2 | 成班規則 |
| 8 | `customer_purchases.origin` | ✓ | — | §16 的既有購買回填屬於 P1 |
| 8 | `withdrawn`、`source_booking_id`、`voided_*`、審核中唯一 | — | P2（補堂）／P5（撤回、作廢） | 沒有對應功能 |
| 9、10 | `leave_requests`、`disputes` | — | P2／P4 | |
| 11、12、13 | `activity_log`、`class_ledger`、`platform_settings` | ✓ | — | P1 核心 |

**取消類別的限制條件一次放進全部 9 個值**（P1 實際只會寫入 `customer`、`coach_rejected`、`coach_cancelled`、`rescheduled`、`under_min`、`legacy`），之後階段不用再改限制。

**比設計文件多的一個欄位**：`activity_log.customer_id`（這筆紀錄相關的學員）。理由：§14.2 要求「查這位學員發生過什麼事只需要一張表」，而且學員端的讀取權限需要它，否則每次查詢都要回頭 join 預約表。需 terry 同意（列在 R6）。

---

## File Structure

**新增（資料庫）**
- `supabase/migrations/20261126100000_bfv2_p1_new_tables.sql` — 三張新表、RLS、平台設定初始值
- `supabase/migrations/20261126100100_bfv2_p1_booking_columns.sql` — `bookings`／`customer_purchases` 新欄位與限制、自動補取消期限的觸發器
- `supabase/migrations/20261126100200_bfv2_p1_backfill.sql` — 既有資料回填（純資料）
- `supabase/migrations/20261126100300_bfv2_p1_functions.sql` — 輔助函式、六支改寫函式、一支新系統函式
- `supabase/migrations/20261126100400_bfv2_p1_guards.sql` — 取消紀錄一致性限制、關閉直接改表的權限

**新增（程式）**
- `src/lib/booking-terms.ts` — 唯一用語表：預約狀態、取消類別、堂數處理、操作人身分、購買審核狀態、歷程事件的畫面用語
- `src/lib/booking-rpc-errors.ts` — RPC 錯誤代碼 → 中文白話訊息
- `src/lib/activity-log.ts` — 讀取一筆預約的歷程（server only）
- `src/lib/platform-settings.ts` — 讀平台設定（server only）
- `src/components/bookings/cancel-reason-dialog.tsx` — 共用的「取消＋原因」對話框
- `src/components/bookings/booking-timeline.tsx` — 共用的歷程列表
- `src/components/bookings/cancel-record.tsx` — 共用的取消紀錄區塊
- `src/app/(customer)/my-bookings/[bookingId]/page.tsx` — 學員端預約明細
- `src/app/(tenant)/bookings/[bookingId]/page.tsx` — 教練端預約明細

**新增（測試）**
- `tests/unit/booking-terms.test.ts`、`tests/unit/booking-rpc-errors.test.ts`、`tests/unit/forbidden-terms.test.ts`
- `tests/integration/bfv2-p1-cancel-record.test.ts`、`tests/integration/bfv2-p1-permissions.test.ts`、`tests/integration/bfv2-p1-history-ledger.test.ts`

**修改** — 見各任務的 Files 區與「改名清單」。

---

## 任務總覽與平行分組

共 **25 個任務**（任務 0～24）。相依順序：

```
第 0 段（主對話，先做）   任務 0  出示意圖，取得 terry 同意
第 1 段（單一代理，序列） 任務 1→2→3→4→5（migration 檔）→ 6（型別）→ 7（共用用語與錯誤對應）
        ── terry 審閱 SQL（可與第 2 段同時進行）──
第 2 段（四條線平行）
   線 A 資料庫測試     任務 8、9、10、11、12
   線 B 改名           任務 13、14、15、16
   線 C 學員端         任務 17、18、19
   線 D 教練端與通知   任務 20、21、22、23
第 3 段（單一代理，序列） 任務 24  合併、全量驗證、對照表打勾、文件回寫
```

**檔案衝突面（分線的依據）**——每個檔案只屬於一條線：

| 線 | 獨占的檔案 |
|---|---|
| 第 1 段 | `supabase/migrations/**`、`src/lib/supabase/types.ts`、`src/lib/booking-terms.ts`、`src/lib/booking-rpc-errors.ts`、`src/lib/cancel-deadline.ts`、`src/components/ui/badge.tsx`、`tests/unit/booking-terms.test.ts`、`tests/unit/booking-rpc-errors.test.ts`、`tests/unit/cancel-deadline.test.ts` |
| 線 A | `tests/integration/**`、`scripts/e2e-verify.mjs` |
| 線 B | `src/app/(tenant)/packages/**`、`src/app/[tenantSlug]/**`、`src/app/(tenant)/customers/**`、`src/app/(tenant)/dashboard/page.tsx`、`src/app/(tenant)/notifications/page.tsx`、`src/app/(tenant)/settings/notifications/page.tsx`、`src/app/(tenant)/sidebar-nav.tsx`、`src/app/(tenant)/services/**`、`src/app/(auth)/**`、`src/app/(platform)/**`、`src/app/book/[slotId]/page.tsx`、`src/app/book/[slotId]/book-form.tsx`、`src/components/public-page/auth-cta.tsx`、`tests/e2e/**`、`tests/tutorials/**`、`tests/unit/components/settings/**`、`tests/unit/components/ui/**`、`tests/unit/forbidden-terms.test.ts`、`docs/*.md`、`README.md` |
| 線 C | `src/app/book/[slotId]/actions.ts`、`src/app/(customer)/my-bookings/**`、`src/lib/platform-settings.ts`、`src/components/bookings/cancel-reason-dialog.tsx`、`src/components/bookings/cancel-record.tsx`、`tests/unit/components/bookings/cancel-reason-dialog.test.tsx` |
| 線 D | `src/app/(tenant)/bookings/**`、`src/lib/notify-booking.ts`、`src/app/api/cron/**`、`src/lib/activity-log.ts`、`src/components/bookings/booking-timeline.tsx`、`tests/unit/components/bookings/booking-timeline.test.tsx`、`tests/unit/notify-booking-copy.test.ts` |

**跨線依賴（只有兩處，都用介面約定解開）：**
- 線 C 的任務 19（學員端明細頁）要用線 D 的 `booking-timeline.tsx` 與 `activity-log.ts`；線 D 的任務 21（教練端取消對話框）要用線 C 的 `cancel-reason-dialog.tsx`，任務 22 要用 `cancel-record.tsx`。**做法：任務 18（線 C）與任務 20（線 D）排在各自線的第一個，兩者完成後互相可用；任務 19、21、22 等對方的元件合併進整合分支後才開始。** 元件介面已寫死在各任務的 Interfaces 區，雙方可以先照介面寫。
- 線 B 不碰線 C、線 D 獨占檔案裡的禁用詞；那些字串由擁有檔案的那條線自己改（已在改名清單標明負責線）。

**需要示意圖才能動的任務**：18、19、20、21、22（見下一節）。任務 17、23 與線 A、線 B 全部不需要示意圖，可以立刻開始。

---

## 需要 terry 先看示意圖才能動的畫面

依全域規則 B2.1／B2.2：以下畫面有新增輸入欄位或新增區塊，**示意圖必須依現有實際畫面產生**，取得同意後才實作。純文字改名不在此列。

| # | 畫面 | 改動內容 | 對應現有檔案 | 任務 |
|---|---|---|---|---|
| M1 | 學員「我的預約」→ 取消預約對話框 | 現況是單純的確認對話框。新增：常用原因選項（生病、工作、交通、天氣、其他）＋選「其他」時出現自填欄位；原因必填，未填不能送出；保留現有的「會退回／不退回」說明 | `src/app/(customer)/my-bookings/cancel-button.tsx`（現用 `src/components/confirm-dialog.tsx`） | 18 |
| M2 | 教練「預約管理」→ 取消預約對話框 | 現況是單純的確認對話框。新增：必填的原因文字欄（上限 500 字）；對待確認的預約，標題與按鈕改為「拒絕預約」 | `src/app/(tenant)/bookings/booking-actions.tsx` | 21 |
| M3 | 學員端預約明細頁（**新頁面** `/my-bookings/[bookingId]`） | 全新頁面：預約基本資料、狀態、取消紀錄區塊（類別、原因、取消人、時間、堂數處理）、歷程列表、改期前後的預約連結 | 無（新增）。版型參考 `src/app/(customer)/my-bookings/my-bookings-content.tsx` 的 `BookingCard` | 19 |
| M4 | 學員「我的預約」卡片 | 新增「查看明細」入口（現有的「查看詳情」按鈕其實是連到教練公開頁，需一併決定去留）；已取消卡片底部說明改為依取消紀錄顯示（例：「已取消・學員取消・已退回 1 堂」） | `src/app/(customer)/my-bookings/my-bookings-content.tsx` | 19 |
| M5 | 教練端預約明細頁（**新頁面** `/bookings/[bookingId]`） | 全新頁面：內容同 M3，另顯示操作人身分（Owner／助教）；助教開啟非自己時段的預約時，歷程區顯示「只有這個時段的教練或 Owner 可以查看歷程」 | 無（新增）。版型參考 `src/app/(tenant)/bookings/page.tsx` 的預約卡片 | 22 |
| M6 | 教練「預約管理」清單 | 每張卡片新增「明細」入口；已取消的卡片顯示取消類別與原因摘要；助教看到非自己時段的預約時不顯示「確認／取消」按鈕 | `src/app/(tenant)/bookings/page.tsx` | 21、22 |

**不需要示意圖的畫面變更**（僅文字）：見「改名清單」。

---

## 規則 × 入口對照表（設計文件 §17 屬於 P1 的列）

「—」＝這個入口與規則無關。「現況無入口」＝這個畫面今天沒有對應操作（已在程式碼核對），P1 不新增。每格寫的是「任務 → 驗證它的測試或實測項目」。

| 規則 | 公開頁選時段 | 預約確認頁 | 我的預約 | 改期流程 | 教練行事曆 | 教練預約管理 | 教練儀表板 | 直接呼叫 RPC |
|---|---|---|---|---|---|---|---|---|
| 封鎖學員不可預約（#22 已做，P1 不得退化） | 不變 | 任務 4 → T12-6 封鎖後 `book_with_purchase` 仍回 `CUSTOMER_BLOCKED`（沿用 `booking-guard-fixes.test.ts`） | — | 任務 4（改期補上封鎖檢查）→ T12-6 | — | — | — | 任務 4 → T12-6 |
| 取消期限（P1：改讀預約上的期限；逾期不擋、記為不退回） | — | 任務 15（文字）→ 實測 H3 | 任務 18：警告文字依預約上的 `cancel_deadline_at` → 單元測試 `willCustomerCancelRefund`、實測 H5 | P2 才擋（P1 不變） | — | — | — | 任務 4 → T10-1、T10-2、T10-8 |
| 取消必填原因 | — | — | 任務 17、18 → T10-4、實測 H4 | —（學員自己改期免填） | 現況無入口（時段視窗只導向預約管理：`slot-popover.tsx`）→ 實測 H9 確認仍無取消按鈕 | 任務 20、21 → T10-4、T10-6、實測 H7 | 現況無入口（`dashboard-content.tsx` 只顯示清單）→ 實測 H9 | 任務 4、5 → T10-4、T10-5、T10-11 |
| 助教只能動自己的時段 | — | — | — | 任務 4（以舊時段為準）→ T11-6 | 現況無入口 | 任務 21（隱藏按鈕）→ 實測 H8；任務 4 → T11-1～3 | 現況無入口 | 任務 4 → T11-1～T11-8 |
| 預約狀態用語一致 | 任務 15（公開頁無狀態字樣，僅「套裝」→ 改名） | 任務 15 | 任務 7（`StatusBadge`）、19 → `forbidden-terms.test.ts`、實測 H1 | 任務 15、17 | 行事曆顯示的是**時段**用語，§3.9 的對應留到 P5（見 R4） | 任務 20 → `forbidden-terms.test.ts`、實測 H1 | 任務 14 | — |
| 每個動作寫歷程 | — | 任務 4（建立預約）→ T12-1 | 任務 4（取消、簽到）→ T12-3、T12-7；任務 19 顯示 | 任務 4 → T12-5 | — | 任務 4（確認、取消）→ T12-2、T12-3；任務 22 顯示 | — | 任務 4 → T12-1～T12-11 |

**§17 中不屬於 P1 的列**：「預約方式依 §4.1 顯示」（P3）、「上課時間 ≤ 到期日」（P2）、「成班後不可掉到門檻下」（P2）。

---

# 第 0 段

### Task 0: 出示意圖並取得同意（主對話執行，不交給實作代理）

**Files:** 無（示意圖以 artifact 提供）

- [ ] **Step 1:** 讀取 M1～M6 對應的現有檔案，依實際畫面結構產生示意圖（不得憑想像）。
- [ ] **Step 2:** 一併請 terry 決定下方 R3（明細頁做成新頁面或展開）、R5（改名用語表）。
- [ ] **Step 3:** 取得 terry 對每一張示意圖的同意後，才放行任務 18、19、20（元件部分）、21、22。
- [ ] **驗證：** 六張示意圖都有 terry 的明確同意紀錄。

---

# 第 1 段（序列）

> 任務 1～5 是把下面的 SQL 原封不動寫成 migration 檔。**不得執行**。SQL 設計成可重複執行（重跑不會出錯、不會重複寫入），因為 terry 會在 SQL 編輯器手動執行，之後 `supabase db push` 可能再跑一次。

### Task 1: Migration 1 — 三張新表與 RLS

**Files:**
- Create: `supabase/migrations/20261126100000_bfv2_p1_new_tables.sql`

**Interfaces:**
- Produces：資料表 `public.platform_settings(key, value, updated_at)`、`public.activity_log(...)`、`public.class_ledger(...)`；函式 `public.is_own_slot_booking(uuid) returns boolean`、`public.forbid_update()`。

**白話說明（給 terry 審閱）**

| 段落 | 做什麼 | 為什麼 |
|---|---|---|
| 1 | 建立 `platform_settings`，放入 §13 的 8 個初始值 | 數值不寫死在程式裡。已有的鍵不覆蓋（重跑安全） |
| 2 | 建立 `activity_log`（歷程），只能新增、不能修改 | §10.1 |
| 3 | 建立 `class_ledger`（堂數異動明細），只能新增、不能修改 | §10.2。`delta` 是「剩餘堂數的變化」：扣一堂 −1、退一堂 +1；所以「已用堂數 ＝ −（明細加總）」 |
| 4 | RLS：歷程——學員看自己的、Owner 看整個租戶、助教只看自己時段的預約、平台管理員全部唯讀；明細——跟著購買紀錄的可見範圍；平台設定——登入者可讀。三張表都沒有任何寫入政策，只能由資料庫函式寫 | §12「查看」列、§15 末段 |

**設計註記：**
- 「只能新增」的做法：收回 `authenticated`／`anon` 的寫入權限 ＋ 一個擋 `UPDATE` 的觸發器。**不擋 `DELETE`**，因為刪除租戶時要能連帶刪掉（測試清理與平台後台的建立失敗回滾都會刪租戶）；一般使用者本來就沒有刪除權限。
- 外鍵一律不用 `on delete set null`（那會觸發 `UPDATE` 而被上面的觸發器擋住）。
- `event`、`reason_code` 不加值域限制，因為之後每個階段都會新增種類；P1 用到的代碼列在任務 4。

```sql
-- ============================================================================
-- 預約流程改版 v2 / P1 — Migration 1：新表（歷程、堂數異動明細、平台設定）
-- 可重複執行。
-- ============================================================================

-- ---------- 1. platform_settings ----------
create table if not exists public.platform_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

drop trigger if exists platform_settings_set_updated_at on public.platform_settings;
create trigger platform_settings_set_updated_at
  before update on public.platform_settings
  for each row execute function public.set_updated_at();

comment on table public.platform_settings is '平台層級可調整數值（設計文件 §13）。由平台管理者以 SQL 維護。';

insert into public.platform_settings (key, value) values
  ('min_response_hours',      '2'::jsonb),   -- 最短回應時間（小時）§4.4
  ('reminder_lead_hours',     '2'::jsonb),   -- 提醒提前量（小時）§4.4、§7.2
  ('attendance_pending_days', '7'::jsonb),   -- 待點名期限（天）§8.2
  ('attendance_revise_days',  '7'::jsonb),   -- 改判期限（天）§8.4
  ('dispute_open_days',       '7'::jsonb),   -- 異議提出期限（天）§11
  ('dispute_resolve_days',    '7'::jsonb),   -- 異議處理期限（天）§11
  ('makeup_grace_days',       '30'::jsonb),  -- 補堂寬限天數 §9.3
  ('customer_cancel_reasons', '["生病","工作","交通","天氣","其他"]'::jsonb)  -- 學員常用取消原因 §3.2
on conflict (key) do nothing;

alter table public.platform_settings enable row level security;

drop policy if exists platform_settings_select on public.platform_settings;
create policy platform_settings_select on public.platform_settings
  for select to authenticated
  using (true);

revoke all on public.platform_settings from anon;
revoke insert, update, delete, truncate on public.platform_settings from authenticated;

-- ---------- 2. activity_log ----------
create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  subject_type text not null
    check (subject_type in ('booking', 'leave_request', 'dispute', 'purchase',
                            'service', 'slot', 'member', 'customer')),
  subject_id uuid not null,
  booking_id uuid references public.bookings(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete cascade,
  event text not null,
  actor_user_id uuid references auth.users(id),
  actor_role text not null check (actor_role in ('customer', 'owner', 'staff', 'system')),
  reason text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint activity_log_system_has_no_actor
    check (actor_role <> 'system' or actor_user_id is null)
);

comment on table public.activity_log is '歷程（設計文件 §10.1）。只增不改；只由 security definer 函式寫入。';
comment on column public.activity_log.customer_id is '這筆紀錄相關的學員（供學員端查詢與 RLS 使用）';
comment on column public.activity_log.booking_id is '相關預約（若有）';

create index if not exists idx_activity_log_booking
  on public.activity_log (booking_id, created_at) where booking_id is not null;
create index if not exists idx_activity_log_tenant_time
  on public.activity_log (tenant_id, created_at desc);
create index if not exists idx_activity_log_subject
  on public.activity_log (subject_type, subject_id, created_at);
create index if not exists idx_activity_log_customer
  on public.activity_log (customer_id, created_at desc) where customer_id is not null;
create index if not exists idx_activity_log_actor
  on public.activity_log (actor_user_id) where actor_user_id is not null;

-- ---------- 3. class_ledger ----------
create table if not exists public.class_ledger (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.customer_purchases(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete cascade,
  delta int not null check (delta <> 0),
  reason_code text not null,
  actor_user_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

comment on table public.class_ledger is '堂數異動明細（設計文件 §10.2）。delta＝剩餘堂數的變化（扣 −1、退 +1）；customer_purchases.classes_used 必須等於 −sum(delta)。';

create index if not exists idx_class_ledger_purchase
  on public.class_ledger (purchase_id, created_at);
create index if not exists idx_class_ledger_booking
  on public.class_ledger (booking_id) where booking_id is not null;
create index if not exists idx_class_ledger_actor
  on public.class_ledger (actor_user_id) where actor_user_id is not null;

-- ---------- 只增不改：擋 UPDATE ----------
create or replace function public.forbid_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'APPEND_ONLY' using errcode = 'P0001';
end;
$$;

drop trigger if exists activity_log_no_update on public.activity_log;
create trigger activity_log_no_update
  before update on public.activity_log
  for each row execute function public.forbid_update();

drop trigger if exists class_ledger_no_update on public.class_ledger;
create trigger class_ledger_no_update
  before update on public.class_ledger
  for each row execute function public.forbid_update();

-- ---------- 4. RLS ----------
-- 助教「自己時段的預約」判斷（給 RLS 政策用，所以要開放 authenticated 執行）
create or replace function public.is_own_slot_booking(p_booking_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.bookings b
      join public.availability_slots s on s.id = b.slot_id
      join public.tenant_members m on m.id = s.member_id
     where b.id = p_booking_id
       and m.user_id = auth.uid()
       and m.status = 'active'
  );
$$;

revoke execute on function public.is_own_slot_booking(uuid) from public, anon;
grant execute on function public.is_own_slot_booking(uuid) to authenticated;

alter table public.activity_log enable row level security;

drop policy if exists activity_log_select on public.activity_log;
create policy activity_log_select on public.activity_log
  for select to authenticated
  using (
    is_platform_admin()
    -- Owner：整個租戶
    or tenant_id in (select current_user_owner_tenant_ids())
    -- 學員：與自己有關、且屬於學員該看得到的對象種類
    or (
      customer_id = (select auth.uid())
      and subject_type in ('booking', 'leave_request', 'dispute', 'purchase')
    )
    -- 助教：只看自己時段的預約
    or (
      booking_id is not null
      and tenant_id in (select current_user_tenant_ids())
      and public.is_own_slot_booking(booking_id)
    )
  );

revoke all on public.activity_log from anon;
revoke insert, update, delete, truncate on public.activity_log from authenticated;

alter table public.class_ledger enable row level security;

drop policy if exists class_ledger_select on public.class_ledger;
create policy class_ledger_select on public.class_ledger
  for select to authenticated
  using (
    exists (
      select 1
        from public.customer_purchases cp
       where cp.id = class_ledger.purchase_id
         and (
           is_platform_admin()
           or cp.customer_id = (select auth.uid())
           or cp.tenant_id in (select current_user_tenant_ids())
         )
    )
  );

revoke all on public.class_ledger from anon;
revoke insert, update, delete, truncate on public.class_ledger from authenticated;
```

**回滾（只在還沒有任何資料寫入、且 Migration 4 尚未執行時使用）**

```sql
drop table if exists public.class_ledger;
drop table if exists public.activity_log;
drop table if exists public.platform_settings;
drop function if exists public.is_own_slot_booking(uuid);
drop function if exists public.forbid_update();
```

- [ ] **Step 1:** 把上面的 SQL 原封不動寫入 `supabase/migrations/20261126100000_bfv2_p1_new_tables.sql`。
- [ ] **Step 2: 驗證（靜態）** 檢查檔案內每個 `create table`／`create index` 都有 `if not exists`、每個 `create policy`／`create trigger` 前都有對應的 `drop ... if exists`。
- [ ] **Step 3: 給 terry 的執行後驗證 SQL**（寫在回報裡，不要自己跑）：

```sql
select key, value from public.platform_settings order by key;          -- 預期 8 列
select relname, relrowsecurity from pg_class
 where relname in ('activity_log','class_ledger','platform_settings'); -- 三列皆 relrowsecurity = true
select tablename, policyname, cmd from pg_policies
 where tablename in ('activity_log','class_ledger','platform_settings'); -- 各一條 SELECT 政策
```

---

### Task 2: Migration 2 — `bookings`／`customer_purchases` 新欄位

**Files:**
- Create: `supabase/migrations/20261126100100_bfv2_p1_booking_columns.sql`

**Interfaces:**
- Produces：`bookings.cancel_category | cancel_reason | cancel_actor_role | class_disposition | leave_source | cancel_deadline_at | rescheduled_from_booking_id`；`customer_purchases.origin`；觸發器 `bookings_fill_cancel_deadline`。

**白話說明**

| 表 | 加什麼 | 為什麼 |
|---|---|---|
| `bookings` | `cancel_category`（取消類別，9 選 1） | §3.2 |
| `bookings` | `cancel_reason`（原因說明） | §3.4 |
| `bookings` | `cancel_actor_role`（取消人身分：學員／Owner／助教／系統）。取消人本人沿用既有的 `cancelled_by`、時間沿用 `cancelled_at` | §3.4 |
| `bookings` | `class_disposition`（堂數處理：退回／不退回／轉到新預約） | §3.3 |
| `bookings` | `leave_source`（請假來源）。P1 不寫入，先把欄位與限制定好 | §3.2 |
| `bookings` | `cancel_deadline_at`（這筆預約的取消期限時間點） | §5：成立時算好存起來，之後服務改設定不影響 |
| `bookings` | `rescheduled_from_booking_id`（由哪一筆改期而來） | §7.1 |
| `customer_purchases` | `origin`（來源：purchase 一般購買／makeup 補堂／legacy 早期合成紀錄），預設 purchase | §16 |
| `bookings` 觸發器 | 新增預約時若沒帶 `cancel_deadline_at`，自動用「開課時間 − 服務當下的取消期限時數」補上 | 保險：任何路徑建立的預約都一定有取消期限（含測試與之後的新函式） |

全部都是「新增可空欄位／帶預設值的欄位」，不影響現行程式。

```sql
-- ============================================================================
-- 預約流程改版 v2 / P1 — Migration 2：bookings / customer_purchases 新欄位
-- 可重複執行。只新增欄位與限制，不動既有資料。
-- ============================================================================

alter table public.bookings
  add column if not exists cancel_category text,
  add column if not exists cancel_reason text,
  add column if not exists cancel_actor_role text,
  add column if not exists class_disposition text,
  add column if not exists leave_source text,
  add column if not exists cancel_deadline_at timestamptz,
  add column if not exists rescheduled_from_booking_id uuid references public.bookings(id);

comment on column public.bookings.cancel_category is '取消類別（設計文件 §3.2）';
comment on column public.bookings.cancel_reason is '取消原因說明';
comment on column public.bookings.cancel_actor_role is '取消人身分：customer / owner / staff / system';
comment on column public.bookings.class_disposition is '堂數處理目前有效值：refunded 退回 / forfeited 不退回 / transferred 轉到新預約';
comment on column public.bookings.leave_source is '請假來源：request / coach_entry / dispute（P2 起使用）';
comment on column public.bookings.cancel_deadline_at is '這筆預約的取消期限（成立時算好，之後不因服務設定變更而改變）';
comment on column public.bookings.rescheduled_from_booking_id is '由哪一筆預約改期而來';

alter table public.bookings drop constraint if exists bookings_cancel_category_check;
alter table public.bookings add constraint bookings_cancel_category_check
  check (cancel_category is null or cancel_category in (
    'customer', 'rescheduled', 'coach_rejected', 'confirm_expired', 'leave',
    'coach_cancelled', 'late_cancel', 'under_min', 'legacy'));

alter table public.bookings drop constraint if exists bookings_cancel_actor_role_check;
alter table public.bookings add constraint bookings_cancel_actor_role_check
  check (cancel_actor_role is null or cancel_actor_role in ('customer', 'owner', 'staff', 'system'));

alter table public.bookings drop constraint if exists bookings_class_disposition_check;
alter table public.bookings add constraint bookings_class_disposition_check
  check (class_disposition is null or class_disposition in ('refunded', 'forfeited', 'transferred'));

alter table public.bookings drop constraint if exists bookings_leave_source_check;
alter table public.bookings add constraint bookings_leave_source_check
  check (leave_source is null or leave_source in ('request', 'coach_entry', 'dispute'));

alter table public.bookings drop constraint if exists bookings_cancel_reason_length_check;
alter table public.bookings add constraint bookings_cancel_reason_length_check
  check (cancel_reason is null or char_length(cancel_reason) <= 500);

create index if not exists idx_bookings_rescheduled_from
  on public.bookings (rescheduled_from_booking_id)
  where rescheduled_from_booking_id is not null;

-- 新增預約時自動補上取消期限（函式會自己帶值；這裡是保險）
create or replace function public.bookings_fill_cancel_deadline()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.cancel_deadline_at is null then
    select s.start_at - sv.cancel_deadline_hours * interval '1 hour'
      into new.cancel_deadline_at
      from public.availability_slots s
      join public.services sv on sv.id = s.service_id
     where s.id = new.slot_id;
  end if;
  return new;
end;
$$;

revoke execute on function public.bookings_fill_cancel_deadline() from public, anon, authenticated;

drop trigger if exists bookings_fill_cancel_deadline on public.bookings;
create trigger bookings_fill_cancel_deadline
  before insert on public.bookings
  for each row execute function public.bookings_fill_cancel_deadline();

-- customer_purchases.origin
alter table public.customer_purchases
  add column if not exists origin text not null default 'purchase';

comment on column public.customer_purchases.origin is '來源：purchase 一般購買 / makeup 補堂 / legacy 改版前合成的 1 堂紀錄';

alter table public.customer_purchases drop constraint if exists customer_purchases_origin_check;
alter table public.customer_purchases add constraint customer_purchases_origin_check
  check (origin in ('purchase', 'makeup', 'legacy'));
```

**回滾（會遺失已寫入的取消紀錄，只在正式上線前使用）**

```sql
drop trigger if exists bookings_fill_cancel_deadline on public.bookings;
drop function if exists public.bookings_fill_cancel_deadline();
drop index if exists public.idx_bookings_rescheduled_from;
alter table public.bookings
  drop column if exists cancel_category,
  drop column if exists cancel_reason,
  drop column if exists cancel_actor_role,
  drop column if exists class_disposition,
  drop column if exists leave_source,
  drop column if exists cancel_deadline_at,
  drop column if exists rescheduled_from_booking_id;
alter table public.customer_purchases drop column if exists origin;
```

- [ ] **Step 1:** 把 SQL 寫入 `supabase/migrations/20261126100100_bfv2_p1_booking_columns.sql`。
- [ ] **Step 2: 給 terry 的執行後驗證 SQL：**

```sql
select column_name, data_type, is_nullable from information_schema.columns
 where table_schema = 'public' and table_name = 'bookings'
   and column_name in ('cancel_category','cancel_reason','cancel_actor_role','class_disposition',
                       'leave_source','cancel_deadline_at','rescheduled_from_booking_id');  -- 預期 7 列
select origin, count(*) from public.customer_purchases group by origin;                      -- 預期全部為 purchase
```

---

### Task 3: Migration 3 — 既有資料回填（純資料）

**Files:**
- Create: `supabase/migrations/20261126100200_bfv2_p1_backfill.sql`

**白話說明（對應設計文件 §16 屬於 P1 的四列）**

| 段落 | 做什麼 | 影響範圍 |
|---|---|---|
| 1 | 已取消的舊預約 → `cancel_category = 'legacy'`，其餘取消欄位留空，不推斷類別 | 所有 `status = 'cancelled'` 且尚未分類的預約 |
| 2 | 尚未開課的待確認／已確認預約 → 回填 `cancel_deadline_at ＝ 開課時間 − 服務當下的取消期限時數` | 只動未來的有效預約；已過去的不回填（不會再用到） |
| 3 | 改版前合成的 1 堂購買紀錄 → `origin = 'legacy'` | 判定條件見下 |
| 4 | 每筆購買的已用堂數 → 補一筆彙總明細（原因代碼 `opening_balance`＝改版前累計） | 有已用堂數的購買 |

**`legacy` 購買的判定條件**（對應 `20260525200005_backfill_synthetic_purchases.sql` 當初寫入的樣子）：沒有對應商品（`package_id is null`）、總堂數 1、無到期日、無核准人、已核准、學員申報已付款、而且核准時間等於建立時間。**執行前先跑下面的預覽查詢，確認筆數與內容符合預期。**

**第 4 段寫法的考量**：不是單純「沒有明細才補」，而是「補上差額」——`−已用堂數 − 目前明細加總`。這樣即使執行順序出錯（例如 Migration 4 先上、已經有新的明細），補完之後「已用堂數 ＝ −明細加總」仍然成立，重跑也不會重複補。

**注意**：第 1、2 段的 `UPDATE` 會讓這些預約的 `updated_at` 變成執行當下（既有的 `set_updated_at` 觸發器）。P4 回填 `attendance_decided_at` 用的是 `no_show` 預約的 `updated_at`，本次不會動到 `no_show`，所以不受影響。

**執行前預覽（terry 先跑，確認數字合理）**

```sql
-- A. 會被標成 legacy 的已取消預約數
select count(*) from public.bookings where status = 'cancelled' and cancel_category is null;

-- B. 會被回填取消期限的預約數
select count(*)
  from public.bookings b join public.availability_slots s on s.id = b.slot_id
 where b.cancel_deadline_at is null and b.status in ('pending','confirmed') and s.start_at > now();

-- C. 會被標成 legacy 的購買（請看一下內容是不是早期合成的 1 堂紀錄）
select cp.id, cp.tenant_id, cp.customer_id, cp.classes_total, cp.classes_used, cp.created_at
  from public.customer_purchases cp
 where cp.origin = 'purchase' and cp.package_id is null and cp.classes_total = 1
   and cp.expires_at is null and cp.approved_by is null
   and cp.approval_status = 'confirmed' and cp.payment_self_reported = 'claimed_paid'
   and cp.approved_at is not distinct from cp.created_at;

-- D. 會補彙總明細的購買數
select count(*) from public.customer_purchases where classes_used > 0;
```

```sql
-- ============================================================================
-- 預約流程改版 v2 / P1 — Migration 3：既有資料回填（設計文件 §16）
-- 純資料變更，可重複執行。需在 Migration 1、2 之後執行。
-- ============================================================================

-- 1. 已取消的舊預約 → legacy（不推斷類別）
update public.bookings
   set cancel_category = 'legacy'
 where status = 'cancelled'
   and cancel_category is null;

-- 2. 未開課的既有預約 → 回填取消期限
update public.bookings b
   set cancel_deadline_at = s.start_at - sv.cancel_deadline_hours * interval '1 hour'
  from public.availability_slots s
  join public.services sv on sv.id = s.service_id
 where s.id = b.slot_id
   and b.cancel_deadline_at is null
   and b.status in ('pending', 'confirmed')
   and s.start_at > now();

-- 3. 改版前合成的 1 堂購買 → legacy
update public.customer_purchases cp
   set origin = 'legacy'
 where cp.origin = 'purchase'
   and cp.package_id is null
   and cp.classes_total = 1
   and cp.expires_at is null
   and cp.approved_by is null
   and cp.approval_status = 'confirmed'
   and cp.payment_self_reported = 'claimed_paid'
   and cp.approved_at is not distinct from cp.created_at;

-- 4. 既有堂數 → 補一筆彙總明細（改版前累計），補的是差額
insert into public.class_ledger (purchase_id, booking_id, delta, reason_code, actor_user_id)
select cp.id,
       null,
       -cp.classes_used - coalesce(l.total, 0),
       'opening_balance',
       null
  from public.customer_purchases cp
  left join (
    select purchase_id, sum(delta) as total
      from public.class_ledger
     group by purchase_id
  ) l on l.purchase_id = cp.id
 where -cp.classes_used - coalesce(l.total, 0) <> 0;
```

**執行後驗證（terry 跑，三個查詢都應回 0 列）**

```sql
-- 已取消卻沒有取消類別
select count(*) from public.bookings where status = 'cancelled' and cancel_category is null;      -- 預期 0

-- 未開課的有效預約卻沒有取消期限
select count(*) from public.bookings b join public.availability_slots s on s.id = b.slot_id
 where b.status in ('pending','confirmed') and s.start_at > now() and b.cancel_deadline_at is null; -- 預期 0

-- 已用堂數與明細加總不一致的購買
select cp.id, cp.classes_used, coalesce(sum(l.delta), 0) as ledger_sum
  from public.customer_purchases cp
  left join public.class_ledger l on l.purchase_id = cp.id
 group by cp.id, cp.classes_used
having cp.classes_used <> -coalesce(sum(l.delta), 0);                                               -- 預期 0 列
```

**回滾（Migration 5 尚未執行時才可用；若已執行，先回滾 Migration 5）**

```sql
update public.bookings set cancel_category = null where cancel_category = 'legacy';
-- cancel_deadline_at 的回填不需要回滾（舊函式不讀這個欄位）
update public.customer_purchases set origin = 'purchase' where origin = 'legacy';
delete from public.class_ledger where reason_code = 'opening_balance';
```

- [ ] **Step 1:** 把「回填」那段 SQL 寫入 `supabase/migrations/20261126100200_bfv2_p1_backfill.sql`；預覽與驗證查詢以註解形式附在檔案最上方。
- [ ] **Step 2: 驗證（靜態）** 四段都符合「重跑不會重複寫入」：第 1～3 段的 `WHERE` 會排除已處理的列；第 4 段差額為 0 時不寫入。

---

### Task 4: Migration 4 — 資料庫函式改寫

**Files:**
- Create: `supabase/migrations/20261126100300_bfv2_p1_functions.sql`

**Interfaces（後續所有任務都依賴這裡的名稱與代碼）:**

| 函式 | 簽章 | 誰可以呼叫 | 變更 |
|---|---|---|---|
| `book_with_purchase` | `(p_slot_id uuid, p_customer_id uuid, p_customer_notes text default null, p_purchase_id uuid default null) returns table(booking_id uuid, auto_confirmed boolean)` | authenticated（只能替自己）、service_role | 簽章不變。新增：存 `cancel_deadline_at`、寫明細與歷程 |
| `confirm_booking` | `(p_booking_id uuid) returns bookings` | authenticated | 簽章不變。權限改為 Owner 或該時段的助教；平台管理員移除；寫歷程 |
| `cancel_booking` | `(p_booking_id uuid, p_reason text default null) returns bookings` | authenticated | **簽章變更**（舊的單參數版本刪除）。原因必填；寫取消紀錄、明細、歷程；權限同上 |
| `reschedule_booking` | `(p_old_booking_id uuid, p_new_slot_id uuid, p_reason text default null) returns bookings` | authenticated | **簽章變更**。教練代改必填原因；寫取消紀錄（改期／轉到新預約）、明細一對、歷程兩筆互相連結 |
| `checkin_booking` | `(p_booking_id uuid) returns table(booking_id uuid, checked_in_at timestamptz)` | authenticated、service_role | 簽章不變。寫歷程 |
| `auto_cancel_group_slot` | `(p_slot_id uuid) returns table(affected_customer_id uuid, affected_member_user_id uuid, service_name text, slot_start_at timestamptz)` | service_role | 簽章不變。寫取消紀錄（人數不足／系統／退回）、明細、歷程 |
| `mark_no_show_bookings` | `(p_lookback interval default '30 days') returns int` | service_role | **新增**。取代排程裡直接改表的做法，讓「系統標為未出席」也有歷程（見 R7） |

輔助函式（只給其他函式用，`authenticated` 不可直接呼叫）：`tenant_actor_role(p_tenant_id, p_slot_member_id) returns text`、`log_activity(...)`、`apply_class_delta(p_purchase_id, p_booking_id, p_delta, p_reason_code, p_actor_user_id) returns boolean`。

**錯誤代碼**（`P0001` 除非另註）：

| 代碼 | 意思 | 新增？ |
|---|---|---|
| `FORBIDDEN`（42501） | 不是本人、不是 Owner、也不是該時段的助教；或平台管理員／service role 想代操作 | 既有，條件收緊 |
| `BOOKING_NOT_FOUND`、`SLOT_NOT_FOUND`（P0002） | 找不到 | 既有 |
| `INVALID_STATE` | 預約狀態不允許這個動作 | 既有 |
| `REASON_REQUIRED` | 沒填原因（空字串、只有空白都算沒填） | **新增** |
| `REASON_TOO_LONG` | 原因超過 500 字 | **新增** |
| `SLOT_STARTED` | 課程已開始，學員不可取消或改期 | **新增**（見 R8） |
| `SERVICE_MISMATCH` | 改期的新時段不是同一個服務 | **新增**（見 R8） |
| `SAME_SLOT` | 改期的新時段就是原時段 | **新增** |
| `SLOT_PAST` | 改期的新時段已經過去 | 既有代碼，改期補上檢查 |
| `CUSTOMER_BLOCKED` | 學員被封鎖 | 既有，改期補上檢查 |
| `SLOT_UNAVAILABLE`、`SLOT_FULL`、`CROSS_TENANT`、`NO_BALANCE`、`PURCHASE_INVALID`、`ALREADY_CHECKED_IN`、`NOT_CONFIRMED`、`CHECKIN_TOO_EARLY`、`CHECKIN_CLOSED` | 不變 | 既有 |

**歷程事件代碼（`activity_log.event`）與 `detail` 結構**

| 事件 | 何時 | `detail` |
|---|---|---|
| `booking.created` | 建立預約 | `{slot_id, purchase_id, cancel_deadline_at}` |
| `booking.confirmed` | 教練確認，或達開班人數系統自動確認 | 手動：`{}`；自動：`{auto: true, trigger: 'min_attendance'}` |
| `booking.cancelled` | 取消（學員取消、教練拒絕、教練取消、人數不足） | `{category, disposition, previous_status, cancel_deadline_at, class_returned}` |
| `booking.rescheduled_out` | 改期：舊預約 | `{to_booking_id, to_slot_id, category: 'rescheduled', disposition: 'transferred'}` |
| `booking.rescheduled_in` | 改期：新預約 | `{from_booking_id, from_slot_id, cancel_deadline_at}` |
| `booking.checked_in` | 學員簽到 | `{source: 'customer_checkin'}` |
| `booking.no_show` | 系統標為未出席 | `{source: 'system'}` |
| `slot.closed` | 時段因人數不足被系統關閉 | `{cancelled_bookings}` |

**明細原因代碼（`class_ledger.reason_code`）**：`opening_balance`（改版前累計）、`booking`（預約扣 1）、`cancel_refund`（取消退回 +1）、`reschedule_out`（改期：舊預約 +1）、`reschedule_in`（改期：新預約 −1）。改期的一對明細加總為 0，不動已用堂數，只是讓每一堂都追得到現在掛在哪筆預約上。

**與現行函式的行為差異（請 terry 逐項看）**

| # | 函式 | 現行 | P1 之後 | 依據 |
|---|---|---|---|---|
| 1 | 取消 | 不用填原因 | 原因必填 | §3.2 |
| 2 | 取消 | 取消期限＝開課時間 − 服務**當下**的時數 | 讀預約上存的 `cancel_deadline_at` | §5 |
| 3 | 取消／確認／改期 | 同租戶任何成員、平台管理員都可以 | 只有 Owner、該時段的助教（取消與改期另含學員本人） | §12 |
| 4 | 取消／改期 | service role 可以（現行是靠 `null` 比較意外放行，不是刻意設計） | 回 `FORBIDDEN` | §12；沒有任何「系統手動取消」的情境 |
| 5 | 取消 | 學員取消**待確認**且已過期限 → 不退回 | 退回 | §7 表格第一列（教練尚未承諾）。實務上很少發生（見 R8） |
| 6 | 取消 | 開課後學員仍可呼叫（畫面已隱藏按鈕） | 學員回 `SLOT_STARTED` | §7 表格；反目標「規則只做在畫面上」 |
| 7 | 取消 | 教練取消一律記為取消 | 對待確認的預約記為「教練拒絕」，對已確認的記為「教練取消」，兩者都退回 | §3.2 |
| 8 | 改期 | 可改到同租戶任何服務的時段（**舊購買會被拿去抵別的服務**） | 只能同一服務 | §7.1；這是現行漏洞 |
| 9 | 改期 | 不檢查新時段是否已過、學員是否被封鎖 | 都檢查 | §4.3、§17 |
| 10 | 人數不足自動取消 | 取消該時段所有未取消的預約 | 只取消待確認、已確認的預約 | 排程延遲時，已簽到（已出席）的預約不該被取消 |
| 11 | 全部 | 鎖定順序不一致（有的先鎖預約、有的先鎖時段） | 一律「時段 → 預約 → 購買」 | 避免同時預約與確認時互相卡死 |

**P1 刻意不改的行為**（留給 P2）：成班自動確認、學員逾期仍可取消（不退回）、待確認可改期、改期不受取消期限限制、教練在開課後仍可取消、新預約一律從待確認開始。

```sql
-- ============================================================================
-- 預約流程改版 v2 / P1 — Migration 4：資料庫函式
-- 可重複執行。需在 Migration 1、2 之後執行（建議也在 3 之後）。
--
-- 共通原則：
--   * 鎖定順序一律：時段 → 預約 → 購買
--   * 權限照設計文件 §12 最終版：Owner、該時段的助教；平台管理員不可代操作
--   * 預約或堂數的任何變更，同一交易寫入 activity_log 與 class_ledger
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
    nullif(btrim(coalesce(p_reason, '')), ''),
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
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
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
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
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
```

**回滾**

1. 若 Migration 5 已執行，先回滾 Migration 5（舊版 `cancel_booking` 不會寫取消類別，會被一致性限制擋下）。
2. 執行：

```sql
drop function if exists public.cancel_booking(uuid, text);
drop function if exists public.reschedule_booking(uuid, uuid, text);
drop function if exists public.mark_no_show_bookings(interval);
```

3. 依序重新執行舊定義（整段 `create or replace function ... ; grant ...;`）：
   - `book_with_purchase`、`confirm_booking` → `supabase/migrations/20261125100000_booking_guard_fixes.sql` 第 1、2 段
   - `cancel_booking(uuid)` → `supabase/migrations/20260613110100_cancel_booking_deadline.sql` 全檔
   - `reschedule_booking(uuid, uuid)` → `supabase/migrations/20260529140000_group_slot_lifecycle_fix.sql` 的 `reschedule_booking` 段
   - `checkin_booking` → `supabase/migrations/20260613100100_checkin_booking_rpc.sql` 全檔
   - `auto_cancel_group_slot` → `supabase/migrations/20260525200010_rpc_auto_cancel_group_slot.sql` 全檔
4. 輔助函式可留著（沒有人呼叫就沒有作用）；要清乾淨再執行：

```sql
drop function if exists public.apply_class_delta(uuid, uuid, int, text, uuid);
drop function if exists public.log_activity(uuid, text, uuid, uuid, uuid, text, uuid, text, text, jsonb);
drop function if exists public.tenant_actor_role(uuid, uuid);
```

5. 程式也要同步退回舊版（新版程式會帶 `p_reason`，舊函式不接受）。

- [ ] **Step 1:** 把 SQL 寫入 `supabase/migrations/20261126100300_bfv2_p1_functions.sql`。
- [ ] **Step 2: 驗證（靜態）** 逐支比對：(a) 每支函式結尾都有 `revoke ... from public, anon` 與對應的 `grant`；(b) 輔助函式三支都收回 `authenticated`；(c) `book_with_purchase` 的封鎖檢查、成班自動確認、額滿標記三段與 `20261125100000_booking_guard_fixes.sql` 逐行一致。
- [ ] **Step 3: 給 terry 的執行後驗證 SQL：**

```sql
select p.proname, pg_get_function_identity_arguments(p.oid) as args
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('book_with_purchase','confirm_booking','cancel_booking','reschedule_booking',
                     'checkin_booking','auto_cancel_group_slot','mark_no_show_bookings')
 order by 1;
-- 預期：cancel_booking 只有 (p_booking_id uuid, p_reason text) 一個版本；
--       reschedule_booking 只有三個參數的版本

select routine_name, grantee from information_schema.routine_privileges
 where routine_schema = 'public'
   and routine_name in ('log_activity','apply_class_delta','tenant_actor_role',
                        'auto_cancel_group_slot','mark_no_show_bookings')
   and grantee in ('anon','authenticated','PUBLIC');
-- 預期：0 列
```

---

### Task 5: Migration 5 — 防線（取消紀錄一致性、關閉直接改表）

**Files:**
- Create: `supabase/migrations/20261126100400_bfv2_p1_guards.sql`

**白話說明**

| 段落 | 做什麼 | 為什麼 |
|---|---|---|
| 1 | 再跑一次「已取消的舊預約 → legacy」 | Migration 3 與 4 之間如果有人用舊函式取消，那些預約不會有取消類別，會讓第 2 段加不上去 |
| 2 | `bookings` 加一條一致性限制：未取消的預約不得有取消紀錄；已取消的一定有取消類別；非舊資料的取消一定有取消人身分與堂數處理 | 資料層保證「每筆取消恰好一個類別」（§3.2） |
| 3 | 移除 `bookings` 的 `bookings_insert`、`bookings_update` 兩條 RLS 政策 | **現行漏洞**：這兩條政策讓學員與教練可以不經函式、直接用 REST 改自己看得到的預約（例如把狀態改成已確認或已取消），原因必填、歷程、堂數明細全部繞過。已核對：程式裡沒有任何地方用登入者身分直接新增或修改 `bookings`（只有函式與 service role）。**這是既有資料表的權限變更，需要 terry 明確同意（R1）** |

**為什麼放在最後**：第 2 段的限制一上去，舊版 `cancel_booking` 就再也取消不了（它不寫取消類別）。所以必須在 Migration 4 之後。

```sql
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
  check (
    -- 未取消：不得有取消紀錄
    (status <> 'cancelled'
      and cancel_category is null
      and cancel_actor_role is null
      and class_disposition is null)
    -- 已取消的舊資料：只有類別
    or (status = 'cancelled' and cancel_category = 'legacy')
    -- 已取消的新資料：類別、取消人身分、堂數處理都要有
    or (status = 'cancelled'
      and cancel_category is not null
      and cancel_category <> 'legacy'
      and cancel_actor_role is not null
      and class_disposition is not null)
  );

-- 3. 預約只能經由資料庫函式新增與修改
drop policy if exists bookings_insert on public.bookings;
drop policy if exists bookings_update on public.bookings;
```

**回滾**

```sql
alter table public.bookings drop constraint if exists bookings_cancel_record_check;

create policy bookings_insert on public.bookings
  for insert to authenticated
  with check (
    customer_id = (select auth.uid())
    or tenant_id in (select current_user_tenant_ids())
  );

create policy bookings_update on public.bookings
  for update to authenticated
  using (
    customer_id = (select auth.uid())
    or tenant_id in (select current_user_tenant_ids())
  );
```

- [ ] **Step 1:** 把 SQL 寫入 `supabase/migrations/20261126100400_bfv2_p1_guards.sql`。
- [ ] **Step 2: 驗證（靜態）** 重新在 repo 內搜尋 `from('bookings')` 之後接 `.insert(`／`.update(`／`.delete(` 的地方，確認只剩 `src/app/api/cron/checkin-reminder/route.ts`（service role，任務 23 會改成呼叫函式）。指令：用 Grep 搜 `\.from\('bookings'\)` 逐一看後續鏈。
- [ ] **Step 3: 給 terry 的執行後驗證 SQL：**

```sql
select policyname, cmd from pg_policies where tablename = 'bookings';   -- 預期只剩 bookings_select
select conname from pg_constraint
 where conrelid = 'public.bookings'::regclass and conname = 'bookings_cancel_record_check'; -- 預期 1 列
```

---

### Task 6: 手動同步 `src/lib/supabase/types.ts`

**Files:**
- Modify: `src/lib/supabase/types.ts`

實作代理不能執行 Supabase 指令，所以依任務 1～5 的 SQL 手動更新型別檔，讓後面的程式可以先通過型別檢查。terry 執行完 migration 後再跑 `npm run db:types` 覆蓋，兩者應一致（任務 24 核對）。

**Interfaces — Produces：**
- `Database['public']['Tables']['activity_log' | 'class_ledger' | 'platform_settings']`（含 `Row`／`Insert`／`Update`／`Relationships`）
- `bookings.Row` 增加：`cancel_category: string | null`、`cancel_reason: string | null`、`cancel_actor_role: string | null`、`class_disposition: string | null`、`leave_source: string | null`、`cancel_deadline_at: string | null`、`rescheduled_from_booking_id: string | null`（`Insert`／`Update` 為選填）
- `customer_purchases.Row` 增加 `origin: string`
- `Functions.cancel_booking.Args = { p_booking_id: string; p_reason?: string }`
- `Functions.reschedule_booking.Args = { p_new_slot_id: string; p_old_booking_id: string; p_reason?: string }`
- `Functions.mark_no_show_bookings = { Args: { p_lookback?: unknown }; Returns: number }`
- `Functions.is_own_slot_booking = { Args: { p_booking_id: string }; Returns: boolean }`
- `cancel_booking`、`reschedule_booking`、`confirm_booking` 的 `Returns` 物件同步加上 `bookings` 的七個新欄位

- [ ] **Step 1:** 依上列介面修改，欄位依字母排序（與既有產生檔一致）。
- [ ] **Step 2: 驗證** Run: `npm run typecheck`　Expected: 無錯誤（此時還沒有程式用到新型別）。

---

### Task 7: 共用用語表、錯誤對應、取消期限判斷

**Files:**
- Create: `src/lib/booking-terms.ts`、`src/lib/booking-rpc-errors.ts`
- Modify: `src/lib/cancel-deadline.ts`、`src/components/ui/badge.tsx:38-54`
- Test: `tests/unit/booking-terms.test.ts`、`tests/unit/booking-rpc-errors.test.ts`、`tests/unit/cancel-deadline.test.ts`

**Interfaces — Produces（線 B、C、D 都會用）:**

`src/lib/booking-terms.ts`
```ts
export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'no_show' | 'cancelled'
export type CancelCategory =
  | 'customer' | 'rescheduled' | 'coach_rejected' | 'confirm_expired' | 'leave'
  | 'coach_cancelled' | 'late_cancel' | 'under_min' | 'legacy'
export type ClassDisposition = 'refunded' | 'forfeited' | 'transferred'
export type ActorRole = 'customer' | 'owner' | 'staff' | 'system'
export type PurchaseApprovalStatus = 'pending_review' | 'confirmed' | 'rejected'
export type Viewer = 'customer' | 'tenant'

export const BOOKING_STATUS_LABEL: Record<BookingStatus, string>
export const CANCEL_CATEGORY_LABEL: Record<CancelCategory, string>
export const CLASS_DISPOSITION_LABEL: Record<ClassDisposition, string>
export const PURCHASE_APPROVAL_LABEL: Record<PurchaseApprovalStatus, string>
export const FORBIDDEN_TERMS: readonly string[]

/** 學員端：owner／staff 一律顯示「教練」；教練端分別顯示「Owner」「助教」 */
export function actorRoleLabel(role: ActorRole, viewer: Viewer): string
/** 歷程事件 → 一行白話描述。未知事件回傳「其他紀錄」，不得回傳事件代碼 */
export function describeActivity(
  row: { event: string; actor_role: ActorRole; detail: Record<string, unknown> | null },
  viewer: Viewer,
): string
```

用語（逐字照設計文件 §2、§3）：

| 對照表 | 值 |
|---|---|
| `BOOKING_STATUS_LABEL` | pending 待確認／confirmed 已確認／completed **已出席**／no_show **未出席**／cancelled 已取消 |
| `CANCEL_CATEGORY_LABEL` | customer 學員取消／rescheduled 改期／coach_rejected 教練拒絕／confirm_expired 逾期未確認／leave 請假／coach_cancelled 教練取消／late_cancel 學員臨時取消（教練代登）／under_min 人數不足／legacy 舊資料（未分類） |
| `CLASS_DISPOSITION_LABEL` | refunded 退回／forfeited 不退回／transferred 轉到新預約 |
| `PURCHASE_APPROVAL_LABEL` | pending_review 審核中／confirmed **已核准**／rejected 已拒絕 |
| `actorRoleLabel` | customer 學員／system 系統／owner、staff：學員端「教練」，教練端「Owner」「助教」 |
| `FORBIDDEN_TERMS` | `['套裝', '課卡', '套票', '已完成', '未到場']` |

`describeActivity` 的輸出（`{身分}` ＝ `actorRoleLabel`）：

| 事件 | 輸出 |
|---|---|
| `booking.created` | `{身分}建立預約` |
| `booking.confirmed`（`detail.auto` 為 true） | `已達開班人數，系統自動確認` |
| `booking.confirmed`（其他） | `{身分}確認預約` |
| `booking.cancelled` | `{取消類別用語}・{堂數處理用語}`（例：`教練取消・退回`） |
| `booking.rescheduled_out` | `{身分}改期（改到新的時段）` |
| `booking.rescheduled_in` | `由改期建立` |
| `booking.checked_in` | `學員簽到` |
| `booking.no_show` | `課程結束未簽到，系統標為未出席` |
| `slot.closed` | `時段關閉` |
| 其他 | `其他紀錄` |

`src/lib/booking-rpc-errors.ts`
```ts
import { AppError } from '@/lib/errors'
/** 把 RPC 錯誤轉成給使用者看的 AppError。未知錯誤回傳通用訊息，並用 console.error 留下原始訊息供除錯。 */
export function toBookingAppError(error: { message?: string } | null | undefined): AppError
```

| 代碼 | 給使用者看的訊息 |
|---|---|
| `REASON_REQUIRED` | 請填寫原因 |
| `REASON_TOO_LONG` | 原因請不要超過 500 字 |
| `FORBIDDEN` | 只有這個時段的教練或 Owner 可以操作這筆預約 |
| `BOOKING_NOT_FOUND` | 找不到這筆預約 |
| `INVALID_STATE` | 這筆預約目前的狀態無法進行這個操作 |
| `SLOT_STARTED` | 課程已經開始，無法取消或改期 |
| `SERVICE_MISMATCH` | 只能改到同一個服務的時段 |
| `SAME_SLOT` | 這就是目前的時段，請選其他時段 |
| `SLOT_UNAVAILABLE` | 這個時段已經無法預約 |
| `SLOT_NOT_FOUND` | 找不到這個時段 |
| `SLOT_FULL` | 這個時段名額已滿 |
| `SLOT_PAST` | 這個時段已經過了 |
| `CROSS_TENANT` | 不能改到其他教練的時段 |
| `NO_BALANCE` | 目前沒有可用的剩餘堂數，請先購買 |
| `PURCHASE_INVALID` | 選擇的堂數已無法使用，請重新選擇 |
| `CUSTOMER_BLOCKED` | 這位教練目前不接受您的預約 |
| `ALREADY_CHECKED_IN` | 已經簽到過了 |
| `NOT_CONFIRMED` | 這筆預約尚未確認，無法簽到 |
| `CHECKIN_TOO_EARLY` | 尚未開放簽到（開課前 30 分鐘起） |
| `CHECKIN_CLOSED` | 課程已結束，無法簽到 |
| 其他 | 操作失敗，請稍後再試 |

比對方式：`error.message` 包含代碼字串（沿用現況）。比對順序把較長的代碼放前面（`SLOT_UNAVAILABLE` 先於不存在的短碼，不會有子字串誤判；`REASON_TOO_LONG`、`REASON_REQUIRED` 互不包含）。`AppError.code` 設為該代碼，未知時為 `UNKNOWN`。

`src/lib/cancel-deadline.ts`（保留既有 `isWithinCancelDeadline`，新增）
```ts
/** 學員現在取消會不會退回。待確認一律退回；已確認看預約上的取消期限（沒有值時用開課時間與時數推算）。 */
export function willCustomerCancelRefund(
  now: Date,
  b: { status: string; cancelDeadlineAt: string | null; startAt: string; deadlineHours: number },
): boolean
```

`src/components/ui/badge.tsx`：`STATUS_LABEL` 改為直接使用 `BOOKING_STATUS_LABEL`（刪掉檔內自己那份），`StatusType` 改為 `BookingStatus` 的別名並繼續匯出。

- [ ] **Step 1:** 實作上列三個檔案與 `badge.tsx` 修改。
- [ ] **Step 2: 補單元測試**
  - `booking-terms.test.ts`：(a) 四張對照表的每個鍵都有非空字串；(b) 所有用語值（含 `describeActivity` 對八種事件、兩種 viewer 的輸出）都不包含 `FORBIDDEN_TERMS` 任一字；(c) `BOOKING_STATUS_LABEL.completed === '已出席'`、`.no_show === '未出席'`、`PURCHASE_APPROVAL_LABEL.confirmed === '已核准'`；(d) `actorRoleLabel('staff', 'customer') === '教練'`、`actorRoleLabel('staff', 'tenant') === '助教'`；(e) `describeActivity({event:'x.y', ...}, 'customer') === '其他紀錄'`；(f) `describeActivity` 的 `booking.cancelled` 以 `{category:'coach_cancelled', disposition:'refunded'}` 得到 `'教練取消・退回'`。
  - `booking-rpc-errors.test.ts`：(a) 上表每個代碼對應到指定訊息；(b) 未知訊息（例如 `'duplicate key value violates unique constraint'`）得到 `'操作失敗，請稍後再試'`；(c) 所有輸出訊息都不含大寫英文底線代碼（正則 `/[A-Z]{2,}_[A-Z]/`）；(d) `null`／`undefined` 輸入不丟例外。
  - `cancel-deadline.test.ts`：新增四例——待確認且已過期限 → true；已確認且剛好等於期限 → true（「剛好等於 D」算在 D 之前，§7）；已確認且過期限 1 毫秒 → false；`cancelDeadlineAt` 為 null 時用 `startAt − deadlineHours` 推算。
- [ ] **Step 3: 驗證** Run: `npm run test -- tests/unit/booking-terms.test.ts tests/unit/booking-rpc-errors.test.ts tests/unit/cancel-deadline.test.ts`　Expected: 全部 PASS。
- [ ] **Step 4: 驗證** Run: `npm run typecheck && npm run lint`　Expected: 無錯誤。

---

# 第 2 段 — 線 A：資料庫整合測試

> 線 A 的測試檔可以先寫好；**執行**要等 terry 跑完 Migration 1～5 並同意（R2）。共用的測試骨架（建立租戶、Owner、兩位助教、學員、服務、時段、購買、登入 client）照 `tests/integration/cancel-booking-deadline.test.ts` 與 `git show 28b244b:tests/integration/booking-guard-fixes.test.ts` 的寫法。

### Task 8: 更新既有整合測試與驗證腳本（簽章與權限變更）

**Files:**
- Modify: `tests/integration/cancel-booking-deadline.test.ts:88,96,106`
- Modify: `tests/integration/atomic-booking.test.ts:188`
- Modify: `tests/integration/group-slot-lifecycle.test.ts:223,248,273`
- Modify: `scripts/e2e-verify.mjs:179`

**為什麼要改：**
- `cancel_booking` 現在必填 `p_reason`。
- 上面三處（`atomic-booking`、`group-slot-lifecycle`）是用 **service role** 呼叫 `cancel_booking`／`reschedule_booking`；新函式會回 `FORBIDDEN`（見任務 4 行為差異 #4）。改成用該筆預約的學員登入 client 呼叫。

- [ ] **Step 1:** `cancel-booking-deadline.test.ts` 三個呼叫都加上 `p_reason: '測試'`；第二個案例（逾期取消）多斷言 `class_disposition === 'forfeited'`。
- [ ] **Step 2:** `atomic-booking.test.ts:188`、`group-slot-lifecycle.test.ts:223,248` 改為用學員登入 client 呼叫並帶 `p_reason`；`:273` 的改期改為用學員登入 client（學員改期免填原因）。若該檔沒有學員登入 client，照 `signedInClient(email)` 的寫法補上。
- [ ] **Step 3:** `scripts/e2e-verify.mjs:179` 的 `cancel_booking` 加上 `p_reason: 'e2e 驗證'`。
- [ ] **Step 4: 驗證（待 terry 同意後執行）** Run: `npm run test:integration -- tests/integration/cancel-booking-deadline.test.ts tests/integration/atomic-booking.test.ts tests/integration/group-slot-lifecycle.test.ts`　Expected: 全部 PASS。
- [ ] **Step 5: 驗證（待 terry 同意後執行）** Run: `npm run test:integration`　Expected: 與改版前的 baseline 相比沒有新增失敗（B12.1：比對差異，不只看總數）。

---

### Task 9: 整合測試共用骨架

**Files:**
- Create: `tests/integration/helpers/bfv2-fixture.ts`

**Interfaces — Produces（任務 10、11、12 使用）:**
```ts
export type Bfv2Ctx = {
  tenantId: string
  owner: { userId: string; memberId: string; client: SupabaseClient<Database> }
  staffA: { userId: string; memberId: string; client: SupabaseClient<Database> }
  staffB: { userId: string; memberId: string; client: SupabaseClient<Database> }
  customer: { userId: string; client: SupabaseClient<Database> }
  otherCustomer: { userId: string; client: SupabaseClient<Database> }
  platformAdmin: { userId: string; client: SupabaseClient<Database> }
  soloServiceId: string   // max_capacity 1、min_attendance 1、cancel_deadline_hours 24
  groupServiceId: string  // max_capacity 3、min_attendance 2、cancel_deadline_hours 24
  otherServiceId: string  // 同租戶另一個服務，測 SERVICE_MISMATCH 用
}
export const admin: SupabaseClient<Database>
export async function setupBfv2(label: string): Promise<Bfv2Ctx>
export async function teardownBfv2(ctx: Bfv2Ctx): Promise<void>
/** 建立時段；startOffsetMin 為距離現在的分鐘數（可為負，直接用 service role 寫入） */
export async function makeSlot(ctx: Bfv2Ctx, o: { memberId: string; serviceId: string; startOffsetMin: number }): Promise<string>
/** 建立一筆已核准、classes_used 為 0 的購買 */
export async function makePurchase(ctx: Bfv2Ctx, o: { customerId: string; serviceId: string; total?: number }): Promise<string>
export async function ledgerSum(purchaseId: string): Promise<number>
export async function usedCount(purchaseId: string): Promise<number>
export async function activityFor(bookingId: string): Promise<Array<{ event: string; actor_role: string; actor_user_id: string | null; reason: string | null; detail: any }>>
```

注意事項：
- 每個時段要用不同成員或不重疊的時間（`availability_slots_no_overlap` 限制）。
- 平台管理員：`admin.from('platform_admins').insert({ user_id })`；`teardownBfv2` 要刪掉這一列。
- 購買一律從 `classes_used: 0` 開始、透過 `book_with_purchase` 預約，這樣「已用堂數 ＝ −明細加總」的不變式才成立。需要「已開課」或「已過期限」的預約時，先用 RPC 預約未來的時段，再用 service role 把 `availability_slots.start_at`／`end_at` 與 `bookings.cancel_deadline_at` 改到過去。
- `teardownBfv2` 刪除租戶即可連帶清掉歷程與明細（`on delete cascade`）。

- [ ] **Step 1:** 實作上列骨架。
- [ ] **Step 2: 驗證** Run: `npm run typecheck`　Expected: 無錯誤。

---

### Task 10: 整合測試 — 取消紀錄與取消必填原因

**Files:**
- Create: `tests/integration/bfv2-p1-cancel-record.test.ts`

**Interfaces — Consumes:** 任務 9 的骨架；任務 4 的 `cancel_booking(p_booking_id, p_reason)`、`auto_cancel_group_slot`。

案例（編號供對照表引用，T10-n）：

1. **學員期限內取消已確認預約**：回傳無錯誤；預約 `status='cancelled'`、`cancel_category='customer'`、`class_disposition='refunded'`、`cancel_actor_role='customer'`、`cancel_reason='生病'`、`cancelled_by` ＝學員；`usedCount` 回到 0。
2. **學員逾期取消已確認預約（P1 過渡）**：`cancel_category='customer'`、`class_disposition='forfeited'`；`usedCount` 維持 1。
3. **學員取消待確認預約且已過期限**（團班第一位報名者）：`class_disposition='refunded'`。
4. **未填原因**：`p_reason` 分別為省略、`''`、`'   '`、`'\n\t'` → 都回 `REASON_REQUIRED`；預約 `status` 不變。學員與 Owner 各測一次。
5. **原因 501 字** → `REASON_TOO_LONG`；500 字 → 成功。
6. **Owner 取消已確認預約（已過期限）**：`cancel_category='coach_cancelled'`、`class_disposition='refunded'`、`cancel_actor_role='owner'`；`usedCount` 回到 0。
7. **Owner 取消待確認預約**：`cancel_category='coach_rejected'`、`class_disposition='refunded'`。
8. **取消期限讀預約上的值**：預約成立後記下 `cancel_deadline_at`（應為開課時間 − 24 小時）；把服務的 `cancel_deadline_hours` 改為 1；重新查詢預約 `cancel_deadline_at` 不變；把時段與預約期限調成「距開課 12 小時」的狀態後學員取消 → `forfeited`（若讀的是服務當下的 1 小時就會是 `refunded`，測試會失敗）。
9. **開課後學員取消** → `SLOT_STARTED`。
10. **已取消再取消** → `INVALID_STATE`；已出席、未出席的預約取消 → `INVALID_STATE`。
11. **不經函式直接改表**：學員 client 執行 `.from('bookings').update({ status: 'cancelled' }).eq('id', id).select()` → 回傳 0 列，資料庫裡的 `status` 不變；教練 client 執行 `.update({ status: 'confirmed' })` → 同樣改不到；學員 client `.from('bookings').insert({...})` → 失敗。
12. **人數不足自動取消**：團班只有 1 人報名，service role 呼叫 `auto_cancel_group_slot` → 預約 `cancel_category='under_min'`、`cancel_actor_role='system'`、`class_disposition='refunded'`、`cancel_reason='人數不足，系統自動取消'`、`cancelled_by` 為 null；時段 `status='cancelled'`；再呼叫一次回傳 0 列且不重複退堂。
13. **一致性限制**：service role 直接 `update bookings set status='cancelled'`（不帶取消類別）→ 被 `bookings_cancel_record_check` 擋下。

- [ ] **Step 1:** 寫出上列 13 個案例。
- [ ] **Step 2: 驗證（待 terry 同意後執行）** Run: `npm run test:integration -- tests/integration/bfv2-p1-cancel-record.test.ts`　Expected: 13 個案例 PASS。

---

### Task 11: 整合測試 — 權限（§12）與讀取範圍

**Files:**
- Create: `tests/integration/bfv2-p1-permissions.test.ts`

案例（T11-n）：

1. **助教 A 取消助教 B 時段的預約** → `FORBIDDEN`；預約不變。確認（`confirm_booking`）同樣 `FORBIDDEN`。
2. **助教 A 確認、取消自己時段的預約** → 成功；`cancel_actor_role='staff'`；歷程 `actor_role='staff'`。
3. **Owner 確認、取消助教 A 時段的預約** → 成功；`cancel_actor_role='owner'`。
4. **平台管理員** 呼叫 `confirm_booking`、`cancel_booking`、`reschedule_booking` → 都是 `FORBIDDEN`。
5. **別的學員** 取消、改期這筆預約 → `FORBIDDEN`。
6. **助教代改期**：舊時段是助教 B 的 → 助教 A `FORBIDDEN`；舊時段是助教 A 的、新時段是助教 B 的 → 成功（帶原因）。
7. **教練代改期未填原因** → `REASON_REQUIRED`；學員自己改期未填原因 → 成功。
8. **service role** 呼叫 `cancel_booking`、`confirm_booking`、`reschedule_booking` → `FORBIDDEN`。
9. **歷程的讀取範圍**（針對同一租戶內兩筆預約：一筆在助教 A 的時段、一筆在助教 B 的時段）：
   - 學員：只查得到自己那筆預約的歷程；`otherCustomer` 查不到。
   - 助教 A：只查得到自己時段那筆預約的歷程，查不到助教 B 時段的。
   - Owner：兩筆都查得到，包含 `subject_type='slot'` 的時段關閉紀錄。
   - 平台管理員：都查得到（唯讀）。
   - 另一個租戶的 Owner：都查不到。
10. **三張新表都不能由登入者寫入**：學員、Owner client 對 `activity_log`、`class_ledger` 做 `insert`／`update`／`delete`，對 `platform_settings` 做 `update` → 全部失敗或影響 0 列。
11. **輔助函式不可直接呼叫**：學員 client `rpc('apply_class_delta', ...)`、`rpc('log_activity', ...)`、`rpc('mark_no_show_bookings')`、`rpc('auto_cancel_group_slot', ...)` → 權限錯誤。
12. **平台設定可讀**：學員 client 讀 `platform_settings` 的 `customer_cancel_reasons` → 得到五個原因的陣列。

- [ ] **Step 1:** 寫出上列 12 個案例。
- [ ] **Step 2: 驗證（待 terry 同意後執行）** Run: `npm run test:integration -- tests/integration/bfv2-p1-permissions.test.ts`　Expected: 12 個案例 PASS。

---

### Task 12: 整合測試 — 歷程與堂數明細

**Files:**
- Create: `tests/integration/bfv2-p1-history-ledger.test.ts`

案例（T12-n）：

1. **建立預約（一對一）**：歷程依序有 `booking.created`（`actor_role='customer'`、`actor_user_id` ＝學員、`detail.cancel_deadline_at` 有值）與 `booking.confirmed`（`actor_role='system'`、`actor_user_id` 為 null、`detail.auto === true`）；明細一筆 `delta=-1`、`reason_code='booking'`；預約的 `cancel_deadline_at` ＝開課時間 − 24 小時。
2. **教練手動確認（團班第一位）**：`booking.confirmed`、`actor_role='owner'`、`actor_user_id` ＝ Owner、`detail.auto` 不存在。
3. **取消且退回**：明細新增一筆 `delta=+1`、`reason_code='cancel_refund'`；歷程 `booking.cancelled`、`reason` ＝輸入的原因、`detail.category`／`detail.disposition`／`detail.previous_status` 正確、`detail.class_returned === true`。
4. **取消且不退回**：明細沒有新增；歷程 `detail.disposition === 'forfeited'`。
5. **改期**：舊預約 `cancel_category='rescheduled'`、`class_disposition='transferred'`；新預約 `rescheduled_from_booking_id` ＝舊預約 id、`cancel_deadline_at` 依新時段計算；舊預約歷程有 `booking.rescheduled_out` 且 `detail.to_booking_id` ＝新預約 id；新預約歷程有 `booking.rescheduled_in` 且 `detail.from_booking_id` ＝舊預約 id；明細新增一對（舊預約 `+1 reschedule_out`、新預約 `-1 reschedule_in`）；`usedCount` 前後不變。
6. **改期的防護**：改到另一個服務的時段 → `SERVICE_MISMATCH`；改到同一個時段 → `SAME_SLOT`；改到已過去的時段 → `SLOT_PAST`；學員被封鎖後改期 → `CUSTOMER_BLOCKED`；被封鎖後用 `book_with_purchase` 預約 → `CUSTOMER_BLOCKED`（確認 #22 的檢查沒被改掉）。
7. **簽到**：`booking.checked_in`、`actor_role='customer'`、`detail.source === 'customer_checkin'`。
8. **系統標為未出席**：把一筆已確認預約的時段改到已結束，service role 呼叫 `mark_no_show_bookings` → 回傳 ≥ 1；預約 `status='no_show'`；歷程 `booking.no_show`、`actor_role='system'`、`actor_user_id` 為 null；明細沒有新增。
9. **不變式**：本檔所有案例跑完後，測試租戶內每一筆購買都滿足 `usedCount(id) === -ledgerSum(id)`。
10. **只增不改**：service role 對 `activity_log`、`class_ledger` 執行 `update` → 錯誤訊息含 `APPEND_ONLY`。
11. **失敗不留紀錄**：對一筆預約先記下歷程與明細筆數，呼叫 `cancel_booking`（不帶原因）得到 `REASON_REQUIRED` 後，兩者筆數不變、`usedCount` 不變。
12. **團班成班自動確認**：第二位學員報名達開班人數 → 兩筆預約各有一筆 `booking.confirmed`（`system`、`auto`），不重複。

- [ ] **Step 1:** 寫出上列 12 個案例。
- [ ] **Step 2: 驗證（待 terry 同意後執行）** Run: `npm run test:integration -- tests/integration/bfv2-p1-history-ledger.test.ts`　Expected: 12 個案例 PASS。

---

# 第 2 段 — 線 B：全站改名

## 改名清單（依搜尋結果，不是憑印象）

搜尋字串：`套裝`、`課卡`、`套票`、`已完成`、`未到場`、`我的方案`、`可購方案`、`餘額`、`課數`、`已生效`、`待教練確認`、`核可`、`購買記錄`。範圍：`src/`、`tests/`、`README.md`、`docs/*.md`（不含 `docs/superpowers/`）。

**用語決定（R5，請 terry 在任務 0 一併確認）**

| 情境 | 用語 |
|---|---|
| 具體商品、有數字 | **N 堂課**（例：`${classes_total} 堂課`） |
| 泛指「可以買的東西」，沒有數字 | **堂數**（例：「購買堂數」「尚無可用的堂數」） |
| 學員手上還能用的 | **剩餘堂數** |
| 教練選單與頁面 | **課堂管理** |
| 學員的 `/[slug]/purchases` 頁 | **購課紀錄** |
| 教練的審核頁 | **購買申請** |
| 審核動作與結果 | **核准**／**已核准**（不用「確認」「核可」「已生效」） |
| 審核中 | **審核中**（不用「待審核」「待教練確認」） |
| 堂數處理 | **退回**／**不退回**（不用「退還」） |
| 英文裝飾字（`PACKAGES`、`PENDING REVIEW` 等 kicker） | 不改 |

### 線 B 負責的檔案

| 檔案:行 | 現在 | 改成 |
|---|---|---|
| `src/app/(tenant)/sidebar-nav.tsx:35` | `套裝管理` | `課堂管理` |
| `src/app/(tenant)/packages/page.tsx:103` | `PACKAGES · 套裝管理` | `PACKAGES · 課堂管理` |
| `src/app/(tenant)/packages/page.tsx:104` | `套裝管理` | `課堂管理` |
| `src/app/(tenant)/packages/page.tsx:106` | `按服務分組管理可購買的套裝（單堂、N 堂等）` | `按服務分組管理可購買的 N 堂課，並審核購買申請` |
| `src/app/(tenant)/packages/page.tsx:123` | `aria-label="套裝分類"` | `aria-label="課堂分類"` |
| `src/app/(tenant)/packages/page.tsx:167` | `請先建立服務，才能為服務新增可購買的套裝。` | `請先建立服務，才能為服務新增可購買的 N 堂課。` |
| `src/app/(tenant)/packages/page.tsx:185` | `此分類目前沒有套裝` | `此分類目前沒有可購買的 N 堂課` |
| `src/app/(tenant)/packages/page.tsx:249` | `{packages.length} 個套裝` | `{packages.length} 個商品` |
| `src/app/(tenant)/packages/page.tsx:277` | `新增 {service.name} 套裝` | `新增 {service.name} 的 N 堂課` |
| `src/app/(tenant)/packages/page.tsx:308` | `沒有草稿（已刪除）套裝` | `沒有已刪除的 N 堂課` |
| `src/app/(tenant)/packages/package-form-dialog.tsx:96` | `新增套裝` | `新增 N 堂課` |
| `src/app/(tenant)/packages/package-form-dialog.tsx:103` | `編輯套裝`／`新增套裝` | `編輯 N 堂課`／`新增 N 堂課` |
| `src/app/(tenant)/packages/package-form-dialog.tsx:129` | `placeholder="單堂 / 10 堂套裝"` | `placeholder="例如：10 堂課"` |
| `src/app/(tenant)/packages/package-actions-row.tsx:47` | `刪除此套裝？` | `刪除這個 N 堂課？` |
| `src/app/(tenant)/packages/package-actions-row.tsx:48` | `刪除後學員端不再顯示此套裝。既有 confirmed 購買記錄不受影響、學員仍可繼續使用餘額。可從『已刪除』分頁重新啟用。` | `刪除後學員端不再顯示。已核准的購買不受影響，學員仍可繼續使用剩餘堂數。可從「已刪除」分頁重新啟用。`（原文含狀態代碼 `confirmed`，違反 B1.3，一併修正） |
| `src/app/(tenant)/packages/actions.ts:52` | `new NotFoundError('套裝')` | `new NotFoundError('N 堂課')` |
| `src/app/(tenant)/packages/pending/page.tsx:67` | `回套裝管理` | `回課堂管理` |
| `src/app/(tenant)/packages/pending/page.tsx:71` | `PENDING REVIEW · 套裝審核` | `PENDING REVIEW · 購買申請` |
| `src/app/(tenant)/packages/pending/page.tsx:72` | `套裝審核佇列` | `購買申請` |
| `src/app/(tenant)/packages/pending/page.tsx:74` | `學員提交的購買申請，確認收款後點「確認」開放餘額` | `學員送出的購買申請。確認收到款項後按「核准」，學員就能開始用堂數預約` |
| `src/app/(tenant)/packages/pending/page.tsx:104` | `本月已核可` | `本月已核准` |
| `src/app/(tenant)/packages/pending/page.tsx:113` | `無待審核項目` | `沒有審核中的申請` |
| `src/app/(tenant)/packages/pending/purchase-row.tsx:54` | `toast.success('已確認')` | `toast.success('已核准')` |
| `src/app/(tenant)/packages/pending/purchase-row.tsx:103` 附近按鈕文字 | `確認` | `核准` |
| `src/app/(tenant)/packages/pending/purchase-actions.ts:26,27,70` | `NotFoundError('購買記錄')` | `NotFoundError('購買紀錄')` |
| `src/app/(tenant)/packages/pending/purchase-actions.ts:29,72` | `只能審核待審核狀態的購買` | `只能處理審核中的購買申請` |
| `src/app/(tenant)/customers/customer-row.tsx:163` | `PACKAGES · 套裝餘額` | `PACKAGES · 剩餘堂數` |
| `src/app/(tenant)/customers/customer-row.tsx:166` | `尚無有效套裝` | `目前沒有可用的堂數` |
| `src/app/(tenant)/customers/page.tsx:189` | 後備名稱 `'套裝'` | `` `${total} 堂課` `` |
| `src/app/(tenant)/customers/page.tsx:238` | `所有預約過你服務的學員。點開查看預約紀錄與持有套裝。` | `所有預約過你服務的學員。點開查看預約紀錄與剩餘堂數。` |
| `src/app/(tenant)/customers/page.tsx:29-34` | `ALLOWED_BOOKING_STATUSES` 少了 `no_show` | 加入 `'no_show'`（否則未出席的預約在學員資料裡會被當成待確認顯示） |
| `src/app/(tenant)/dashboard/page.tsx:67` | `開放新套裝` | `新增 N 堂課` |
| `src/app/(tenant)/notifications/page.tsx:19` | 分頁 `label: '套裝'` | `label: '購課'` |
| `src/app/(tenant)/notifications/page.tsx:35` | `package_request: '套裝申請'` | `package_request: '購買申請'` |
| `src/app/(tenant)/notifications/page.tsx:36` | `package_approved: '套裝核准'` | `package_approved: '購買已核准'` |
| `src/app/(tenant)/notifications/page.tsx:37` | `purchase_request: '套裝購買申請'` | `purchase_request: '購買申請'` |
| `src/app/(tenant)/settings/notifications/page.tsx:23` | `label: '套裝申請'` | `label: '購買申請'` |
| `src/app/(tenant)/settings/notifications/page.tsx:24` | `label: '套裝核准'` | `label: '購買已核准'` |
| `src/app/(tenant)/services/service-actions-row.tsx:47` | `既有預約與套裝不受影響` | `既有預約與已購買的堂數不受影響` |
| `src/app/(tenant)/services/service-form-dialog.tsx:170` | `…仍不足、自動取消並退課數。` | `…仍不足、自動取消並退回堂數。` |
| `src/app/(platform)/platform/bookings/page.tsx:13` | `STATUS_TYPES` 少了 `no_show` | 加入 `'no_show'` |
| `src/app/(platform)/platform/bookings/page.tsx:44` | 篩選 `已完成` | `已出席`，並在其後新增一項 `{ key: 'no_show', label: '未出席' }`（標籤取自 `BOOKING_STATUS_LABEL`） |
| `src/app/(auth)/login/page.tsx:16` | `登入後可購買套裝、預約時段、改期或取消預約。` | `登入後可購買堂數、預約時段、改期或取消預約。` |
| `src/app/(auth)/login/page.tsx:17` | `教練核可後會以 Email 與 Web Push 通知你。` | `教練核准後會以推播通知你。`（Email 通知是設計文件明列不做的項目） |
| `src/app/(auth)/signup/page.tsx:56,57` | `…可立即購買該教練的套裝。` | `…可立即購買該教練的堂數。` |
| `src/components/public-page/auth-cta.tsx:10` | `登入或註冊後即可購買套裝 / 預約時段。` | `登入或註冊後即可購買堂數／預約時段。` |
| `src/app/[tenantSlug]/page.tsx:400` | 頁尾連結 `套裝` | `購買堂數` |
| `src/app/[tenantSlug]/packages/page.tsx:100` | 大標 `套裝` | `購買堂數` |
| `src/app/[tenantSlug]/packages/page.tsx:110` | `買套裝享更划算的單堂單價。送出申請後等教練核可、確認付款狀態,核可後即可預約時段。` | `一次買多堂，每堂更划算。送出申請後由教練核對付款並核准，核准後就能預約時段。` |
| `src/app/[tenantSlug]/packages/page.tsx:119` | `SIGN IN · 申請套裝前需要登入` | `SIGN IN · 購買前需要登入` |
| `src/app/[tenantSlug]/packages/page.tsx:122` | `…送出後等教練核可。` | `…送出後等教練核准。` |
| `src/app/[tenantSlug]/packages/page.tsx:231` | `此教練尚未開放套裝` | `這位教練目前沒有可購買的堂數` |
| `src/app/[tenantSlug]/packages/page.tsx:242` | `還沒看到喜歡的方案?` | `沒有適合的堂數？` |
| `src/app/[tenantSlug]/packages/page.tsx:245` | `可以直接私訊教練詢問客製套裝。教練建立後會出現在這個頁面。` | `可以直接私訊教練詢問。教練建立後會出現在這個頁面。` |
| `src/app/[tenantSlug]/packages/purchase-request-action.ts:27` | `NotFoundError('套裝')` | `NotFoundError('N 堂課')` |
| `src/app/[tenantSlug]/packages/purchase-request-form.tsx:40` | `申請已送出,等教練核可` | `申請已送出，等教練核准` |
| `src/app/[tenantSlug]/packages/purchase-request-form.tsx:67` | `申請此套裝` | `購買這個 N 堂課` |
| `src/app/[tenantSlug]/packages/purchase-request-form.tsx:78` | `申請套裝` | `購買申請` |
| `src/app/[tenantSlug]/packages/purchase-request-form.tsx:80` | `· 教練核可後生效` | `· 教練核准後可使用` |
| `src/app/[tenantSlug]/purchases/page.tsx:11-13` | `待教練確認`／`已生效`／`已拒絕` | 改用 `PURCHASE_APPROVAL_LABEL`（審核中／已核准／已拒絕） |
| `src/app/[tenantSlug]/purchases/page.tsx:47` | `我的方案` | `購課紀錄` |
| `src/app/[tenantSlug]/purchases/page.tsx:55` | `尚無購買記錄` | `尚無購買紀錄` |
| `src/app/[tenantSlug]/purchases/page.tsx:60` | `瀏覽可購方案 →` | `去購買堂數 →` |
| `src/app/[tenantSlug]/purchases/page.tsx:90` | `餘額：` | `剩餘堂數：` |
| `src/app/book/[slotId]/book-form.tsx:56` | `PACKAGE · 套裝餘額` | `PACKAGE · 剩餘堂數` |
| `src/app/book/[slotId]/book-form.tsx:59` | `預設挑最快到期的；可手動切換成其他有效套裝。` | `預設使用最快到期的；可以改選其他可用的堂數。` |
| `src/app/book/[slotId]/book-form.tsx:66` | 後備名稱 `'套裝'` | `` `${p.classes_total} 堂課` `` |
| `src/app/book/[slotId]/page.tsx:105` | `您尚未持有 … 的有效課數，請先申請套裝。` | `您目前沒有 … 的剩餘堂數，請先購買。` |
| `src/app/book/[slotId]/page.tsx:109` | `尚無可用套裝` | `沒有可用的剩餘堂數` |
| `src/app/book/[slotId]/page.tsx:110` | `先去申請一個套裝才能預約` | `先購買堂數才能預約` |
| `src/app/book/[slotId]/page.tsx:112` | `瀏覽套裝` | `去購買堂數` |
| `src/app/book/[slotId]/page.tsx:159` | `…待教練核可。` | `…等教練確認。`（這裡說的是**預約**，預約的用語是「確認」不是「核准」） |
| `src/app/book/[slotId]/page.tsx:205` | `以上取消，堂數退回套裝；逾時取消或未到場視同已上完一堂。` | `以上取消，堂數退回；逾期取消或未出席不退回。` |
| `tests/e2e/customer.spec.ts:14` | `getByText('已完成')` | `getByText('已出席')` |
| `tests/e2e/flows.spec.ts:88` | `/預約確認\|尚無可用套裝/` | `/預約確認\|沒有可用的剩餘堂數/` |
| `tests/tutorials/customer.tutorial.spec.ts:7,31,43,46,50` | 套裝／已完成／套票 | 依上表用語（`步驟 2` 說明改為「本週／待回覆／已出席／已取消」；`我的套裝` → `購課紀錄`；`選購套票` → `購買堂數`） |
| `tests/tutorials/coach.tutorial.spec.ts:68,70,73,122` | 套票／待審核套票 | `課堂管理`／`購買申請`；通知分頁說明改為「全部／預約／購課／系統」 |
| `tests/tutorials/staff.tutorial.spec.ts:36` | `步驟 7：套票`、`查看套票` | `步驟 7：課堂管理`、`查看可購買的 N 堂課` |
| `tests/unit/components/settings/notification-matrix.test.tsx:7,19` | `套裝申請` | `購買申請` |
| `tests/unit/components/ui/kpi-card.test.tsx:13,20` | `教練核可中` | `等教練確認`（配合線 C 改 `my-bookings-content.tsx:259`） |

### 其他線負責（檔案由該線獨占，改名由該線一起做）

| 檔案:行 | 現在 | 改成 | 負責 |
|---|---|---|---|
| `src/components/ui/badge.tsx:52,53` | `已完成`／`未到場` | `已出席`／`未出席`（改用 `BOOKING_STATUS_LABEL`） | 任務 7 |
| `src/app/(customer)/my-bookings/my-bookings-content.tsx:178` | `已簽到 · HH:mm 完課` | `已簽到 · HH:mm` | 任務 19 |
| `…/my-bookings-content.tsx:179` | `已完成 · 期待下次見面` | `已出席 · 期待下次見面` | 任務 19 |
| `…/my-bookings-content.tsx:181` | `已取消 · 不會佔用套裝堂數`（對不退回的取消是錯的） | 依取消紀錄顯示（見任務 19） | 任務 19 |
| `…/my-bookings-content.tsx:183` | `未到場 · 未退還此堂` | `未出席 · 不退回` | 任務 19 |
| `…/my-bookings-content.tsx:259` | `教練核可中` | `等教練確認` | 任務 19 |
| `…/my-bookings-content.tsx:262` | KPI `已完成` | `已出席` | 任務 19 |
| `src/app/(customer)/my-bookings/cancel-button.tsx:18,31,32` | `已退還堂數`／`未退還堂數`／`退還此堂課數` | `已退回 1 堂`／`不退回`／`退回這一堂` | 任務 18 |
| `src/app/book/[slotId]/actions.ts:73,75` | `需先購買套裝才能預約`／`選擇的套裝不可用，請重新選擇` | 改用 `toBookingAppError`（訊息見任務 7） | 任務 17 |
| `src/app/(tenant)/bookings/page.tsx:20,46` | `已完成` | `已出席`（改用 `BOOKING_STATUS_LABEL`），並補上 `no_show` 的標籤、樣式與篩選項 | 任務 20 |
| `src/lib/notify-booking.ts:110,113,114,190,203` | `套裝已確認` 等 | 見任務 23 | 任務 23 |
| `src/lib/notify-checkin.ts:53` | `記得到場後簽到` | 不改（「到場」是動作，不是狀態名稱） | — |

### 不在 P1 改的

| 項目 | 理由 |
|---|---|
| 行事曆的時段標籤（`src/app/(tenant)/calendar/slot-popover.tsx:21-24`、`list-view.tsx:21-23`：可預約／待確認／已預約／已取消） | 這是**時段**用語，§3.9 的對應（開放／額滿／關閉／已結束）與「行事曆顯示預約狀態與標記」一起排在 P5（見 R4） |
| `scripts/seed-test-data.mjs:626` 的商品名稱 `10 堂套裝` | 屬於「教練自己取的商品名稱含套裝」，§16 排在 P5 由 terry 決定 |
| 資料表、欄位、路由（`/packages`、`service_packages`） | §15 明訂不改 |

---

### Task 13: 改名 — 教練端（課堂管理、購買申請、學員、儀表板、服務）

**Files:**
- Modify: `src/app/(tenant)/sidebar-nav.tsx`、`src/app/(tenant)/packages/page.tsx`、`src/app/(tenant)/packages/package-form-dialog.tsx`、`src/app/(tenant)/packages/package-actions-row.tsx`、`src/app/(tenant)/packages/actions.ts`、`src/app/(tenant)/packages/pending/page.tsx`、`src/app/(tenant)/packages/pending/purchase-row.tsx`、`src/app/(tenant)/packages/pending/purchase-actions.ts`、`src/app/(tenant)/customers/customer-row.tsx`、`src/app/(tenant)/customers/page.tsx`、`src/app/(tenant)/dashboard/page.tsx`、`src/app/(tenant)/services/service-actions-row.tsx`、`src/app/(tenant)/services/service-form-dialog.tsx`

- [ ] **Step 1:** 依「改名清單」逐列修改上述檔案。只改字串，不動版面與邏輯（`customers/page.tsx` 的 `ALLOWED_BOOKING_STATUSES` 加 `'no_show'` 是唯一的非字串變更）。
- [ ] **Step 2: 驗證** 用 Grep 在上述檔案搜 `套裝|套票|課卡|已完成|未到場|餘額|核可|待審核`　Expected: 0 筆。
- [ ] **Step 3: 驗證** Run: `npm run typecheck && npm run lint`　Expected: 無錯誤。

---

### Task 14: 改名 — 通知類型標籤、平台後台、登入註冊

**Files:**
- Modify: `src/app/(tenant)/notifications/page.tsx:19,35-37`、`src/app/(tenant)/settings/notifications/page.tsx:23-24`、`src/app/(platform)/platform/bookings/page.tsx:13,44`、`src/app/(auth)/login/page.tsx:16-17`、`src/app/(auth)/signup/page.tsx:56-57`、`src/components/public-page/auth-cta.tsx:10`
- Modify: `tests/unit/components/settings/notification-matrix.test.tsx:7,19`

- [ ] **Step 1:** 依「改名清單」修改。平台後台預約頁的篩選標籤改為從 `BOOKING_STATUS_LABEL` 取值（`@/lib/booking-terms`），並新增「未出席」篩選項。
- [ ] **Step 2: 驗證** Run: `npm run test -- tests/unit/components/settings/notification-matrix.test.tsx`　Expected: PASS。
- [ ] **Step 3: 驗證** Run: `npm run typecheck && npm run lint`　Expected: 無錯誤。

---

### Task 15: 改名 — 學員端公開頁、購買頁、購課紀錄、預約確認頁

**Files:**
- Modify: `src/app/[tenantSlug]/page.tsx:400`、`src/app/[tenantSlug]/packages/page.tsx`、`src/app/[tenantSlug]/packages/purchase-request-action.ts:27`、`src/app/[tenantSlug]/packages/purchase-request-form.tsx`、`src/app/[tenantSlug]/purchases/page.tsx`、`src/app/book/[slotId]/page.tsx`、`src/app/book/[slotId]/book-form.tsx`

- [ ] **Step 1:** 依「改名清單」修改。`purchases/page.tsx` 的 `STATUS_LABEL` 保留顏色對照，標籤文字改從 `PURCHASE_APPROVAL_LABEL` 取。
- [ ] **Step 2: 驗證** 用 Grep 在上述檔案搜 `套裝|方案|餘額|課數|核可|已生效|未到場`　Expected: 0 筆。
- [ ] **Step 3: 驗證** Run: `npm run typecheck && npm run lint`　Expected: 無錯誤。

---

### Task 16: 禁用詞掃描測試、e2e／教學腳本字串、文件回寫

**Files:**
- Create: `tests/unit/forbidden-terms.test.ts`
- Modify: `tests/e2e/customer.spec.ts:14`、`tests/e2e/flows.spec.ts:88`、`tests/tutorials/customer.tutorial.spec.ts`、`tests/tutorials/coach.tutorial.spec.ts`、`tests/tutorials/staff.tutorial.spec.ts`、`tests/unit/components/ui/kpi-card.test.tsx:13,20`
- Modify（文件）: `docs/usage-guide.md`、`docs/line-announcement-templates.md`、`README.md`、`docs/e2e-manual-checklist.md`、`docs/role-testing-scenarios.md`

**`forbidden-terms.test.ts` 的做法：** 用 `node:fs` 遞迴讀 `src/` 底下所有 `.ts`、`.tsx`（排除 `src/lib/supabase/types.ts` 與 `src/lib/booking-terms.ts` 本身），斷言沒有任何檔案包含 `FORBIDDEN_TERMS`（套裝、課卡、套票、已完成、未到場）任一字。失敗訊息列出「檔案:行號:該行內容」。檔案開頭加 `// @vitest-environment node`。「方案」不列入掃描（一般語意也會用到），靠改名清單人工處理。

**文件：** `docs/usage-guide.md` 與 `docs/line-announcement-templates.md` 是給使用者看的手冊與公告範本，設計文件 §2 明訂手冊一律使用畫面用語，**必須改**。`README.md`、`docs/e2e-manual-checklist.md`、`docs/role-testing-scenarios.md` 是描述性文件（B10.5），本任務只改裡面引用的畫面文字（套裝、已完成、未到場、我的方案、套票），並在 README 補上本次的函式簽章與新表說明；其餘段落不重寫。

- [ ] **Step 1:** 新增 `tests/unit/forbidden-terms.test.ts`。
- [ ] **Step 2:** 修改 e2e、教學腳本與兩個單元測試的字串。
- [ ] **Step 3:** 修改五份文件。README 需更新：路由表 `/packages`（課堂管理）、`/[slug]/purchases`（購課紀錄）、新增 `/bookings/[bookingId]`、`/my-bookings/[bookingId]`；「套裝 / 課數模型」段落標題與用語；RPC 清單中 `cancel_booking(booking_id, reason)`、`reschedule_booking(old_booking_id, new_slot_id, reason?)`、`mark_no_show_bookings()`；新增一段說明 `activity_log`、`class_ledger`、`platform_settings`。
- [ ] **Step 4: 驗證（此時線 C、線 D 還沒合併，預期會列出它們負責的檔案）** Run: `npm run test -- tests/unit/forbidden-terms.test.ts`　Expected: 只剩線 C、線 D 獨占檔案裡的違規；線 B 負責的檔案 0 筆。任務 24 合併後必須 0 筆。
- [ ] **Step 5: 驗證** 用 Grep 在 `docs/usage-guide.md`、`docs/line-announcement-templates.md` 搜 `套裝|已完成|未到場|套票`　Expected: 0 筆。

---

# 第 2 段 — 線 C：學員端

### Task 17: 學員端 Server Action — 取消原因、錯誤對應

**Files:**
- Modify: `src/app/book/[slotId]/actions.ts`
- Create: `src/lib/platform-settings.ts`

不需要示意圖（沒有畫面變更）。

**Interfaces:**
- Consumes：`toBookingAppError`（任務 7）；RPC `cancel_booking(p_booking_id, p_reason)`、`reschedule_booking(p_old_booking_id, p_new_slot_id, p_reason?)`（任務 4）。
- Produces：
  - `cancelMyBookingAction` 的輸入改為 `{ bookingId: string(uuid); reason: string }`，`reason` 驗證 `z.string().trim().min(1, '請填寫原因').max(500, '原因請不要超過 500 字')`。
  - `src/lib/platform-settings.ts`：
    ```ts
    import 'server-only'
    /** 學員常用取消原因。讀不到或格式不對時丟出 AppError，不回傳預設清單（B4.2、B6.9）。 */
    export async function getCustomerCancelReasons(supabase: SupabaseClient<Database>): Promise<string[]>
    ```

- [ ] **Step 1:** `cancelMyBookingAction`：schema 加 `reason`，RPC 呼叫帶 `p_reason: parsedInput.reason`，錯誤一律 `throw toBookingAppError(error)`（刪掉現有的 `INVALID_STATE`／`FORBIDDEN` 個別判斷與 `throw new AppError('CANCEL_FAILED', error.message)`——後者會把資料庫原始訊息顯示給使用者）。
- [ ] **Step 2:** `createBookingAction` 的兩段錯誤處理（改期、預約）都改為 `throw toBookingAppError(error)`，刪掉逐一比對的 `if` 與含「套裝」的兩句訊息。`SlotUnavailableError` 的個別處理不再需要。
- [ ] **Step 3:** `checkinBookingAction` 的錯誤處理同樣改為 `toBookingAppError`。
- [ ] **Step 4:** 實作 `getCustomerCancelReasons`：讀 `platform_settings` 的 `customer_cancel_reasons`，驗證是非空的字串陣列。
- [ ] **Step 5: 驗證** 用 Grep 在 `src/app/book/[slotId]/actions.ts` 搜 `error\.message\)`　Expected: 0 筆（不再把原始訊息丟給使用者）。
- [ ] **Step 6: 驗證** Run: `npm run typecheck`　Expected: 只剩 `cancel-button.tsx` 尚未帶 `reason` 的型別錯誤（任務 18 處理）。

---

### Task 18: 共用取消原因對話框 ＋ 學員取消預約（需示意圖 M1）

**Files:**
- Create: `src/components/bookings/cancel-reason-dialog.tsx`、`src/components/bookings/cancel-record.tsx`
- Modify: `src/app/(customer)/my-bookings/cancel-button.tsx`、`src/app/(customer)/my-bookings/my-bookings-content.tsx`（只改傳給取消按鈕的資料）
- Test: `tests/unit/components/bookings/cancel-reason-dialog.test.tsx`

**前置：** M1 已獲 terry 同意。

**Interfaces — Produces（線 D 的任務 21、22 也會用）:**
```tsx
// src/components/bookings/cancel-reason-dialog.tsx  ('use client')
export default function CancelReasonDialog(props: {
  trigger: ReactElement
  title: string
  description?: string
  /** 有給＝顯示常用原因選項，最後一項視為「其他」，選它才出現自填欄位；沒給＝只有必填文字欄 */
  presetReasons?: string[]
  confirmLabel: string
  isPending: boolean
  /** 回傳去除前後空白後的原因；非空且不超過 500 字才會被呼叫 */
  onConfirm: (reason: string) => void | Promise<void>
}): JSX.Element

// src/components/bookings/cancel-record.tsx（server component 可用，無狀態）
export function CancelRecord(props: {
  viewer: Viewer
  category: CancelCategory
  reason: string | null
  actorRole: ActorRole | null
  cancelledAt: string | null
  disposition: ClassDisposition | null
}): JSX.Element
```

行為：
- 送出的原因字串：選常用原因 → 該原因文字；選「其他」→ 自填的文字（不加「其他：」前綴）。
- 原因未選、或選「其他」但沒填、或只有空白 → 送出按鈕停用。
- 自填欄位 `maxLength={500}`。
- `CancelRecord` 用 `CANCEL_CATEGORY_LABEL`、`CLASS_DISPOSITION_LABEL`、`actorRoleLabel` 顯示五項取消紀錄；`category === 'legacy'` 時只顯示類別與時間。
- `cancel-button.tsx` 改用 `CancelReasonDialog`，接收新 props `presetReasons: string[]`；`willRefund` 改由 `willCustomerCancelRefund` 計算（任務 7）。
- `my-bookings-content.tsx`：查詢多選 `cancel_deadline_at`；用 `getCustomerCancelReasons` 讀一次原因清單並傳給每張卡片。**若讀取失敗，取消按鈕不顯示，改顯示「目前無法取消，請稍後再試」**，不得用寫死的清單頂替（B6.9）。

- [ ] **Step 1:** 依同意的示意圖實作 `CancelReasonDialog`（基底元件沿用 `src/components/ui/alert-dialog.tsx`、`input.tsx`、`label.tsx`，樣式比照 `src/components/confirm-dialog.tsx`）。
- [ ] **Step 2:** 實作 `CancelRecord`。
- [ ] **Step 3:** 修改 `cancel-button.tsx` 與 `my-bookings-content.tsx` 的資料傳遞；成功訊息改為 `已取消預約，已退回 1 堂`／`已取消預約（不退回）`；警告文字改為 `已超過取消期限，取消後這一堂不退回，仍要取消嗎？`。
- [ ] **Step 4: 補元件測試**（happy-dom，照 `tests/unit/components/` 既有寫法）：(a) 有 `presetReasons` 時未選原因 → 送出鈕停用；(b) 選「生病」後送出 → `onConfirm('生病')`；(c) 選「其他」未填 → 停用；填「  臨時加班  」→ `onConfirm('臨時加班')`；(d) 沒有 `presetReasons` 時輸入空白 → 停用，輸入文字 → 可送出。
- [ ] **Step 5: 驗證** Run: `npm run test -- tests/unit/components/bookings/cancel-reason-dialog.test.tsx`　Expected: PASS。
- [ ] **Step 6: 驗證** Run: `npm run typecheck && npm run lint`　Expected: 無錯誤。

---

### Task 19: 學員端預約明細頁與歷程（需示意圖 M3、M4）

**Files:**
- Create: `src/app/(customer)/my-bookings/[bookingId]/page.tsx`、`src/app/(customer)/my-bookings/[bookingId]/loading.tsx`
- Modify: `src/app/(customer)/my-bookings/my-bookings-content.tsx`

**前置：** M3、M4 已獲同意；線 D 的任務 20（`getBookingTimeline`、`BookingTimeline`）已合併進整合分支。

**Interfaces — Consumes:**
- `getBookingTimeline(supabase, bookingId)`、`<BookingTimeline entries viewer="customer" />`（任務 20）
- `<CancelRecord viewer="customer" ... />`（任務 18）
- `BOOKING_STATUS_LABEL`、`StatusBadge`（任務 7）

頁面內容（版面依示意圖）：
- `requireSession()`；查詢預約時加 `.eq('customer_id', session.userId)`，查不到 → `notFound()`。
- 顯示：服務、教練（租戶名稱，不出現 Owner／助教字樣）、時間、狀態徽章、學員備註、取消期限（`cancel_deadline_at`，例：「取消期限：11/28（六）10:00 前」）。
- 已取消 → `CancelRecord`。
- `rescheduled_from_booking_id` 有值 → 「由這筆預約改期而來」連結；本筆是被改期的舊預約 → 從歷程 `booking.rescheduled_out` 的 `detail.to_booking_id` 取得新預約並顯示連結。
- 歷程列表 `BookingTimeline`。

`my-bookings-content.tsx` 的修改：
- 查詢多選 `cancel_category, class_disposition`。
- 卡片新增「查看明細」連結到 `/my-bookings/${b.id}`（位置依示意圖；現有連到教練公開頁的「查看詳情」依示意圖決定去留）。
- 卡片底部的狀態說明（改名清單中標「任務 19」的那幾列）：
  - 已出席且有簽到時間：`已簽到 · HH:mm`
  - 已出席無簽到時間：`已出席 · 期待下次見面`
  - 未出席：`未出席 · 不退回`
  - 已取消：`已取消 · {取消類別} · {堂數處理}`；`legacy` 只顯示 `已取消`
- KPI `已完成` → `已出席`；`教練核可中` → `等教練確認`。

- [ ] **Step 1:** 新增明細頁與 `loading.tsx`（比照 `src/app/(customer)/my-bookings/loading.tsx`）。
- [ ] **Step 2:** 修改 `my-bookings-content.tsx`。
- [ ] **Step 3: 驗證** 用 Grep 在 `src/app/(customer)/my-bookings` 搜 `套裝|已完成|未到場|退還|核可`　Expected: 0 筆。
- [ ] **Step 4: 驗證** Run: `npm run typecheck && npm run lint && npm run test`　Expected: 無錯誤、全部 PASS（`tests/unit/components/ui/kpi-card.test.tsx` 已由任務 16 同步）。

---

# 第 2 段 — 線 D：教練端、通知、排程

### Task 20: 歷程讀取與共用歷程列表 ＋ 教練端 Server Action

**Files:**
- Create: `src/lib/activity-log.ts`、`src/components/bookings/booking-timeline.tsx`
- Modify: `src/app/(tenant)/bookings/actions.ts`、`src/app/(tenant)/bookings/page.tsx:13-24,43-48`（只改狀態對照與篩選）
- Test: `tests/unit/components/bookings/booking-timeline.test.tsx`

**前置：** `booking-timeline.tsx` 的樣式依示意圖 M3／M5 中的歷程區；`activity-log.ts` 與 `actions.ts` 不需要示意圖，可以先做。

**Interfaces — Produces（線 C 的任務 19 也會用）:**
```ts
// src/lib/activity-log.ts
import 'server-only'
export type TimelineEntry = {
  id: string
  event: string
  actorRole: ActorRole
  reason: string | null
  detail: Record<string, unknown>
  createdAt: string
}
/** 一筆預約的歷程，依時間由舊到新。查詢失敗時丟出 AppError（不回傳空陣列冒充「沒有紀錄」，B6.9）。
 *  助教查非自己時段的預約時，RLS 會讓結果為空陣列——這是合法結果，由呼叫端顯示說明。 */
export async function getBookingTimeline(supabase: SupabaseClient<Database>, bookingId: string): Promise<TimelineEntry[]>
```
```tsx
// src/components/bookings/booking-timeline.tsx（無狀態，server component 可用）
export function BookingTimeline(props: { entries: TimelineEntry[]; viewer: Viewer; emptyHint?: string }): JSX.Element
```
每一列顯示：時間（台灣時間，`yyyy/MM/dd HH:mm`，換算方式比照 `src/app/(tenant)/bookings/page.tsx` 的 `toLocal`）、`describeActivity(entry, viewer)` 的描述、有原因時顯示「原因：…」。`entries` 為空時顯示 `emptyHint`（預設「尚無紀錄」）。

**`actions.ts` 的修改：**
- `cancelBookingByTenantAction` 輸入改為 `{ bookingId: string(uuid); reason: string }`（`reason` 驗證同任務 17）；RPC 帶 `p_reason`。
- `confirmBookingAction`、`cancelBookingByTenantAction` 的錯誤都改為 `throw toBookingAppError(error)`（現有的 `throw new AppError('CANCEL_FAILED', error.message)` 會把資料庫原始訊息顯示給使用者）。
- 成功後多 `revalidatePath('/bookings/' + bookingId)`。

**`page.tsx` 的修改（僅文字與對照表，不需示意圖）：** `STATUS_LABELS` 刪除，改用 `BOOKING_STATUS_LABEL`；`STATUS_STYLES` 補上 `no_show`（樣式與 `cancelled` 相同）；篩選列 `已完成` → `已出席`，並在其後加入 `{ key: 'no_show', label: '未出席' }`。

- [ ] **Step 1:** 實作 `src/lib/activity-log.ts`。
- [ ] **Step 2:** 實作 `BookingTimeline`（待示意圖同意後定稿樣式；結構可先做）。
- [ ] **Step 3:** 修改 `actions.ts` 與 `page.tsx` 的狀態對照。
- [ ] **Step 4: 補元件測試** `booking-timeline.test.tsx`：(a) 三筆紀錄依序顯示；(b) `viewer='customer'` 時畫面上不出現「Owner」「助教」；(c) 有 `reason` 的列顯示「原因：」；(d) 空陣列顯示 `emptyHint`；(e) 未知事件顯示「其他紀錄」而不是事件代碼。
- [ ] **Step 5: 驗證** Run: `npm run test -- tests/unit/components/bookings/booking-timeline.test.tsx`　Expected: PASS。
- [ ] **Step 6: 驗證** 用 Grep 在 `src/app/(tenant)/bookings` 搜 `error\.message\)|已完成`　Expected: 0 筆。

---

### Task 21: 教練取消預約對話框、助教操作範圍（需示意圖 M2、M6）

**Files:**
- Modify: `src/app/(tenant)/bookings/booking-actions.tsx`、`src/app/(tenant)/bookings/page.tsx`

**前置：** M2、M6 已獲同意；線 C 的任務 18（`CancelReasonDialog`）已合併進整合分支。

**Interfaces:**
- Consumes：`<CancelReasonDialog />`（不帶 `presetReasons`＝必填文字欄）、`cancelBookingByTenantAction({ bookingId, reason })`。
- Produces：`CancelButton` 的 props 改為 `{ bookingId: string; bookingStatus: 'pending' | 'confirmed' }`。

行為：
- 待確認的預約：對話框標題「拒絕這筆預約？」、說明「拒絕後堂數會退回給學員，並通知學員。」、送出鈕「拒絕預約」。清單上的按鈕文字「拒絕」。
- 已確認的預約：標題「取消這筆預約？」、說明「取消後堂數會退回給學員，並通知學員。」、送出鈕「取消預約」。清單上的按鈕文字「取消」。
- 兩者都必填原因。成功訊息分別為「已拒絕」「已取消」。
- **助教操作範圍**：`page.tsx` 的查詢多選 `availability_slots(start_at, end_at, member_id)`；`const session = await requireTenantMember()`；`canAct = session.role === 'tenant_owner' || slot.member_id === session.memberId`。`canAct` 為 false 時不顯示「確認／拒絕／取消」按鈕，改顯示示意圖 M6 指定的說明文字。（這只是畫面；真正的權限在任務 4 的函式裡。）

- [ ] **Step 1:** 依同意的示意圖修改 `booking-actions.tsx`。
- [ ] **Step 2:** 修改 `page.tsx` 的按鈕顯示條件。
- [ ] **Step 3: 驗證** Run: `npm run typecheck && npm run lint`　Expected: 無錯誤。

---

### Task 22: 教練端預約明細頁（需示意圖 M5、M6）

**Files:**
- Create: `src/app/(tenant)/bookings/[bookingId]/page.tsx`、`src/app/(tenant)/bookings/[bookingId]/loading.tsx`
- Modify: `src/app/(tenant)/bookings/page.tsx`（新增明細入口、已取消卡片的取消摘要）

**前置：** M5、M6 已獲同意；任務 18（`CancelRecord`）、任務 20、任務 21 完成。

頁面內容（版面依示意圖）：
- `requireTenantMember()`；查詢預約時加 `.eq('tenant_id', session.tenantId)`，查不到 → `notFound()`。
- 顯示：學員姓名、服務、時間、負責成員、狀態、學員備註、取消期限、使用的購買（名稱與剩餘堂數）。
- 已取消 → `<CancelRecord viewer="tenant" />`（顯示 Owner／助教）。
- 改期前後的預約連結（同任務 19）。
- 歷程 `<BookingTimeline viewer="tenant" />`。助教開啟非自己時段的預約時（`canAct` 為 false，判斷同任務 21）：`emptyHint="只有這個時段的教練或 Owner 可以查看歷程"`。
- `canAct` 為 true 且狀態為待確認／已確認時，顯示與清單相同的「確認／拒絕／取消」按鈕（重用 `booking-actions.tsx`）。

`page.tsx` 清單的修改：查詢多選 `cancel_category, cancel_reason, class_disposition`；每張卡片加「明細」連結到 `/bookings/${b.id}`；已取消的卡片依示意圖顯示 `{取消類別}・{原因}`（`legacy` 不顯示）。

- [ ] **Step 1:** 新增明細頁與 `loading.tsx`（比照 `src/app/(tenant)/bookings/loading.tsx`）。
- [ ] **Step 2:** 修改清單頁。
- [ ] **Step 3: 驗證** Run: `npm run typecheck && npm run lint && npm run test`　Expected: 無錯誤、全部 PASS。

---

### Task 23: 通知文案與排程

**Files:**
- Modify: `src/lib/notify-booking.ts`、`src/app/api/cron/checkin-reminder/route.ts:124-141`

不需要示意圖（推播文字與後端排程）。

**通知文案（`notify-booking.ts`）**

`notifyBookingChange` 的查詢多選 `cancel_category, cancel_reason, class_disposition, cancel_actor_role`，以及時段負責成員與租戶 Owner 的 `user_id`。

| 位置 | 現在 | 改成 |
|---|---|---|
| `:110` 核准標題 | `套裝已確認` | `購買已核准` |
| `:110` 拒絕標題 | `套裝申請被拒絕` | `購買申請未通過` |
| `:113` 核准內文 | `${tenant} 確認您的 ${pkg ?? '套裝'}（N 堂），可開始預約` | `` `${tenant?.name ?? '教練'} 已核准您購買的 ${pkg?.name ?? svc?.name ?? ''} ${p.classes_total} 堂課，可以開始預約了` `` |
| `:114` 拒絕內文 | `${tenant} 拒絕了您的套裝申請：原因` | `` `${tenant?.name ?? '教練'} 未通過您的購買申請：${p.rejected_reason ?? ''}` `` |
| `:190` 人數不足（學員） | `…因人數不足取消。已退還 1 堂課數。` | `…因人數不足取消，已退回 1 堂。` |
| `:203` 人數不足（教練） | `…系統已自動取消並退還學員課數。` | `…系統已自動取消，並把堂數退回給學員。` |
| 取消（教練 → 學員） | `${tenant} 取消了您的預約 (時間)` | `` `${tenant?.name ?? '教練'} 取消了您的預約（${startAt}）。原因：${cancel_reason}。${disposition 為 refunded ? '已退回 1 堂。' : ''}` ``；`cancel_category === 'coach_rejected'` 時標題改為 `預約未被接受`、內文開頭改為「未接受您的預約」 |
| 取消（學員 → 教練） | `${name} 取消了預約 (時間)` | `` `${customer?.display_name ?? '學員'} 取消了預約（${startAt}）。原因：${cancel_reason}。${disposition 為 forfeited ? '已過取消期限，不退回。' : '已退回 1 堂。'}` `` |
| 改期（舊預約，現在會送出「取消了預約」） | 同上 | `cancel_category === 'rescheduled'` 時：標題 `預約已改期`、內文 `` `${customer?.display_name ?? '學員'} 將預約改期（原時間 ${startAt}）` ``，不顯示原因與堂數處理 |

**助教操作要通知 Owner（§12 末項）：** `event === 'cancelled'` 且 `cancel_actor_role === 'staff'` 時，除了通知學員，另外對該租戶所有 `role='owner'`、`status='active'` 的成員各送一則：標題 `助教取消了預約`（`coach_rejected` 時為 `助教拒絕了預約`），內文 `` `${customer?.display_name ?? '學員'} 的 ${service?.name ?? ''}（${startAt}）。原因：${cancel_reason}` ``，連結 `/bookings/${bookingId}`。

通知連結：教練收到的取消通知改連到 `/bookings/${bookingId}`；學員收到的改連到 `/my-bookings/${bookingId}`（明細頁上線後）。

**排程（`checkin-reminder/route.ts`）：** 把「查出已結束且未簽到的已確認預約 → 直接 `update bookings set status='no_show'`」整段（約 `:124-141`）換成：

```ts
const { data: noShowMarked, error: nsErr } = await admin.rpc('mark_no_show_bookings')
if (nsErr) console.error('[checkin-reminder] mark_no_show_bookings', nsErr.message)
```

回傳的 JSON 欄位 `noShowMarked` 保留（值為 `nsErr ? 0 : (noShowMarked ?? 0)`）。`auto-cancel-group-class/route.ts` 不需要改（函式回傳欄位不變）。

- [ ] **Step 1:** 修改 `notify-booking.ts`。把「組出取消通知的標題與內文」抽成同檔內的純函式 `buildCancelNotice(input): { toCustomer?: {title, body}; toCoach?: {title, body}; toOwners?: {title, body} }` 以便測試。
- [ ] **Step 2: 補單元測試** `tests/unit/notify-booking-copy.test.ts`（`buildCancelNotice` 需從檔案匯出）：(a) 教練取消、退回 → 學員通知含原因與「已退回 1 堂」；(b) 學員逾期取消 → 教練通知含「不退回」；(c) 改期 → 標題「預約已改期」且內文不含「取消了預約」；(d) 助教取消 → 有 `toOwners`；Owner 取消 → 沒有 `toOwners`；(e) 所有輸出不含 `FORBIDDEN_TERMS`。
- [ ] **Step 3:** 修改 `checkin-reminder/route.ts`。
- [ ] **Step 4: 驗證** Run: `npm run test -- tests/unit/notify-booking-copy.test.ts`　Expected: PASS。
- [ ] **Step 5: 驗證** 用 Grep 在 `src/app/api/cron` 搜 `from\('bookings'\)\.update`　Expected: 0 筆。
- [ ] **Step 6: 驗證** Run: `npm run typecheck && npm run lint`　Expected: 無錯誤。

---

# 第 3 段

### Task 24: 合併、全量驗證、對照表打勾

**Files:**
- Modify: `docs/superpowers/specs/2026-11-25-booking-flow-v2-design.md`（只在 §18 的 P1 列後加註「已完成」與實際落差）
- Modify: `src/lib/supabase/types.ts`（terry 執行 migration 後以產生檔覆蓋）

- [ ] **Step 1:** 四條線的分支依「第 1 段 → 線 A → 線 B → 線 C → 線 D」順序合併到整合分支；確認沒有任何一條線改到別條線獨占的檔案（`git diff --stat` 逐線比對）。
- [ ] **Step 2: 驗證** Run: `npm run typecheck && npm run lint && npm run format:check`　Expected: 無錯誤。
- [ ] **Step 3: 驗證** Run: `npm run test`　Expected: 全部 PASS，且 `tests/unit/forbidden-terms.test.ts` 0 筆違規。
- [ ] **Step 4: 驗證** Run: `npm run build`　Expected: 成功；**把警告讀過一遍**，新增的警告列出來回報（B12.2）。
- [ ] **Step 5:** 請 terry 依「上線順序」執行 Migration 1～5 與各段的驗證 SQL。
- [ ] **Step 6:** terry 執行 `npm run db:types`；比對 `git diff src/lib/supabase/types.ts`，與任務 6 手寫的內容若有差異，以產生檔為準並回報差異。
- [ ] **Step 7: 驗證（terry 同意後）** Run: `npm run test:integration`　Expected: 新增的三個檔案共 37 個案例 PASS；既有檔案與 baseline 相比沒有新增失敗。
- [ ] **Step 8:** 依「規則 × 入口對照表」逐格核對，每格填上實際通過的測試名稱或實測結果；把「驗收清單」的實測項目整理成一份可逐條勾選的清單交給 terry。
- [ ] **Step 9:** 對照本計畫回報落差（B13.2）：哪些任務與計畫不同、為什麼。
- [ ] **Step 10:** 停下等 terry 指示是否 commit／開 PR（B7.1）。

---

## 上線順序（terry 執行）

| 步驟 | 動作 | 對線上的影響 |
|---|---|---|
| 1 | 執行 Migration 1、2 與驗證 SQL | 無（只新增表與欄位） |
| 2 | 執行 Migration 3 的預覽查詢 → 確認數字 → 執行回填 → 驗證 SQL | 無 |
| 3 | 選離峰時段：執行 Migration 4、5 與驗證 SQL | **從這一刻到新版程式部署完成之間，舊版畫面的「取消預約」會失敗**（顯示錯誤，資料不會壞）。預約、確認、改期、簽到不受影響（簽章相容） |
| 4 | 立刻合併並部署新版程式 | 恢復正常 |
| 5 | （若有獨立測試資料庫則提前）跑整合測試 | 會在資料庫建立並刪除測試租戶 |
| 6 | 依驗收清單實測 | — |

出問題時的回滾順序：程式退版 → Migration 5 → Migration 4 →（需要時）3 → 2 → 1。各段回滾 SQL 見各任務。

---

## 驗收清單

### 自動化測試

**單元測試（新增）**

| 檔案 | 案例 |
|---|---|
| `tests/unit/booking-terms.test.ts` | 對照表完整；所有用語不含禁用詞；已出席／未出席／已核准三個關鍵用語；學員端只出現「教練」；未知事件不外露代碼；取消事件的描述格式 |
| `tests/unit/booking-rpc-errors.test.ts` | 20 個代碼各自對應訊息；未知錯誤回通用訊息；訊息不含代碼；空值輸入不丟例外 |
| `tests/unit/cancel-deadline.test.ts` | 新增 4 例：待確認逾期仍退回；剛好等於期限算期限內；過期限 1 毫秒不退回；沒有預約期限時的推算 |
| `tests/unit/forbidden-terms.test.ts` | `src/` 全部 `.ts`／`.tsx` 不含套裝、課卡、套票、已完成、未到場 |
| `tests/unit/components/bookings/cancel-reason-dialog.test.tsx` | 未選原因不能送出；選常用原因；選「其他」必填且去空白；無常用原因模式 |
| `tests/unit/components/bookings/booking-timeline.test.tsx` | 依序顯示；學員端不出現 Owner／助教；顯示原因；空狀態；未知事件 |
| `tests/unit/notify-booking-copy.test.ts` | 教練取消含原因與退回；學員逾期取消含不退回；改期不寫成取消；助教操作通知 Owner；不含禁用詞 |

**單元測試（修改）**：`tests/unit/components/settings/notification-matrix.test.tsx`、`tests/unit/components/ui/kpi-card.test.tsx`（字串）。

**整合測試（新增，共 37 例）**

| 檔案 | 案例數 | 涵蓋 |
|---|---|---|
| `tests/integration/bfv2-p1-cancel-record.test.ts` | 13 | 取消類別與堂數處理的每個 P1 組合、原因必填（含空白字元）、長度上限、取消期限讀預約上的值、開課後不可取消、直接改表被擋、人數不足自動取消、一致性限制 |
| `tests/integration/bfv2-p1-permissions.test.ts` | 12 | 助教只能動自己的時段、Owner 全租戶、平台管理員與 service role 不可代操作、改期以舊時段為準、歷程的讀取範圍（學員／助教／Owner／平台／他租戶）、三張新表不可寫、輔助函式不可直接呼叫 |
| `tests/integration/bfv2-p1-history-ledger.test.ts` | 12 | 六支函式＋系統標未出席各自的歷程與明細、改期兩筆互相連結、改期防護、已用堂數＝−明細加總、只增不改、失敗不留紀錄、成班自動確認的歷程 |

**整合測試（修改）**：`cancel-booking-deadline.test.ts`、`atomic-booking.test.ts`、`group-slot-lifecycle.test.ts`（簽章與呼叫身分）；`booking-guard-fixes.test.ts`（#22 帶進來的，不需修改，必須仍然全過）。

**資料回填**不寫自動化測試（只跑一次）；以任務 3 的三個驗證查詢為準，由 terry 執行並確認皆為 0 列。

### 需要 terry 實機點過的項目

| # | 項目 | 預期 |
|---|---|---|
| H1 | 逐頁看過：側欄、課堂管理、購買申請、學員、儀表板、通知、通知設定、預約管理、平台後台預約、公開頁、購買堂數頁、購課紀錄、預約確認頁、我的預約 | 沒有任何「套裝／套票／已完成／未到場／我的方案／餘額／核可」；同一件事在每一頁說法相同 |
| H2 | 用學員帳號預約一堂一對一 | 成功；「我的預約」明細頁的歷程有「學員建立預約」「系統自動確認」兩筆 |
| H3 | 預約確認頁的取消政策文字 | 「…以上取消，堂數退回；逾期取消或未出席不退回。」 |
| H4 | 學員取消：不選原因 | 送不出去；選「生病」→ 成功，明細頁的取消紀錄顯示「學員取消・生病・退回」，剩餘堂數加回 1 |
| H5 | 學員取消一筆已過取消期限的預約 | 對話框先警告「不退回」；取消後紀錄為「學員取消・不退回」，剩餘堂數不變 |
| H6 | 學員選「其他」並自填原因 | 明細頁顯示的是自填的文字 |
| H7 | Owner 在預約管理取消一筆已確認預約：不填原因 | 送不出去；填原因 → 成功，學員收到的推播含原因與「已退回 1 堂」；對待確認的預約，按鈕與對話框是「拒絕」 |
| H8 | 用助教帳號開預約管理 | 自己時段的預約有按鈕；別人時段的預約沒有按鈕、看不到歷程；助教取消自己時段的預約後，Owner 收到通知 |
| H9 | 教練行事曆的時段視窗、儀表板 | 沒有新增取消按鈕（仍導向預約管理） |
| H10 | 學員改期一筆預約 | 舊預約明細顯示「改期・轉到新預約」並可點到新預約；新預約明細顯示「由改期建立」並可點回舊預約；剩餘堂數不變 |
| H11 | 核准一筆購買申請 | 按鈕是「核准」、提示「已核准」；學員推播標題「購買已核准」 |
| H12 | 改版前就已取消的舊預約 | 明細頁只顯示「已取消・舊資料（未分類）」，不顯示原因與堂數處理 |
| H13 | 手機寬度看 M1～M6 的畫面 | 版面與同意的示意圖一致 |
| H14 | 部署產物：正式站確認新版已生效（側欄顯示「課堂管理」） | — |
| H15 | 排程：等一次 `checkin-reminder` 與 `auto-cancel-group-class` 執行後，在 Supabase 看 `net._http_response` 最近兩筆 | 狀態 200，沒有錯誤 |

---

## terry 的決議（2026-11-26）

下方 R1、R2、R3、R5、R9 已有決議，以這裡為準：

| 項目 | 決議 |
|---|---|
| R1 | P1 就移除 `bookings_insert`、`bookings_update` 兩條政策（Migration 5 照做） |
| R2 | 不另建測試用資料庫。目前仍在開發階段，SQL 執行後接著部署即可 |
| R3 | 新增明細頁，教練端與學員端各一頁 |
| R5 | 泛稱用「堂數」；通知分頁叫「購課」；審核頁叫「購買申請」；「退還」→「退回」；「核可／已生效」→「核准／已核准」 |
| R9 | 購買申請的核准與拒絕（寫歷程、限 Owner）排進 P3，與單堂付款一起做 |

示意圖 M1～M6 已於 2026-11-26 取得同意（https://claude.ai/artifact/M3oYTRgCUUgruTH7T5eveQ），並有三點調整，任務 18、19、21 以此為準：

- **M1 補充說明常駐**：學員取消對話框的「補充說明」欄位一直顯示。選生病／工作／交通／天氣時選填，選「其他」時必填。有填時 `p_reason` 送「選項：補充說明」（例：`工作：臨時要加班`）；沒填時只送選項；選「其他」時只送補充說明。補充說明上限 480 字，確保合併後不超過 500 字。
- **對話框左側按鈕**：學員端與教練端的取消／拒絕對話框，左側按鈕一律叫「返回」（原本叫「取消」，容易與右側「取消預約」混淆）。
- **M4「查看詳情」**：改為「查看明細」並連到預約明細頁；教練公開頁改由卡片上的教練名稱連過去。

5 份 SQL 已抽成 `supabase/migrations/20261126100000`～`20261126100400` 五個檔，內容與本計畫的草稿相同。

## 執行後的修正（2026-11-26，整合測試抓到）

5 個 migration 於 2026-11-26 在 Supabase 執行。整合測試 T10-4、T10-13 抓到兩個問題，已修正 migration 檔並重新執行第 4、5 個檔。**migration 檔以 `supabase/migrations/` 內的版本為準，本文件 Task 4、Task 5 的 SQL 草稿是修正前的版本。**

- **原因只有換行／定位字元／全形空白時被當成有填**：`btrim` 只去半形空白。`log_activity`、`cancel_booking`、`reschedule_booking` 三處改用 `regexp_replace(..., '^[\s　]+|[\s　]+$', '', 'g')`。
- **`bookings_cancel_record_check` 擋不住「已取消但沒有取消類別」**：原本用 `or` 串接，類別為 null 時整個式子是 null，而 check 遇到 null 視為通過。改用 `case` 寫，每個分支都得到明確的 true／false。

## 風險與未決事項

每一項都先以「建議做法」寫進計畫，不因未決而停下。**標 ★ 的五項最需要 terry 決定。**

### ★ R1　`bookings` 可以不經函式直接修改（既有漏洞）

- **現況**：RLS 政策 `bookings_update` 允許學員與教練直接 `UPDATE` 自己看得到的預約；`bookings_insert` 允許直接新增。學員可以用瀏覽器直接送 REST 請求把自己的預約改成已確認、或取消而不留原因。這違反設計文件的反目標第 3 條，也讓「取消必填原因 × 直接呼叫 擋」這一格打不了勾。
- **已核對**：程式裡沒有任何地方用登入者身分直接新增或修改 `bookings`（Grep `from('bookings')` 後接 `.update(`／`.insert(`，只有排程用 service role 的一處，任務 23 會改掉）。
- **建議**：P1 就移除這兩條政策（Migration 5 第 3 段）。這是既有資料表的權限變更，需要 terry 明確同意。
- **若不同意**：把 Migration 5 第 3 段拿掉，並在對照表該格註明「未擋，留到 P5」；任務 10 案例 11 改為待辦。

### ★ R2　整合測試跑在哪個資料庫、上線時「取消」會短暫失敗

- **現況**：整合測試連的是 `.env.local` 指向的 Supabase，測試會建立與刪除測試租戶。新函式沒上去之前測試跑不過；函式一上去、新版程式還沒部署之前，舊版畫面的取消會失敗（舊程式不帶原因）。
- **建議**：若有（或願意開）獨立的測試專案或 Supabase branch，先在那裡執行五個 migration 並跑完整合測試，正式庫只在上線當下執行。若只有一個資料庫：照「上線順序」在離峰時段連續執行步驟 3、4，整合測試排在部署後。
- **需要 terry 回答**：有沒有獨立的測試資料庫？

### ★ R3　預約明細做成新頁面還是在清單上展開

- **現況**：教練端與學員端今天都**沒有**預約明細頁（「我的預約」的「查看詳情」其實是連到教練公開頁）。
- **建議**：新增兩個頁面 `/bookings/[bookingId]`、`/my-bookings/[bookingId]`。理由：P2 的請假申請、P4 的異議都要掛在預約明細上，推播也需要一個能直接連到的網址。
- **替代**：在清單卡片上展開或用側邊抽屜。省一個頁面，但推播無法直接連到單筆預約。
- 由任務 0 的示意圖一併決定。

### ★ R4　行事曆的時段標籤（可預約／待確認／已預約／已取消）P1 改不改

- **現況**：`slot-popover.tsx`、`list-view.tsx` 把時段狀態顯示成「待確認」，這是預約用語，§3.9 明訂時段不得這樣顯示（應為開放／額滿／關閉／已結束）。但 §18 把「行事曆顯示預約狀態與標記」排在 P5。
- **建議**：P1 不改。只把「待確認」換成「開放」會讓教練看不出這個時段已經有人預約，要等 P5 加上預約狀態標記才完整。P1 的對照表該格標為「留到 P5」。
- **替代**：P1 先做純文字對應（可預約→開放、待確認→開放、已預約→額滿、已取消→關閉）。

### ★ R5　改名的用語細節

- 設計文件只定義了「N 堂課、課堂管理、剩餘堂數、購課紀錄」。沒有數字的泛稱（例如「購買套裝」「尚無套裝」）要叫什麼，文件沒寫。
- **建議**：泛稱用「**堂數**」（購買堂數、沒有可用的堂數）；通知分頁用「**購課**」；教練審核頁叫「**購買申請**」。完整對照見「改名清單」，請 terry 在任務 0 過目。
- 另外順手統一：「退還」→「退回」、「核可／已生效／待教練確認」→「核准／已核准／審核中」、「購買記錄」→「購買紀錄」。

### R6　`activity_log` 比設計文件多一個欄位 `customer_id`

- **建議**：加。理由見「欄位切分」一節。若不同意，學員端的讀取權限要改成回頭 join 預約表，而且非預約類的紀錄（之後的購買、異議）學員就查不到。

### R7　「系統標為未出席」P1 就改成走函式並寫歷程

- **現況**：排程是用 service role 直接改表，沒有歷程。點名與待點名是 P4 的範圍。
- **建議**：P1 新增 `mark_no_show_bookings()`，行為不變、只是多寫一筆歷程。不做的話，P1 上線後到 P4 之間「預約變成未出席」會是唯一沒有紀錄的狀態變更，預約明細頁的歷程會突然斷掉。P4 會把這支函式換成待點名流程。

### R8　改寫函式時順手補上的五個防護（嚴格說屬於 P2 的規則）

改寫 `cancel_booking`、`reschedule_booking` 時，以下規則只要一兩行就能擋住，而且都是「畫面上已經做了、函式沒做」或「現行漏洞」，建議 P1 就放進去：

| 防護 | 現況 | 為什麼現在做 |
|---|---|---|
| 改期只能同一服務（`SERVICE_MISMATCH`） | 可以把 A 服務的堂數拿去上 B 服務的課 | 堂數漏洞；畫面本來就只列同服務的時段 |
| 改期的新時段不可已過去（`SLOT_PAST`） | 沒檢查 | 明顯的缺漏 |
| 被封鎖的學員不可改期（`CUSTOMER_BLOCKED`） | 沒檢查 | §17 對照表「封鎖 × 改期流程：擋」 |
| 開課後學員不可取消、改期（`SLOT_STARTED`） | 畫面已隱藏按鈕，函式沒擋 | 反目標第 3 條 |
| 學員取消**待確認**預約一律退回（即使已過期限） | 逾期不退回 | §7 表格。待確認表示教練還沒承諾；實務上只會發生在未成班的團班，而那種時段過了期限 5 分鐘內就會被系統自動取消 |

若 terry 認為應嚴守 P1 範圍，把這五項從 Migration 4 拿掉即可（各自獨立，任務 12 案例 6、任務 10 案例 3 與 9 跟著移除）。

### R9　購買的核准與拒絕沒有歷程，而且任何成員都能直接改已用堂數

- **現況**：核准、拒絕是程式直接改 `customer_purchases`（不是函式），助教也能做（§12 規定只有 Owner）；RLS 政策 `customer_purchases_update_member` 讓任何成員都能直接改 `classes_used`，會破壞「已用堂數 ＝ −明細加總」。
- **設計文件的缺口**：§10.1 要求購買的申請、核准、拒絕都要寫歷程，但 §18 沒有把它排進任何一個階段（P5 只提到撤回、作廢、防重複）。
- **建議**：P1 不做（範圍已經夠大，而且核准不會改變已用堂數）。請 terry 指定排進 P3（購課紀錄頁）或 P5，屆時新增 `review_purchase` 函式並收回 `customer_purchases` 的直接修改權限。P1 期間這是已知缺口。

### R10　P1 過渡期寫入的「學員取消＋不退回」與 P2 名額算法

- P2 的名額計算是「未取消的預約 ＋ 堂數處理為不退回的已取消預約」。P1 過渡期會產生「學員取消＋不退回」的紀錄，**那些不該佔名額**（沿用現況，時段會釋出）。
- **給 P2 的提醒**：名額條件要寫成 `cancel_category = 'late_cancel'`，不能只看 `class_disposition = 'forfeited'`。

### R11　平台設定的初始值

- §13 標明「初始值為建議值，待 terry 確認」。Migration 1 照建議值寫入，且已有的鍵不覆蓋。P1 實際只會用到 `customer_cancel_reasons`，其餘七個數值要到 P2～P4 才生效，之後隨時可以用 `UPDATE` 調整。

### R12　`legacy` 購買的判定是推論

- 判定條件是依當初 migration 寫入的樣子反推（無商品、1 堂、無到期日、無核准人、核准時間等於建立時間）。任務 3 附了預覽查詢，請 terry 執行前看過那份清單；若有誤判，回填後可以單筆改回 `purchase`。

### R13　PR #23（排版）未合併前不能開工

- #23 會重排大量檔案。四條線都要以「#22、#23 都合併後的 master」為基底，否則每條線都會有大面積衝突。目前 worktree 是 detached HEAD（origin/master 2b4136b），兩個 PR 都還沒進來。

### R14　手寫的型別檔可能與產生檔有出入

- 任務 6 是手動改 `types.ts`。任務 24 步驟 6 會用產生檔覆蓋並比對；若有差異以產生檔為準。
