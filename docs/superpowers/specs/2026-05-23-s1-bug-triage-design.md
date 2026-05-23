# S1 — Bug Triage 設計文件

**建立日期**：2026-05-23
**狀態**：草稿（待使用者複審）
**作者**：terry@webplus.com.tw（透過 brainstorming skill 共同產出）
**Parent spec**：[`2026-05-21-quickreserve-redesign-design.md`](2026-05-21-quickreserve-redesign-design.md)（FR-110~114 將回寫到 parent spec 附錄 C）

---

## 1. 背景

使用者於 2026-05-23 完整走過 4 個角色後，回報一份跨層級的待辦清單（bug、缺功能、效能、設計系統）。經過 scope 拆解，整理為 6 個子專案（S1~S6）：

| 子專案 | 內容 | 順序 |
|---|---|---|
| **S1** | 緊急 bug 修復 + 防護網 | **現在** |
| S2 | 全站效能與 loading 規範 + RWD 全面檢視 | 之後 |
| S3 | 行事曆與可用性管理（教練可上課時段、unavailable events、批量、林教練測試資料） | 之後 |
| S4 | 服務與商品模型擴充（團班最少人數、套裝課程、軟刪除規範化） | 之後 |
| S5 | 教練介紹頁與品牌、學員登入流程 | 之後 |
| S6 | 設計系統重塑 + 系統架構/資安/可維護性 review | 最後 |

S1 是其他子專案的前置：S2 量測效能前需要 `/platform/bookings` 不爆炸、需要 `/platform/tenants` 可以邀請新教練建測試資料、需要通知設定可以正常設定（影響後續測試教練收通知）。

---

## 2. 範圍

### 2.1 In scope
- **B1**：邀請新教練流程修復（slug normalize + field-level validation errors）
- **B2**：`/platform/bookings` 錯誤 `digest=2263577791` 修復（Server Component 違規）
- **B3**：通知設定離開租戶 layout 修復（route group 錯置）
- **B4**：`/platform/tenants` 載入慢的「**感知**」修復（loading skeleton + 並行 query）
- **防護網**：共用 `<FormFieldErrors>`、共用 `<PageSkeleton>`、平台群組其餘頁面 loading skeleton、README 加 error.digest runbook

### 2.2 Out of scope（明確排除）
- Sentry / 正式 monitoring 整合 → S2
- 全站（含 tenant / customer / public 群組）的 skeleton 與效能優化 → S2
- 真正的冷啟動修復（regions、warm-up、edge runtime） → S2
- 系統性 RWD 檢視 → S2
- 設計系統 / 主題色 / 字型統一 → S6
- 教練可上課時段、unavailable events、團班、套裝、教練介紹頁等新功能 → S3~S5

---

## 3. Bug RCA 與修法

### B1：邀請新教練失敗

**現象**：使用者填入 email `scterry0327@gmail.com` / 租戶名稱 `Terry 測試` / Slug `TerryTest`，送出後只看到通用 toast「邀請失敗」，無欄位提示。

**根因**：
1. `src/app/(platform)/platform/tenants/actions.ts` Zod schema 規定 `tenantSlug` 為 `^[a-z0-9-]+$`，大寫字母會 reject。
2. `src/app/(platform)/platform/tenants/invite-coach-form.tsx` 的 `useAction` `onError` 只讀 `error.serverError?.message`，next-safe-action 的 schema 失敗實際放在 `result.validationErrors`，因此欄位錯誤訊息被丟掉，只剩泛用 toast。

**修法**：
- **B1-a** Slug input 即時 normalize：onChange 時把輸入轉小寫、把空白與底線替換為 `-`、過濾掉非 `[a-z0-9-]` 字元。使用者打 `TerryTest` 即時顯示 `terrytest`、打 `Terry Test` 顯示 `terry-test`。
- **B1-b** 新增共用 `src/components/forms/form-field-errors.tsx`：吃 `useAction` 回傳的 `result.validationErrors[fieldName]`，顯示為欄位下方紅字。同時套用到 `invite-coach-form.tsx` 與 `(tenant)/staff/invite-staff-form.tsx`。
- **B1-c** Slug 欄位加 helper text：「公開連結網址，只能小寫英數和短橫線。例：`terry-test`」。
- 純函式 `normalizeSlug(input: string): string` 抽到 `src/lib/utils/slug.ts`，加 unit test。

**驗收**：
- 打 `TerryTest` → input 自動變 `terrytest`，可成功送出建立租戶與邀請。
- 故意貼上中文或全形字 → 欄位下方顯示具體錯誤，不只是泛用 toast。
- 邀請成功後 toast 與 URL 卡片仍正常出現，invite_token 寫入 DB。
- inviteStaffForm 同樣具備 field-level error 顯示。

---

### B2：`/platform/bookings` 錯誤代碼 2263577791

**現象**：開啟頁面立即跳到 error boundary，顯示「錯誤代碼：2263577791」。

**根因**：`src/app/(platform)/platform/bookings/page.tsx` 為 Server Component（無 `'use client'`），但在第 87–104 行有 `<select onChange={...}>` 與 `window.location.href` 呼叫。Server Component 無法序列化 function prop，Next.js 在 render 時丟錯，error boundary 顯示 `error.digest` hash。

**驗證**：直接以 admin client 重跑該頁完整 query（4 筆預約全數成功回傳），證明 RLS、PostgREST、資料皆無問題。

**修法**：
- 抽 `src/app/(platform)/platform/bookings/tenant-filter.tsx` 為 client component（`'use client'`），使用 `useRouter().push` 觸發 URL 變更，保留現有 query params 行為。
- `page.tsx` 改為純 server render：保留 status filter 的 `<Link>` 寫法（本來就正確），改用 `<TenantFilter>` 取代 inline `<select>`。
- 順手把 `bookings` query 與 `tenants` query 改為 `Promise.all` 並行（小最佳化）。
- 同檔順手 grep：其餘 `(platform)` 群組頁面確認無相同錯誤模式（已先驗 `tenants-table.tsx` 為 client，OK）。

**驗收**：
- `/platform/bookings` 不再丟 error.digest，正常顯示預約列表。
- 切換 status filter（透過 `<Link>`）正常運作。
- 切換 tenant 下拉 → URL 更新 → server re-fetch → 顯示對應預約。
- 所有 status × tenant filter 組合可用。

---

### B3：通知設定跳出 sidebar

**現象**：教練從左側欄點「通知設定」後，整個 layout 變成單欄 header，sidebar 消失。

**根因**：通知設定頁僅存在於 `src/app/(customer)/settings/notifications/page.tsx`，但 `(tenant)/sidebar-nav.tsx` 第 35 行連到 `/settings/notifications`。Next.js 路由忽略 group 名稱，會解析到 customer group 的 page，套用 customer layout（單欄 header）。

**修法**：拆共用 component + 雙 route 註冊
- 新增 `src/components/settings/notification-preferences.tsx`：包裝既有的 `PushOptIn` 與 `PreferencesForm`，server-rendered，自身呼叫 supabase 取得 prefs。
- `(customer)/settings/notifications/page.tsx` 改為薄包裝：呼叫 `requireSession()` → render 共用 component。
- **新增** `src/app/(tenant)/settings/notifications/page.tsx`：呼叫 `requireTenantMember()` → render 同一個共用 component。
- `(customer)/settings/notifications/actions.ts` 不動，兩個 page 共用。

**為什麼不採共用 `(authenticated)` layout**：那需要重排整個 layout hierarchy、把 sidebar 變 role-aware chrome，影響面遠超 S1 範圍。雙 route 是最小變動。

**驗收**：
- 教練（owner / staff）從 sidebar 點「通知設定」→ 留在 tenant layout，sidebar 還在，可儲存偏好。
- 學員從 customer header 點「通知設定」→ 留在 customer layout，可儲存偏好。
- 兩條路徑下 push opt-in 與 preferences form 行為一致。

---

### B4：`/platform/tenants` 載入慢（感知問題）

**現象**：使用者感覺載入時間長。

**根因**（量測證實）：
- 冷查詢：tenants 601ms + owners 95ms ≈ 700ms
- 熱查詢：tenants 74ms + owners 74ms ≈ 150ms
- 資料量小（3 筆），純 DB query 不是瓶頸
- 主要痛點是「冷啟動 + 兩 query 串列 + 完全沒有 loading 體感」三件事疊加

**修法（S1 範圍只做便宜的）**：
- **B4-a** 新增 `src/app/(platform)/platform/tenants/loading.tsx`：使用 `<PageSkeleton>` 立即顯示骨架，避免白屏。
- **B4-b** `page.tsx` 把 tenants 與 owners 兩 query 改為 `Promise.all` 並行（節省 ~75–95ms）。
- **B4-c** 同樣加 `loading.tsx` 給 `(platform)` 群組其餘重 query 頁：`/platform/dashboard`、`/platform/bookings`、`/platform/tenants/[tenantId]`。
- **B4-d** 新增 `src/components/ui/page-skeleton.tsx` 共用元件，避免 copy-paste；props：`{ rows?: number; withHeader?: boolean }`。
- **B4-e** README 加一段 runbook「`error.digest` 怎麼查」：說明在 Vercel function logs 用 digest hash grep server log 找對應 stack。

**B4 不做的事**：
- 真正解冷啟動（edge runtime / regions / warm-up）→ S2
- `(tenant)` / `(customer)` / `[tenantSlug]` 群組的 loading skeleton → S2
- 整體效能量測與優化 → S2

**驗收**：
- `/platform/tenants` 冷啟動時立即顯示 skeleton，~700ms 後渲染真實資料，無白屏。
- `/platform/dashboard`、`/platform/bookings`、`/platform/tenants/[tenantId]` 同樣有 skeleton。
- 並行 query 後 server-side 渲染時間下降（不必精確量測，只需 code review 確認 `Promise.all`）。
- README 包含 error.digest runbook。

---

## 4. 檔案異動清單

### 新增
- `src/app/(platform)/platform/bookings/tenant-filter.tsx`
- `src/app/(tenant)/settings/notifications/page.tsx`
- `src/components/settings/notification-preferences.tsx`
- `src/components/ui/page-skeleton.tsx`
- `src/components/forms/form-field-errors.tsx`
- `src/lib/utils/slug.ts`
- `src/app/(platform)/platform/tenants/loading.tsx`
- `src/app/(platform)/platform/dashboard/loading.tsx`
- `src/app/(platform)/platform/bookings/loading.tsx`
- `src/app/(platform)/platform/tenants/[tenantId]/loading.tsx`
- `tests/lib/normalize-slug.test.ts`

### 修改
- `src/app/(platform)/platform/bookings/page.tsx` — 抽 client filter、並行 query
- `src/app/(platform)/platform/tenants/page.tsx` — 並行 query
- `src/app/(platform)/platform/tenants/invite-coach-form.tsx` — 套 `<FormFieldErrors>` + slug normalize + helper text
- `src/app/(tenant)/staff/invite-staff-form.tsx` — 套 `<FormFieldErrors>`
- `src/app/(customer)/settings/notifications/page.tsx` — 改為薄包裝
- `README.md` — error.digest runbook + route map 補 `(tenant)/settings/notifications`
- `docs/superpowers/specs/2026-05-21-quickreserve-redesign-design.md` — 附錄 C 加入 FR-110~114

### 刪除
- `scripts/debug-bookings-query.mjs` — debug 期間用的腳本，spec 完成前清掉

---

## 5. 測試策略

**Unit**（新增 1 個）
- `tests/lib/normalize-slug.test.ts` — 純函式測試，覆蓋大小寫、空白、特殊字元、中文、空字串等 case。

**Integration / E2E**：不寫
- 4 個 bug 都是 UI / routing layer 問題，手動驗收 + screenshot 較划算。
- E2E 框架尚未建立，屬於 S2 範疇。

**手動驗收清單**
1. 邀請流程：用 `TerryTest` / `Terry Test` / 貼中文驗 slug normalize 與 field error
2. `/platform/bookings`：直接開頁面 → 不爆 → 切 filter 都正常
3. 通知設定：以 owner / staff / customer 三種身分各自走一次
4. `/platform/tenants` 與其他 3 個平台頁的冷啟動 skeleton 出現

---

## 6. 風險與緩解

| 風險 | 機率 | 緩解 |
|---|---|---|
| 新增 `(tenant)/settings/notifications/page.tsx` 與 customer 版漂移 | 中 | 兩邊都是薄包裝，邏輯集中於共用 component；review 時確認兩個 page.tsx 都不直接呼叫 supabase |
| `<TenantFilter>` 用 `useRouter().push` 後遺失 status filter | 低 | 實作時讀取既有 searchParams 一併攜帶；驗收手動跑「先選 status 再選 tenant」case |
| `<FormFieldErrors>` 與 sonner toast 同時出現訊息冗餘 | 低 | 規範：validation errors 顯示在欄位、server errors 用 toast。文件化於 wrapper 註解 |
| `Promise.all` 後若一個 query 失敗整頁爆 | 低 | 維持目前 page-level error boundary 就好；不引入 fallback 邏輯（屬於 S2 監測範疇） |

---

## 7. FR 編號（將回寫到 parent spec 附錄 C）

- **FR-110**：邀請流程 slug normalize + field-level validation errors（B1）
- **FR-111**：`/platform/bookings` Server Component event handler 修正（B2）
- **FR-112**：通知設定 route 群組分離（B3）
- **FR-113**：平台群組 loading skeleton + 並行 query（B4-a~d）
- **FR-114**：`error.digest` runbook（B4-e）

---

## 8. doc 更新清單（按 [feedback-docs-after-impl] memory）

- `README.md`
  - 加「除錯 runbook：`error.digest` 怎麼查」一節
  - 路由地圖補 `(tenant)/settings/notifications`
- `docs/superpowers/specs/2026-05-21-quickreserve-redesign-design.md`
  - 附錄 C 加 FR-110~114 條目，標 commit hash（plan 完成後回寫）
- `docs/ux-audit.md`：不動（這 4 個是 audit 之後新發現，由本 spec FR-### 追蹤）
- `GEMINI.md`：不動

---

## 9. 後續

完成本 spec → 交棒 writing-plans skill → 產出 task 分解 plan → 實作 → 完成後 commit hash 回寫到 parent spec 附錄 C 與本檔 FR 表。S1 完成後立刻接 S2。
