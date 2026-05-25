# QuickReserve — B2B2C 預約系統 SaaS

一個多租戶預約 SaaS 平台，給服務提供者（教練、顧問等）管理可預約時段、開放給自己的客戶預約。

> 舊版的 ASP.NET Core + Vue 程式碼已封存於 `legacy/`，僅保留作參考。

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
  /platform/dashboard          統計儀表板
  /platform/tenants            租戶管理（邀請 / 暫停 / 啟用）

(tenant) — 教練後台
  /dashboard                   儀表板
  /calendar                    行事曆週檢視
  /calendar?member=<id>        Owner 檢視他人行事曆
  /services                    服務項目管理
  /bookings                    預約管理（確認 / 取消）
  /staff                       助教管理（Owner 限定）
  /notifications               通知偏好（教練 / 助教，留在 tenant 後台 chrome）
  /settings/profile            租戶資料（Owner 限定）

(customer) — 學員後台
  /my-bookings                 我的預約

[tenantSlug] — 公開預約頁
  /[slug]                      教練介紹 + 服務列表 + 日期/時間挑選
  /book/[slotId]               預約確認頁

API
  /api/cron/materialize-recurring    每日 00:30 UTC+8（90 天滑動視窗）
  /api/cron/weekly-summary           每週日 20:00 UTC+8
  /api/cron/daily-reminder           每小時 06-12 UTC+8（hourly cron）
  /api/cron/pre-event-reminder       每分鐘（需 Vercel Pro）
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
npm run db:types         # 從 cloud schema 重新產生 src/lib/supabase/types.ts
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
- `book_slot_atomic(slot_id, customer_id, notes)` — 原子性預約建立（SELECT FOR UPDATE）
- `confirm_booking(booking_id)` — 教練確認
- `cancel_booking(booking_id)` — 客戶或教練取消

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
