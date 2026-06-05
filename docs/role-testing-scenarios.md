# 角色功能測試情境指南

依角色逐步驗證 QuickReserve 全部功能。每個步驟都附「操作 → 預期結果」，並對齊 `scripts/seed-test-data.mjs` 產生的測試資料，照著做即可重現。

---

## 0. 測試前置

### 啟動 + 重置資料

```bash
npm run dev                      # 終端 A：啟動應用
node scripts/seed-test-data.mjs  # 終端 B：重置 demo 測試資料（冪等，只動 demo- 租戶）
```

> 想從乾淨狀態重測，就重跑一次 seed。它只會清掉 `demo-` 開頭的測試租戶，不會碰真實資料。

### 測試帳號（密碼皆 `Test1234!`，平台除外）

| 角色 | 帳號 | 備註 |
|---|---|---|
| 教練 Owner | `demo-coach-wang@example.com` | 王教練，slug `demo-wang-coach`；有待確認預約可測 |
| 教練 Owner | `demo-coach-lin@example.com` | 林教練，slug `demo-lin-coach`；有頭像/影片/團體班，小明在此有有效套裝 |
| 助教 Staff | `demo-staff-ming@example.com` | 阿明，隸屬林教練 |
| 學員 | `demo-student-ming@example.com` | 小明；在林教練持有 10 堂「網球初級班」套裝 |
| 平台管理員 | `terry@gmail.com` | 密碼非 `Test1234!`（你自行重設的那組） |

### Seed 預先建好的關鍵狀態（測試會用到）

- 王教練：服務、晚間時段（19:00–21:00）、**1 筆小明送出的待確認預約**、小華未付款的待審核套票申請。
- 林教練：服務「網球初級班 / 網球進階班」+「網球團體班」（團體），可預約時段在 **今天+5 / 今天+12**，小明已預約其中一格（confirmed）。
- 小明：在林教練有 10 堂有效套裝（可繼續預約）；在王教練的套裝已用完（測「額度用盡」用）。

---

## 情境主線

> **「小明想多上一堂網球初級班」** —— 一條線串起四個角色：
> 學員小明上線預約 → 教練在後台確認、管理、設定 → 助教協助處理 → 平台管理員監看整體營運。

四個角色各自的詳細測試在下方；建議照 **學員 → 教練 → 助教 → 平台** 的順序跑，剛好對應這條故事線。

---

## 1. 學員（小明）— demo-student-ming

> 情境：小明已經跟林教練上過課，今天想再約一堂，順便看看自己的預約與套裝。

| # | 操作 | 預期結果 |
|---|---|---|
| 1 | 開 `/login`，以小明帳號登入 | 成功後導向 `/my-bookings` |
| 2 | 查看 `/my-bookings` | 看到 KPI：本週／待回覆／已完成／已取消；預約依日期分組列出（含先前 confirmed 那筆） |
| 3 | 開林教練主頁 `/demo-lin-coach` | 顯示教練簡介、頭像、服務區塊（網球初級班 / 進階班 / 團體班）與「時段 / SLOTS」 |
| 4 | 點服務「**網球初級班**」 | 下方時段選擇器切換為該服務；網址帶 `?service=...` |
| 5 | 在日期條切到 **今天+5 或 今天+12** | 該日出現可預約時段（TimeChip，如 11:30） |
| 6 | 點一個時段 chip → 點「**前往預約**」 | 進入 `/book/<slotId>`，顯示預約確認頁與套裝選擇 |
| 7 | 填備註 → 點「**送出預約申請**」 | 建立「待確認」預約，導回 `/my-bookings?booked=...`，新預約出現在「待回覆」 |
| 8 | 回 `/my-bookings`，對某筆按「**改期**」 | 導向教練頁 `?reschedule=<id>`；選新時段送出後，原預約取消、建立新的待確認 |
| 9 | 對某筆按「**取消預約**」→ 確認 | toast「已取消預約」，該時段釋出 |
| 10 | 開 `/demo-lin-coach/packages` | 看到教練公開販售的套票（單堂 / 10 堂套裝） |
| 11 | 開 `/demo-lin-coach/purchases` | 看到自己已購買／可用的套裝與剩餘堂數 |
| 12 | 開 `/account/notifications` | 可管理個人通知偏好 |

**邊界測試**：改用王教練 `/demo-wang-coach` 嘗試預約 → 因小明在王教練的套裝已用完，`/book` 頁顯示「**尚無可用套裝**／先去申請一個套裝才能預約」，無送出按鈕（預期行為）。

---

## 2. 教練 Owner（王教練）— demo-coach-wang

> 情境：教練早上打開後台，處理待確認預約、檢視行事曆、調整服務與設定。
> （主用王教練；媒體與團體班相關差異見文末「林教練補充」。）

### 2.1 儀表板與行事曆

| # | 操作 | 預期結果 |
|---|---|---|
| 1 | 登入後到 `/dashboard` | 黑色 Hero 問候（早安/午安/晚安）＋ 4 張 KPI（本週待確認／本週時段／今日預約／本月新學員）＋「今日預約」「待確認預約」兩區 |
| 2 | `/calendar?view=week` → 切 `month` / `list` | 三種視圖正常切換 |
| 3 | 點行事曆任一時段 | 跳出 SlotPopover，顯示「時間／負責成員／狀態」 |
| 4 | `/calendar/availability` | 顯示可預約時段模板（TEMPLATES） |
| 5 | `/calendar/rules` | 顯示「重複規則」管理 |

### 2.2 服務、套票、客戶

| # | 操作 | 預期結果 |
|---|---|---|
| 6 | `/services` | 服務列表，含「1-ON-1 / GROUP」分頁 |
| 7 | `/packages` | 套票列表，含 ALL / DRAFT 分頁 |
| 8 | `/packages/pending` | 套票審核佇列；對待審核項目按「**確認**」核准、或「**拒絕**」並填原因 |
| 9 | `/customers` | 客戶列表，可搜尋（`q`）、依狀態篩選、點列開抽屜看詳情 |

### 2.3 預約管理（核心 mutation）

| # | 操作 | 預期結果 |
|---|---|---|
| 10 | `/bookings`，篩選「待確認」 | 列出待確認預約（含小明那筆） |
| 11 | 對待確認預約按「**確認**」 | toast「已確認」，狀態轉為已確認，學員收到通知（若啟用推播） |
| 12 | 對某筆按「**取消**」→ 確認 | toast「已取消」，時段釋出，學員收到通知 |

### 2.4 助教、通知、設定

| # | 操作 | 預期結果 |
|---|---|---|
| 13 | `/staff` → 填 Email → 「**送出邀請**」 | toast「已建立邀請」，畫面出現「邀請連結（請傳給助教）」 |
| 14 | 開該邀請連結 `/invite/<token>` | 顯示「**接受邀請**」畫面（租戶名稱＋登入帳號＋接受按鈕）。未登入者會被導向 `/signup?invite=...` |
| 15 | `/notifications` | 通知收件匣四分頁（全部／預約／套票／系統）＋「推播偏好」入口 |
| 16 | `/settings/profile` | 個人/品牌設定多區塊（基本資料、Hero 等） |
| 17 | `/settings/notifications` | 事件 × 通道通知矩陣（多個勾選）＋「勿擾時段」 |

---

## 3. 助教 Staff（阿明）— demo-staff-ming

> 情境：阿明被林教練加入團隊，協助看時段與處理預約，但不能動到工作室層級的設定。

| # | 操作 | 預期結果 |
|---|---|---|
| 1 | 登入阿明帳號 | 進入林教練工作室的後台 |
| 2 | `/dashboard`、`/calendar`、`/bookings`、`/customers`、`/services`、`/packages`、`/notifications` | **可正常存取**（看到的是林教練的資料） |
| 3 | 協助在 `/bookings` 確認一筆待確認預約 | 與教練相同，可確認/取消 |
| 4 | 嘗試開 `/settings/profile` | **權限邊界**：被自動導回 `/dashboard`（助教不能改工作室設定） |

> 測完整邀請流程：在教練端產生邀請連結後，登出、以新帳號開連結 → 走 `/signup?invite=...` → 接受 → 成為助教。

---

## 4. 平台管理員（terry）— 全平台監看

> 情境：平台方檢視所有租戶與全站營運狀況。

| # | 操作 | 預期結果 |
|---|---|---|
| 1 | 以 `terry@gmail.com` + 你重設的密碼登入 | 可進入 `/platform/*` |
| 2 | `/platform/dashboard` | 6 張 KPI（啟用租戶／使用者總數／預約紀錄總數／待確認預約 等） |
| 3 | `/platform/tenants` | 全部租戶列表（含 demo-wang / demo-lin / demo-chen） |
| 4 | 點任一租戶 → `/platform/tenants/<id>` | 單一租戶詳情 |
| 5 | `/platform/bookings` | 全平台預約，含狀態篩選（全部／待確認…） |

> 一般教練帳號開 `/platform/*` 應被擋下（非平台管理員）。

---

## 5. 進階 / 邊界情境

| 情境 | 怎麼測 | 預期 |
|---|---|---|
| 套票額度用盡 | 小明用「王教練」嘗試預約 | `/book` 顯示「尚無可用套裝」，無送出按鈕 |
| 取消釋出時段 | 學員或教練取消一筆預約 | 該時段回到可預約，其他人能再約 |
| 改期 | 學員 `/my-bookings` 按「改期」並選新時段 | 原預約取消、建立新的「待確認」 |
| 團體班成團門檻 | 看林教練「網球團體班」時段（4/3、24h 內未達 min） | 由 cron 自動取消（seed 已建好此情境） |
| 勿擾時段 | `/settings/notifications` 設定勿擾時段 | 該時段內不發推播 |
| 助教權限 | 阿明開 `/settings/profile` | 被導回 dashboard |
| 邀請接受 | 未登入開邀請連結 | 導向 `/signup?invite=...&email=...` 預填 Email |

---

## 6. 驗收檢查表（全 26 頁面）

逐項勾選，確保每頁都實際開過：

**公開 / 認證**
- [ ] `/login`　- [ ] `/signup`　- [ ] `/invite/<token>`（有效邀請畫面）

**教練後台（tenant）**
- [ ] `/dashboard`　- [ ] `/calendar`（週/月/清單 + popover）
- [ ] `/calendar/availability`　- [ ] `/calendar/rules`
- [ ] `/services`　- [ ] `/packages`　- [ ] `/packages/pending`（確認/拒絕）
- [ ] `/customers`　- [ ] `/bookings`（確認/取消）　- [ ] `/staff`（送出邀請）
- [ ] `/notifications`　- [ ] `/settings/profile`　- [ ] `/settings/notifications`

**學員（customer）+ 公開頁**
- [ ] `/my-bookings`（改期/取消）　- [ ] `/account/notifications`
- [ ] `/<slug>`（選服務→時段）　- [ ] `/<slug>/packages`　- [ ] `/<slug>/purchases`
- [ ] `/book/<slotId>`（送出預約申請）

**平台（platform）**
- [ ] `/platform/dashboard`　- [ ] `/platform/tenants`　- [ ] `/platform/tenants/<id>`　- [ ] `/platform/bookings`

---

## 林教練補充（媒體 / 團體班差異）

- 林教練主頁有頭像、自我介紹、影片與相片 → 適合驗證「公開頁媒體呈現」。
- 林教練有「網球團體班」（多人時段，顯示 `已報名/容量`，例如 2/3）→ 驗證團體預約與成團邏輯。
- 小明在林教練持有 10 堂有效套裝 → 學員「實際送出預約」請用林教練（王教練套裝已用完）。

---

## 自動化對照

本文件的人工測試路徑，與自動錄製的教學影片 / E2E 互相對應：

- 教學影片（含真實操作）：`docs/tutorials-recording.md`、`npm run tutorial:record`
- 既有 E2E 煙霧測試：`tests/e2e/*.spec.ts`、`npm run test:e2e`
