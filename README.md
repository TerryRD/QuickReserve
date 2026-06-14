# QuickReserve — B2B2C 預約系統 SaaS

一個多租戶預約 SaaS 平台，給服務提供者（教練、顧問等）管理可預約時段、開放給自己的客戶預約。

> 舊版的 ASP.NET Core + Vue 原型已移除；如需查閱，可從 git 歷史中找回 `legacy/` 目錄。

---

## 技術堆疊

| 層 | 技術 |
|----|------|
| 框架 | Next.js 15（App Router、RSC、Server Actions） |
| 語言 | TypeScript (strict) |
| UI | Tailwind CSS + shadcn/ui (base-ui) |
| 表單 | React Hook Form + Zod |
| Server Action | `next-safe-action`（統一錯誤處理） |
| 資料庫 | Supabase PostgreSQL（RLS、GIST EXCLUDE、RPC） |
| 認證 | Supabase Auth |
| 通知 | Web Push（VAPID）+ Service Worker |
| 排程 | Vercel Cron（4 個 job） |
| 部署 | Vercel（Production + Preview per branch） |
| 測試 | Vitest（unit + integration with live Supabase） |

---

## 三層使用者

| 角色 | 進入方式 | 可做什麼 |
|------|---------|---------|
| **平台管理員** | SQL 加入 `platform_admins` 表 | 看所有租戶 / 暫停啟用 / 邀請新教練 / 平台儀表板 |
| **教練 Owner** | 平台管理員邀請 | 管理服務、行事曆、預約、邀請助教、看助教行事曆 |
| **教練 Staff（助教）** | Owner 邀請 | 管理自己的行事曆與預約 |
| **學員 (Customer)** | 自行註冊 | 透過 `/[tenantSlug]` 預約教練、看自己的預約 |

---

## 路由地圖

```
/                              首頁（依角色 redirect）
/login, /signup, /callback     Auth
/invite/[token]                邀請接受流程

(platform) — 平台管理員
  /platform/dashboard          統計儀表板（6 KpiCard）
  /platform/tenants            租戶管理（邀請 / 暫停 / 啟用）
  /platform/tenants/[id]       單一租戶 drill-in
  /platform/bookings           全平台預約唯讀檢視
  /platform/account            個人帳號設定（姓名 / 密碼 / Email）

(tenant) — 教練後台
  /dashboard                   儀表板（黑底 hero + 4 KPI + today timeline + pending column）
  /calendar                    行事曆 ?view=week|list|month + slot popover
  /calendar?member=<id>        Owner 檢視他人行事曆
  /calendar/availability       作息模板 + 不可用事件 + materialize 預覽（S3）
  /calendar/rules              重複規則管理（4 種類型 + 結束條件）
  /services                    服務項目管理 ?tab=all|1on1|group
  /bookings                    預約管理（確認 / 取消）
  /customers                   學員管理（搜尋 + 篩選 + 詳情 drawer）
  /staff                       助教管理（Owner 限定）
  /notifications               通知收件匣 ?tab=all|bookings|packages|system（notification_log inbox）
  /settings/profile            租戶資料 6 sections + sticky save bar（Owner 限定）
  /settings/notifications      通知偏好 — 事件×通道矩陣（web_push + in_app）+ 勿擾時段
  /settings/account            個人帳號設定（姓名 / 密碼 / Email）— Owner & Staff
  /packages                    套裝管理 ?tab=all|1on1|group|draft（按服務分組）（S4）
  /packages/pending            待審核購買申請佇列 + 4 KpiCard（S4）

(customer) — 學員後台
  /my-bookings                 我的預約 + 4 KpiCard + DateStrip 群組 + 改期 link
  /account                     個人帳號設定（姓名 / 密碼 / Email）
  /account/notifications       通知偏好（學員端,獨立於 tenant /settings/notifications）

[tenantSlug] — 公開預約頁
  /[slug]                      教練介紹 + hero meta + bio + video + gallery + services + slot picker
  /[slug]?reschedule=<id>      改期模式（黃色 banner + 選新時段後原預約自動取消）
  /book/[slotId]               預約確認頁 + 套裝餘額 radio cards
  /[slug]/packages             可購方案瀏覽 + POPULAR pill + in-card 申請（S4）
  /[slug]/purchases            學員看自己的餘額（S4）

API
  /api/cron/materialize-recurring    每日 00:30 UTC+8（90 天滑動視窗）
  /api/cron/weekly-summary           每週日 20:00 UTC+8
  /api/cron/daily-reminder           每小時 06-12 UTC+8（hourly cron）
  /api/cron/pre-event-reminder       每分鐘（需 Vercel Pro）
  /api/cron/auto-cancel-group-class  每小時 xx:00（團班人數不足 auto cancel + 退課數）
  /api/cron/checkin-reminder         每分鐘（由 Supabase pg_cron 驅動，post-deploy 設定）
  /api/push/subscribe                Web Push 訂閱
```

---

## 開發環境設定

### 先決條件

- Node.js 20+
- npm 10+
- Vercel CLI (`npm i -g vercel`)
- Supabase CLI（已透過 devDependency 提供 `npx supabase`）
- Supabase 雲端 project + Vercel project（兩者已串接 GitHub）

### 第一次設定

```bash
# 1. Clone
git clone https://github.com/TerryRD/QuickReserve.git
cd QuickReserve

# 2. 安裝
npm install

# 3. 連結 Vercel（會問 login → 選 project）
vercel link

# 4. 拉 env vars 到本機
vercel env pull .env.local

# 5. 連結 Supabase
npx supabase login  # 或設 SUPABASE_ACCESS_TOKEN env
npx supabase link --project-ref <your-project-ref>

# 6. 套 migrations（cloud DB 已有，本機僅同步檔案）
npm run db:push
npm run db:types  # 重新產生 TS 型別

# 7. 啟動 dev server
npm run dev      # http://localhost:3000
```

---

## 環境變數

| 變數 | 說明 | 敏感 |
|------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | 否 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase publishable key | 否 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase secret key（server-only） | **是** |
| `SUPABASE_PROJECT_REF` | Supabase project ref | 否 |
| `NEXT_PUBLIC_APP_URL` | 應用 base URL | 否 |
| `CRON_SECRET` | Vercel Cron 認證 token | **是** |
| `LOG_LEVEL` | `info` / `debug` / `error` | 否 |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Web Push 公鑰 | 否 |
| `VAPID_PRIVATE_KEY` | Web Push 私鑰 | **是** |
| `VAPID_SUBJECT` | `mailto:` 聯絡信箱 | 否 |
| `SUPABASE_DB_PASSWORD` | Supabase 資料庫密碼（`npm run db:types` 直連 DB 需要；Dashboard → Project Settings → Database） | **是** |

---

## 開發指令

```bash
npm run dev              # 啟動 dev server
npm run build            # 產生 production build
npm run lint             # ESLint
npm run format           # Prettier 寫入
npm run format:check     # Prettier 檢查（CI 用）
npm run typecheck        # TypeScript 檢查
npm run test             # Unit tests (Vitest)
npm run test:integration # 對 live Supabase 跑整合測試
npm run db:push          # 套 migrations 到 cloud
npm run db:diff          # 看 cloud vs local schema diff
npm run db:types         # 從 cloud schema 重新產生 src/lib/supabase/types.ts（需先 `npx supabase login` 並在 .env.local 設 SUPABASE_DB_PASSWORD；script 已自動載入 .env.local。若不想設定，可改用 Supabase MCP 的 generate_typescript_types 工具重生型別）
npm run db:reset         # 重置 cloud DB（小心！）
```

---

## 效能 playbook

### `loading.tsx` 慣例

- 每個 segment 都該有 `loading.tsx`，除非該 segment 是 static prerender（如 `/login`、`/signup`）。
- 一般 dashboard / 列表頁用共用 `<PageSkeleton rows={N} />`，row 數依該頁主視覺區塊抓最像的（dashboard 4、bookings 8 等）。
- 公開頁 `/[tenantSlug]` 用客製 `<PublicPageSkeleton>`，因為版型差異大（hero + service grid + date strip + slot grid）。

### Suspense 切塊使用時機

當下列任一條件成立，把 heavy server query 包進 `<Suspense fallback={...}>`：

- query ≥ 2 表 join 或 limit > 50 筆
- 量測 warm 中位數 > 300ms
- 該區塊可獨立於其他內容渲染（例如：邀請表單不依賴租戶列表）

切塊 pattern（page.tsx）：

```tsx
export default function Page() {
  return (
    <div>
      <Header />  {/* 立即送 */}
      <Suspense fallback={<TableSkeleton rows={5} />}>
        <HeavyDataTable />  {/* async server component */}
      </Suspense>
    </div>
  )
}

async function HeavyDataTable() {
  const data = await heavyQuery()
  return <Table rows={data} />
}
```

### 公開時段 API + 快取邊界

- 公開頁時段查詢透過 `/api/public/slots` Route Handler 拉取，伺服端用 `unstable_cache` 包覆並 tag = `publicSlotsTag(tenantId)`（位於 `src/lib/cache-tags.ts`）。
- Response 帶 `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`，Vercel CDN edge cache 一份。
- 任何寫入 `availability_slots` 的 server action / cron 都必須呼叫 `revalidateTag(publicSlotsTag(tenantId))` 主動失效。
- 教練端 publish 後，學員端最遲 60 秒看到變化（CDN s-maxage 上限）。

### 量測流程

1. production URL，台灣 / Chrome 最新版
2. 連續操作 5 次，第 3、4、5 次中位為 warm hit
3. 寫進 `docs/s2-perf-measurements.md`
4. 超標路徑進 exception 清冊（含原因 + 處理時機）

### useSearchParams 邊界

凡是 client component 用 `useSearchParams()`，呼叫端必須包在 `<Suspense fallback={...}>` 內 — 否則 Next.js 15 PPR / 部分預渲染會悄悄退化。範例：`/[tenantSlug]/page.tsx` 包 `<SlotPicker>`、`/calendar/page.tsx` 包 `<CalendarPanel>`。

### RWD 慣例

- 目標 viewport：375 × 667（iPhone SE）為下限；768 × 1024（iPad mini）為平板分界。
- 行事曆週視圖在 ≤ 640px 自動切換為日視圖（`CalendarPanel` mount effect）。
- 詳細 audit 表：`docs/s2-rwd-audit.md`。

---

## 可用時段（Availability）

教練可選擇性地設定：

### 作息模板（templates）

- 每位 member 可有多個命名模板（「日常作息」「夏季作息」…）
- 每模板含 7 天 × 任意段數的 `start_time`–`end_time`
- 同一時刻只有一個模板「生效」（透過 `availability_template_assignments` 表的 `effective_from` 排序）
- 切換生效 = insert 新一筆 assignment，**不**刪歷史

### 不可用事件（unavailable_events）

- 每位 member 可任意時間區段標記為不可用（看醫生、休假、隨機）
- 與作息模板正交：模板給「日常可上課時段」，event 是「臨時打洞」

### Effective availability

`src/lib/availability.ts` 的 `effectiveAvailability` 純函式：

```
effectiveAvailability(date, template, events) =
  template.windowsFor(weekday)  // 該日 windows
  - events overlapping that day // 集合減法
```

- 無 template → 不限制（current behavior）
- Server actions (`createSlotAction` / `createRecurringRuleAction`) 與 cron `materialize-recurring` 都用此函式過濾
- 公開頁 `/api/public/slots` 不用：slot 是已過濾結果

### 撞 event 的既有 slot

教練建立 event 撞到既有 slot（含 pending/booked）時：
- Event 直接建立、不動 slot
- /calendar 主畫面該 slot 顯示 ⚠ 徽章；SlotPopover 紅黃提示
- 教練自行決定是否取消那些既有預約

---

## 套裝 / 課數模型（S4）

QuickReserve 把「單堂課」與「套裝」用同一張表（`customer_purchases`）表達：

- **單堂課** = `classes_total = 1` 的 purchase（class_count=1 package）
- **套裝** = `classes_total > 1` 的 purchase（class_count>1 package）

**購買流程：**
1. 學員瀏覽 `/[slug]/packages` 看可購方案
2. 提交申請（自報已付/未付）→ `customer_purchases` row, `approval_status='pending_review'`
3. 教練於 `/packages/pending` 審核：
   - 確認 → status 變 `confirmed`，`expires_at` = approved_at + `package.expires_in_days * 24h`
   - 拒絕 → status 變 `rejected`，留下 `rejected_reason`
4. 預約消費：`book_with_purchase` RPC 自動找最快過期的 active purchase，increment `classes_used`，attach 到 booking 的 `purchase_id`

**取消與退費（取消期限唯一決定，2026-06-13）：**
- 退費僅由服務的 `cancel_deadline_hours` 決定——堂數在預約當下就扣，是否退還只看取消時機。
- 學員取消：在 `start_at − cancel_deadline_hours` 之前（含當下）取消才退一堂；超過期限取消仍會取消預約並釋出時段，但**不退**（堂數作廢）。
- 教練 / 管理者取消：**一律退**一堂，不受期限限制。
- 團班 auto-cancel → 視同教練取消，所有 booking 學員一起退。
- 取消對話框與成功 toast 會依 `isWithinCancelDeadline`（client 端，與 RPC 同輸入）顯示「會 / 不會退還堂數」；RPC 為伺服器端唯一真實來源。

**未到場（no_show，2026-06-13）：**
- `checkin-reminder` cron 每分鐘掃描：`confirmed` + 未簽到 + slot 已結束的預約 → 標記 `no_show`（僅標籤，回應含 `noShowMarked`）。
- 純標籤、**不動 `classes_used`**：該堂在預約時已扣、因未在期限內取消而作廢。30 天下限避免首次執行掃描遠古資料。
- `/my-bookings` 顯示「未到場」徽章與「未到場 · 未退還此堂」說明。

**過期：**
- `expires_at` 為 null = 永久；非 null = 該時間後不可用於新預約
- 已扣的 classes_used 不退

## 團班（Group Class, S4）

`services` 表有三個欄位控制團班行為：

| 欄位 | 預設 | 意義 |
|---|---|---|
| `max_capacity` | 1 | 此 slot 最多多少人 |
| `min_attendance` | 1 | 要 N 人才開課；達 min 自動 confirm |
| `cancel_deadline_hours` | 24 | 開課前 N 小時若仍不足 min 就 auto-cancel |

**1-on-1（預設）：** capacity=1 min=1 deadline 任意值（無 group 邏輯觸發）

**團班：** capacity=4 min=3 deadline=24h
- 第 3 個學員 book 後 → 所有 pending bookings auto-confirmed
- 開課前 24h 仍 < 3 人 → cron 取消 slot、退課數、通知所有人

**Slot lifecycle（2026-05-29 重寫,A-6）:**

```
available  = 0 active bookings
pending    = 1 ≤ count < max_capacity     ← 團班還可加人
booked     = count ≥ max_capacity         ← 滿了
```

Booking row state(`bookings.status` pending / confirmed / cancelled / completed)獨立於 slot state。`book_with_purchase` 在 `count + 1 >= min_attendance` 時 bulk auto-confirm 全部 pending bookings(slot 狀態不變),只在 `count + 1 >= max_capacity` 才把 slot 設 `booked`。`cancel_booking` / `reschedule_booking` 重算剩餘人數決定 slot 變 `pending` 或 `available`。1-on-1 服務(max=1, min=1)外觀行為完全不變(count=1=max → 直接 booked)。

**公開頁 group capacity:**
- `/api/public/slots` 回傳 `max_capacity` + `current_bookings`
- `SlotPicker` 用 `TimeChip state='group'` 顯示 N/M(`max_capacity > 1` 才出現),滿了的 slot 由 status filter + count guard 雙重排除

Cron 排程：**Vercel Hobby plan 只支援 daily**（`0 0 * * *`），所以 auto-cancel 最多 24h 延遲。若需更短粒度（例如 hourly 對 `cancel_deadline_hours = 1` 才即時）必須升級 Pro 後改 `0 * * * *`。

## 學員簽到機制（Student Check-in）

學員在課程時間窗（`start_at − 30 分鐘` 至 `end_at`）內可自助簽到；簽到即視為完課。

### 資料模型

- `bookings.checked_in_at` (`timestamptz`) — 簽到時間；`null` = 未簽到。
- `bookings.checked_in_by` (`uuid → auth.users`) — 簽到者（通常 = 學員本人；保留代簽彈性）。
- 簽到後 `bookings.status` 轉為 `completed`。
- `tenants.checkin_reminder_minutes` (`int`, default 15, range 1–180, `null` = 停用) — 課前提醒提前量，Owner 可在 `/settings/profile` 調整。

### RPC

`checkin_booking(p_booking_id uuid)` — 學員自助簽到。`SECURITY DEFINER`，內部依序驗證：呼叫者擁有權、booking 為 `confirmed`、尚未簽到（冪等保護）、`now()` 在時間窗內。成功後觸發 `checkin_done` 推播給開課教練。

### 通知類型

| type | 觸發 | 對象 |
|------|------|------|
| `checkin_done` | 學員完成簽到（RPC 內） | 開課教練 |
| `checkin_reminder` | 課前 N 分（cron） | 學員 |
| `checkin_missing` | `start_at` 已過、仍未簽到（cron） | 學員 + 開課教練 + 租戶 owner；團班時給教練/owner 的提醒**每 slot 彙整一則**（related_id = slot_id） |

### 排程架構

`/api/cron/checkin-reminder` 由 **Supabase pg_cron**（`* * * * *`，每分鐘）透過 `pg_net.http_post` 呼叫，繞開 Vercel Hobby 的每日 cron 限制。Route 沿用既有 `CRON_SECRET` Bearer 驗證。

pg_cron 所需的 Vault secrets：`app_base_url`（應用 base URL）、`cron_secret`（與 `CRON_SECRET` env var 同值）。

> **Post-deploy 步驟（尚未完成）：** pg_cron 排程尚未設定。需在部署後執行專屬 migration（`supabase/migrations/20260614000000_schedule_checkin_cron.sql`），在 Vault 寫入兩個 secret 並建立 `cron.schedule`。Tasks 1–8 已實作；Task 9（pg_cron migration）待部署後設定。

---

## 個人帳號設定

所有登入者皆可自助修改個人資料，頁面渲染在各自的後台框架內（保留側欄／頂列），網址依角色：

| 角色 | 網址 |
|------|------|
| 教練 Owner / Staff | `/settings/account` |
| 平台管理員 | `/platform/account` |
| 學員 | `/account` |

各介面側欄／頂列的 `AccountChip` 會連到對應網址。可修改的欄位：

| 欄位 | 說明 |
|------|------|
| **姓名** | 顯示於各介面側欄／頂部（透過 `AccountChip`）。儲存至 Supabase Auth `user_metadata.full_name`；學員另同步 `customers.display_name`（教練端學員清單的顯示來源）。 |
| **密碼** | 變更前需先輸入目前密碼驗證身分。 |
| **Email**（登入帳號） | 變更前需驗證目前密碼；目前以 service-role 管理員 API 即時變更，不寄確認信。 |

> **待辦**：待 email 寄信管道上線後，email 變更改走標準確認信流程。

---

## 教練介紹頁（S5）

教練在 `/settings/profile` 可以維護：
- **Hero 大頭照**（`tenants.avatar_url`）— 公開頁 hero 顯示成圓形 inset
- **完整 Bio**：TipTap 編輯器（粗體 / 斜體 / 標題 / 清單 / 連結），儲存前 server-side 用 `sanitize-html` 過濾白名單以外的標籤
- **介紹影片**：貼 YouTube / Vimeo URL，公開頁以 iframe 嵌入；解析只接受 youtube.com、youtu.be、vimeo.com 三個 host
- **照片 gallery**：最多 10 張（JPEG/PNG/WebP，單檔 ≤ 5 MB），存 `coach-media` Storage bucket，公開頁 grid 呈現

公開頁 `/<slug>` 自動讀取以上欄位 + 公開 photos。資料表：`tenants.{avatar_url, bio_html, intro_video_url}` + 新表 `tenant_photos`。

## Storage bucket `coach-media`（S5）

由 migration `20260526100004_storage_coach_media_bucket.sql` 建立：
- `public: true`（公開讀取，URL 無需 auth token）
- File size limit: 5 MB
- 允許 MIME: `image/jpeg`, `image/png`, `image/webp`

Storage RLS（policies on `storage.objects`）：
- SELECT：任何人可讀 `coach-media` bucket（公開瀏覽）
- INSERT / UPDATE / DELETE：路徑第一段必須是 caller 所擁有的 tenant id（用 `current_user_owner_tenant_ids()` helper）
- UPDATE 同時有 USING 與 WITH CHECK，防止 owner 把路徑改成別人租戶

照片上傳路徑：`<tenant_id>/photo-<uuid>.<ext>`；avatar 路徑：`<tenant_id>/avatar.<ext>`（覆寫式，最多遺留 1 個 orphan 跨副檔名）。

## Auth flow — `?redirect=` 處理（S5）

- `/login` 與 `/signup` 都接受 `?redirect=<path>` 參數
- **open-redirect 防護**：兩個 server action 內各自有 `safePath()` helper，只放行：
  - 必須以 `/` 開頭
  - 不可以 `//` 開頭（protocol-relative bypass）
  - 不可以 `/\\` 開頭（WHATWG URL 反斜線 bypass —— 部分瀏覽器會把 `\` 正規化成 `/`，導致 `/\evil.com` 被解析為 `//evil.com`）
- 未通過 safePath 的值會被 fallback 到 `/`
- 學員未登入點 slot → /book/X 被 layout 擋下 → redirect 到 `/login?redirect=/book/X`
- /signup 註冊成功後：
  - 若 Supabase 專案未啟用 email 確認（auto-signin），直接 redirect 到 `safePath(redirectTo)` target
  - 若啟用 email 確認（`data.session` 為 null），redirect 到 `/login?signedup=1&redirect=<encoded target>`，使用者登入後自動到 target
- 公開頁 `/<slug>` 與 `/<slug>/packages` 未登入時顯示 `AuthCta`（黃色 banner + 登入/註冊按鈕），按鈕帶 `redirect=current_url`

---

## 主題與字型（S6）

- **設計方向：** Direction C · Bold Stripe — B&W + 鮮黃 accent，運動健身房氣質
- **字型：**
  - Display: Anton（uppercase, condensed bold）
  - Sans: Space Grotesk
  - CJK: Noto Sans TC（中文混排，font-cjk class）
  - Mono: Space Mono（kicker / 標籤）
  - 全部由 `next/font/google` 載入、subsetted、`display: swap`；CJK 用 `preload: false` 避免首屏重 bundle
- **Token：** OKLCH light + dark 兩套，全程保留 shadcn token 名（`--primary`, `--accent`, `--secondary`, `--muted`, `--card`, `--border`, `--sidebar-*`）；`--radius: 0.75rem`
- **顏色搭配：**
  - Light: 白底 + 接近黑 primary + 鮮黃 accent（`oklch(0.91 0.19 102)`）
  - Dark: 深黑底 + 鮮黃 primary（accent 同色）+ 灰階階層

## Dark mode（S6）

- 使用 `next-themes@0.4.6`，`<html class="dark">` 控制
- 切換 UI：`<ThemeToggle>` 三態（日 / 夜 / 系統），位於：
  - 後台 sidebar 底部
  - Auth 頁 header 右側
- `prefers-color-scheme` 由 `enableSystem` 支援
- root layout `suppressHydrationWarning` 防 SSR hydration mismatch

## Design language（S6）

新增可重用 primitive：

- `<SectionHead kicker title eng hint right>` — 雙語標題（mono kicker / 中文 / 英文 + accent 底線）；統一所有 section 開頭
- `<PrimaryCta>` 與 `<PrimaryCtaLink>` — 黑底 + 鮮黃箭頭圈 CTA（主要行動點）
- `<Badge variant>` — 5 variant（yellow / black / outline / mutedOutline / neutral）+ `<StatusBadge status>` 4 狀態（pending → yellow / confirmed → black / cancelled → outline / completed → mutedOutline）
- `<QRMark>` — 自訂 logo SVG（鮮黃扇形 + 白圈）
- `<ThemeToggle>` — 三態 pill toggle

字型 className（globals.css 定義）：
- `font-display` 大標 Anton + CJK fallback
- `font-cjk` 中文段落 Noto Sans TC + Sans fallback
- `font-mono` 標籤 Space Mono + monospace fallback

## Design language — claudeDesign UI Alignment Plan 1（2026-05-27）

對齊 `claudeDesign/` 17 頁 mockup 的 Phase 1 已完成基礎層（schema + primitives + seed）：

**新增 schema:**
- `tenants.years_exp / established_year / city` — 公開頁 hero meta
- `service_packages.is_popular` — 公開頁套裝 POPULAR 黃色 Pill
- `notification_preferences.channels` (jsonb event × `{web_push, in_app}` 矩陣) + `quiet_hours_start/end`。**Email 通道不做**（成本/流量考量,列 Phase 2 backlog）

**新增 primitives（11 個,含 Button 擴充）:**
- `<Button>` 擴 `fullWidth` + `withArrow="circle"|"inline"`
- `<Kicker>` — mono uppercase tracking-0.18em
- `<EmptyState>` — dashed border + icon + title + hint + cta
- `<KpiCard>` — label / value / unit / hint / icon / accent flag
- `<SubNav>` — settings 4 頁 segmented control
- `<AppShell>` — title / kicker / subnav / actions slot
- `<DateRibbon>` — 日期 chip row + slot count（公開頁/booking）
- `<TimeChip>` — 4 state（open / full / group / selected,含 N/M badge）
- `<RescheduleBanner>` — 改期模式黃 banner + 退出 link
- `<DateStrip>` — my-bookings 時間群組 header（today/thisWeek/later/past）
- `<NotificationMatrix>` — 事件 × {web_push, in_app} 矩陣
- `<QuietHoursInput>` — 勿擾時段 time range + 啟用 toggle

**Seed:** `supabase/seed.sql` 增加 demo tenant + services + packages（auth-dependent 部分由既有 `scripts/seed-test-data.mjs` 負責）。

**Plan 2 已完成（Student 6 頁,2026-05-27）:**
- `/<slug>` 公開頁:Hero EST/YRS/city meta + Reschedule banner + DateRibbon + TimeChip slot picker + 黑底 selected slot recap bar + QRMark footer
- `/<slug>/packages`:按服務分組 + POPULAR yellow Pill + in-card 申請表單 + 付款狀態 segmented (claimed_paid / awaiting_payment)
- `/book/<slotId>`:大 display time slot card + 套裝餘額 radio cards 含進度條 + EmptyState 無套裝 + 取消政策框
- `/login`、`/signup`:Kicker primitive + pill submit + signedup/invited banner
- `/my-bookings`:4 KpiCard 列(本週/待回覆/已完成/已取消) + DateStrip 群組 header + 改期 link

**Plan 3 已完成（Coach 後台 7 頁,2026-05-27）:**
- `/dashboard`:黑底 hero card + 右上半透明黃圓 + 4 KpiCard + Today timeline (NEXT UP 高亮) + Pending column + 條件式 Quick action card + Empty state preview
- `/calendar`:三視圖 tab (Week / List / Month) + 新 MonthView grid + Owner member filter chip(slot popover + conflict badge 既存,保留)
- `/services`:Tab 分類 (ALL / 1-ON-1 / GROUP) + ServiceCard 含 CAP/MIN/CXL 群班參數 + dashed 新增服務 placeholder
- `/customers`:GET 表單搜尋 + status 篩選 chips + Sheet drawer (booking 紀錄 + 套裝餘額進度條)
- `/packages`:Tab 含草稿 + 按服務分組 + PackageCard (POPULAR pill / 草稿 badge) + dashed placeholder per group
- `/packages/pending`:4 KpiCard 列(總待審/等待最久/本週新進/本月通過,column 名是 approval_status='pending_review') + 第一筆 accent ring 強調
- `/notifications`:重寫為 notification_log inbox (取代 preferences wrapper) + 4 tabs + 24h 內 cosmetic 黃色側條(不持久化)

**Plan 4 已完成（Settings 4 頁,2026-05-27）:**
- 4 頁共用 SubNav segmented (公開頁 / 通知 / 作息 / 重複)
- `/settings/profile`:6 numbered sections + 新 Hero meta inputs (years_exp/established_year/city) + sticky 底部儲存列含 dirty 狀態指示
- `/settings/notifications`:**新建租戶側** — Web Push 訂閱卡 + 已訂閱裝置列表 + 9 events × 2 channels NotificationMatrix + QuietHoursInput + 儲存 server action(僅 web_push / in_app,**無 email 通道**)
- `/calendar/availability`:SubNav + 3 個 SectionHead-包覆 sections(TEMPLATES / EVENTS / PREVIEW)+ Card token polish(移除 hardcoded emerald/blue/amber)
- `/calendar/rules`:SubNav + 4 種重複類型 segmented control + 動態參數區 + 結束條件 segmented + dialog 視覺對齊 token

**Phase 2 backlog 全部完成（2026-05-29 一日 sweep）:**

| 條目 | Commit | 摘要 |
|---|---|---|
| 互動式套裝選擇 on /book | A-1 | `book_with_purchase` 加 4th arg `p_purchase_id`,radio 變 interactive,新 error `PURCHASE_INVALID` |
| zxcvbn password strength on signup | `382791e` | mitigation for HIBP 鎖在 Supabase Pro Plan;score≥2 threshold |
| signup invite banner 顯示 tenant_name | `42ef8e5` | 新公開 endpoint `/api/invite/resolve`,debounced fetch |
| `/notifications` persistent read state | `922e281` | `notification_log.read_at` + RLS UPDATE policy + per-row click + bulk mark-read |
| `/<slug>/packages` 部份付 + receipt note | `b5349a4` | CHECK 加 `partial_paid`,新 `receipt_note text`,coach pending 顯示 RECEIPT block |
| group slot lifecycle 修正 + capacity counter | `03944b3` | `book/cancel/reschedule` 三 RPC 重寫狀態機:`booked` 只在滿了才標、cancel 重算 pending vs available、reschedule 接受 pending 目的地。`/api/public/slots` 加 `current_bookings`,TimeChip `state='group'` |
| recurring rule live conflict-detection preview | `b96d027` | 抽 `computeRulePreview` helper,加 `previewRecurringRuleAction`(無 DB writes),dialog 用 300ms debounce |
| services drag-reorder | `53d7bb2` | `services.display_order` + dnd-kit + `reorderServicesAction`,只在 ALL tab+owner 啟用 |
| S7 audit report + P0 fixes | 多 commit | SECURITY DEFINER caller-guard 9/9 OK、cross-customer attack 阻擋、RPC revoke、3 個 Playwright booking flow |

**Email 通知**:Owner 決定不做(成本/流量),memory `project_claudedesign_ui_alignment.md` 已標,不在 backlog。

**Web Push**:復查確認已完整 wired(`PushOptIn` 元件 + `/api/push/subscribe` POST+DELETE + `public/sw.js` push+click handler + `notify-booking` 7 處呼叫 + 3 cron route),只剩手動驗(真 browser 訂閱 + 觸發 booking event 看 toast)。

下一階段:無立即 backlog,進入 maintenance / 新需求 explore 階段。

## 部署

- **Production**：push 到 `master` → Vercel 自動部署到 production 域名
- **Preview**：push 到任何 feature branch → Vercel 建 preview deploy（每個 branch 有獨立 URL）
- **Vercel Pro 必須**：`pre-event-reminder` cron 為每分鐘頻率，需要 Pro 計畫。Hobby 計畫只支援每日 cron，請至少把這個 cron 暫時註解掉

---

## 平台管理員初始化

Plan 1 把第一位平台管理員設計成手動建立（intentional 安全邊界）：

```sql
-- 在 Supabase Dashboard → SQL Editor 跑
insert into public.platform_admins (user_id)
values ('YOUR-AUTH-USER-UUID')
on conflict (user_id) do nothing;
```

UUID 可以在 Supabase Dashboard → Authentication → Users 找到。

---

## 資料庫 Schema 概覽

13 個 migrations 建立的 11 個業務表：

```
身分群（5 表）
  tenants — 教練租戶
  tenant_members — Owner / Staff（多層 hierarchy 預留）
  platform_admins — 平台管理員
  customers — 學員 (1:1 auth.users)
  tenant_customers — 學員與租戶的橋接（資料隔離用）

服務 / 行事曆（3 表）
  services — 教練的服務項目
  recurring_rules — 重複規則設定
  availability_slots — 物化的時段（GIST EXCLUDE 防重疊）

預約（1 表）
  bookings — 預約紀錄（pending/confirmed/completed/cancelled）

通知（3 表）
  push_subscriptions — Web Push 訂閱
  notification_preferences — 使用者偏好
  notification_log — 去重 + 審計
```

關鍵 RPC 函式：
- `book_with_purchase(slot_id, customer_id, notes, purchase_id?)` — 原子性預約建立 + 消耗一堂套裝餘額。`purchase_id` 為 null 時 fallback 至 oldest-expiring;有值時驗證 ownership + service 一致 + 仍有效,失敗 raise `PURCHASE_INVALID`(P0001)。SECURITY DEFINER 內部第一道 guard 驗 `auth.uid() = customer_id`,擋 cross-customer 攻擊。
- `confirm_booking(booking_id)` — 教練確認
- `cancel_booking(booking_id)` — 客戶或教練取消;退費依取消期限決定（教練/管理者一律退、客戶僅在 `cancel_deadline_hours` 內退),**重算 slot.status**(尚有未取消 booking → `pending`, else → `available`);拒絕重複取消終結狀態(`cancelled`/`completed`/`no_show`)
- `reschedule_booking(old_booking_id, new_slot_id)` — 同一 tenant 內 atomically cancel old + create new;接受 `available` 或 `pending` 目的 slot(後者支援改期進團班),帶過原 purchase_id 不重複扣堂
- `auto_cancel_group_slot(slot_id)` — service_role only,團班 min_attendance 不足時 cron 用,refund 所有 bookings + 通知扇出
- `book_slot_atomic(slot_id, customer_id, notes)` — **legacy**,已從 `authenticated` revoke(`20260529100100`);data layer 受 `bookings.purchase_id NOT NULL` 卡死,實際 dead code,留定義但無 callers

---

## 除錯 Runbook — `error.digest` 怎麼查

Production 環境的 error boundary 為了不洩漏 stack trace 給使用者，只顯示一串雜湊碼（例如「錯誤代碼：2263577791」）。這串就是 Next.js 在 server 端記到 log 的 `error.digest`。

### 找對應 stack 的步驟

1. 在 Vercel Dashboard → 該專案 → Logs 篩選時間區間（出錯前後 5 分鐘）
2. 搜尋欄輸入 digest 串（去頭尾空白）
3. 第一筆命中的 log 會包含 stack trace、檔案路徑與行號
4. 若 production 找不到，切到 preview deployment 的 logs 也搜一遍

### 常見類型

| 症狀 | 通常 root cause |
|---|---|
| Server Component render 時失敗 | 在 RSC 裡寫了 `onChange` / `onClick` / 用 `window` 等 client-only API |
| Build 後第一次造訪某動態路由 | 資料庫 RLS 或 PostgREST relationship 配置變動 |
| 偶發性 | 第三方 API 超時 / Supabase 連線拋例外 |

開發中 `process.env.NODE_ENV !== 'production'` 時，error boundary 會直接顯示 stack（見 `src/app/error.tsx`），免去查 digest。

---

## 測試覆蓋

| 種類 | 數量 | 範圍 |
|------|------|------|
| Unit | 20 | errors, safe-action, recurrence, conflicts |
| Integration（live Supabase） | 13 | RLS 隔離、EXCLUDE 約束、recurring rules、atomic booking、staff isolation |

---

## 規格與計畫

- 規格：[`docs/superpowers/specs/2026-05-21-quickreserve-redesign-design.md`](docs/superpowers/specs/2026-05-21-quickreserve-redesign-design.md)
- 計畫：[`docs/superpowers/plans/`](docs/superpowers/plans/) — Plan 1 完整 task 分解；Plan 2-7 為小型 spec

完成的 7 個 git tags：
- `plan-1-foundation`
- `plan-2-services-and-calendar`
- `plan-3-recurring-and-bulk`
- `plan-4-booking-flow`
- `plan-5-staff-management`
- `plan-6-notifications`
- `plan-7-platform-and-polish`（最終）

---

## 已知限制 / 後續可做

- **金流**：尚未整合（Stripe / ECPay / LINE Pay）
- **多時區**：MVP 只支援 Asia/Taipei
- **多層助教**：DB schema 已預留 `parent_member_id`，UI 只支援一層
- **檔案匯入**：CSV / iCal / Google Calendar 同步未做
- **LINE 通知**：規格保留，目前只有 Web Push
- **Rate limit**：尚未串 Upstash，但 spec 已設計（L1 防護）
- **Sentry**：尚未串接，目前僅 `console.error`

---

## 授權 / 維護

Personal project, all rights reserved. terry@webplus.com.tw
