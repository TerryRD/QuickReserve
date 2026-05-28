---
title: claudeDesign UI Alignment — Design
date: 2026-05-27
status: phase-1-complete (2026-05-28 shipped to production)
approach: C · 漸進式（本 spec = Phase 1，含後端必要擴充）
parent: docs/superpowers/briefs/s6/{00-anchor,01-student-experience,02-coach-app,03-coach-settings}.md
implementation_plans:
  - docs/superpowers/plans/2026-05-27-claudedesign-p1-foundation.md
  - docs/superpowers/plans/2026-05-27-claudedesign-p2-student-pages.md
  - docs/superpowers/plans/2026-05-27-claudedesign-p3-coach-pages.md
  - docs/superpowers/plans/2026-05-27-claudedesign-p4-settings-pages.md
phase_1_extras_beyond_original_spec:
  - /platform/* aligned to Direction C(原 spec 漏列;2026-05-28 補做,commit `52b6467`)
  - middleware protect /packages + /account(unauth route gap fix,commits `04758de`、`52b6467`)
---

# claudeDesign UI Alignment

## Context

`claudeDesign/` 內含完整 mockup：1 個 anchor 探索頁（A/B/C 三方向）+ Coach 後台 7 頁 + Settings 4 頁 + Student 6 頁，已選定 **Direction C · Bold Stripe** — 黑/白/黃 + 透明度灰、Anton + Space Grotesk + Noto Sans TC + Space Mono、圓角（card 18px / button 999px pill）、自家 QR mark、卡片陰影 `0 8px 24px -18px rgba(0,0,0,.18)`。

S6 已完成 tokens + 字型 + 部分 primitives（`SectionHead`、`PrimaryCta`、`Badge`、`StatusBadge`、`QRMark`、`ThemeToggle`、tenant sidebar）+ Auth split layout + my-bookings date-strip 卡片。本 spec 把剩餘 17 頁拉齊 mockup，並補上 mockup 顯示但現況沒對應的後端。

## Goals

1. 17 頁 UI 對齊 `claudeDesign` mockup（layout / token / 字型 / 圓角 / 陰影 / hero hierarchy）
2. 補上 mockup 顯示但現況沒對應的功能（server query / server action / 必要時 schema migration）
3. 在 dev 環境塞完整 seed，UI 一啟動就看得到內容
4. 沿用既有 chrome（tenant sidebar、auth split layout、my-bookings date-strip）

## Non-goals

- Web Push 真實訂閱流程（service worker + push API），只做 UI 殼
- **Email 通知整個移除** — 收費或免費有流量限制，本期不做。`/settings/notifications` 矩陣只保留 Web Push + In-app 兩通道
- Mockup 假名字 / 假數字逐字搬到 seed（合理測試資料即可）
- Mockup 文案的藝術性句子逐字對齊（語意對齊即可）

## Approach

**C · 漸進式**：本 spec 為 Phase 1（17 頁完整視覺對齊 + 必要後端擴充）。「真正算不出來」或「需要新整套 feature 才補得起來」的部分（例：Web Push 訂閱流程）擺 Phase 2 後續 spec。

**處理 mockup 上「沒對應資料」的策略：**
- 缺欄位 → 補欄位（supabase migration）
- 缺 query → 寫新 server query / action
- 缺資料 → 塞 dev seed
- 缺整套 feature（如 Web Push push API）→ 只做 UI 殼，標 TODO

## Batches & Order

| Batch | 內容 |
|---|---|
| 0 | Primitives & Shell — `AppShell`、`Card`、`Btn` variants、`KpiCard`、`SubNav`、`DateRibbon`、`TimeChip`、`RescheduleBanner`、`EmptyState`、`DateStrip`、`NotificationMatrix`、`QuietHoursInput`、`Kicker` |
| 1 | Schema migration & dev seed |
| 2 | Student 6 頁 |
| 3 | Coach Backoffice 7 頁 |
| 4 | Coach Settings 4 頁 |
| 5 | Final QA — 17 頁 × 4 breakpoints 巡一輪 + lint/typecheck/test/build |

## Primitives (Batch 0)

| 元件 | 路徑 | 主要 props |
|---|---|---|
| `AppShell` | `src/components/shell/app-shell.tsx` | `title`、`subnav?`、`actions?` |
| `Card` (擴) | `src/components/ui/card.tsx` | `padded?`、`muted?`、`elevated?` |
| `Btn` (擴 shadcn Button) | `src/components/ui/button.tsx` | `variant: primary/secondary/ghost/accent`、`size: sm/md/lg`、`withArrow?: 'circle' \| 'inline'`、`fullWidth?` |
| `KpiCard` | `src/components/ui/kpi-card.tsx` | `label`、`value`、`unit?`、`hint?`、`icon?`、`accent?` |
| `SubNav` | `src/components/shell/sub-nav.tsx` | `items`、`active` |
| `DateRibbon` | `src/components/booking/date-ribbon.tsx` | `dates`、`selected`、`onSelect`、`hasSlotsByDate` |
| `TimeChip` | `src/components/booking/time-chip.tsx` | `time`、`state: open/full/group/selected`、`group?: {filled, capacity}` |
| `RescheduleBanner` | `src/components/booking/reschedule-banner.tsx` | `originalBooking`、`onExit` |
| `EmptyState` | `src/components/ui/empty-state.tsx` | `icon`、`title`、`hint?`、`cta?` |
| `DateStrip`（確認既有） | `src/components/bookings/date-strip.tsx` | `groupKey`、`count` |
| `NotificationMatrix` | `src/components/settings/notification-matrix.tsx` | `events`、`channels`、`prefs` |
| `QuietHoursInput` | `src/components/settings/quiet-hours-input.tsx` | `start`、`end`、`onChange` |
| `Kicker` | `src/components/ui/kicker.tsx` | `children` |

**沿用：** `SectionHead`、`PrimaryCta`、`StatusBadge`、`QRMark`、`ThemeToggle`、tenant sidebar、auth split layout

**Token-level 規則（不另設 component）：**
- 卡片標題：`font-display font-black text-xl ~ 2xl uppercase`
- Kicker：`font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground`
- Hero 黑底卡片（dashboard）：`bg-primary text-primary-foreground rounded-2xl p-9` + 右上 黃色半透明大圓裝飾
- Accent 黃用法：**punctuation only** — badge / 標題下底線 / CTA 內圓點 / QR mark wedge / 服務卡右上圈
- Empty state dashed：`border-[1.5px] border-dashed border-border`
- Mobile drawer overlay：`bg-black/45 backdrop-blur-sm`

## Schema migration (Batch 1)

開工前先 `list_tables` / `list_migrations` 對齊現況，下列為**預期**範圍，實際可能有些已有：

| 欄位 / 表 | 用途 | 備註 |
|---|---|---|
| `tenants.years_exp` int | Hero meta line | 公開頁顯示 |
| `tenants.established_year` int | Hero meta line | 公開頁顯示 |
| `tenants.city` text | Hero meta line | 公開頁顯示 |
| `tenants.contact_email` text | Contact pills | 與 owner auth email 分開 |
| `tenants.contact_phone` text | Contact pills | — |
| `tenants.contact_line` text | Contact pills | — |
| `tenants.bio_long` text | About section 長文 | markdown，settings 編輯 |
| `tenants.intro_video_url` text | YouTube / Vimeo URL | settings 編輯 |
| `services.min_attend` int | 群班 minAttend 參數 | 確認 S5 是否已補 |
| `services.cancel_hrs` int | 群班 cancelHrs 參數 | 確認 S5 是否已補 |
| `service_packages.is_popular` bool | 公開頁 popular 標記 | default false |
| `notification_preferences` 通道矩陣 | jsonb `channels: {web_push: bool, in_app: bool} × event_type` | **不含 email**；先看現況再決定 jsonb or 多欄 |
| `notification_preferences.quiet_hours_start` time | 勿擾起 | — |
| `notification_preferences.quiet_hours_end` time | 勿擾止 | — |

**Migration 規範（memory: Dev conventions）：**
- 走 `supabase/migrations/YYYYMMDDHHMMSS_<name>.sql`，不用手寫 SQL 透過 Dashboard
- 每筆新欄位 / 新表都要 RLS policy（memory: Security baseline）
- 不破壞既有 RLS：tenant scope、owner scope、staff scope 都過

## Dev seed (Batch 1)

新增 `supabase/seed-dev.sql`（或同等 mechanism），`supabase db reset` 後 UI 一啟動可看到完整內容：

- 1 demo tenant (`coach-poyu`) + 1 owner + 2 staff
- 8 ~ 10 customers + tenant_customers 連結
- 3 ~ 4 services（含 1on1 + 群班，含 capacity / minAttend / cancelHrs）
- Recurring rules + availability slots（跨 ±30 天）
- Bookings 4 狀態（pending / confirmed / completed / cancelled），含 today 多筆 + 群班 N/M
- service_packages 含 is_popular，tenant_customer_packages 各狀態餘額（active / pending / approved / rejected）
- notification_log / notifications 各事件
- push_subscriptions 假裝置（only 顯示用，不 send push）
- Tenant 完整 hero / bio / gallery 內容（covers Profile 6 sections）

## Page Alignment

### Student 6 頁

**01 `/<slug>` 公開頁** — Hero meta line、contact pills、AuthCta 雙按鈕、**改期 banner**（`?reschedule=<bookingId>`）、BIO grid、VIDEO 16:9 卡片含黃圓 Play、GALLERY 3 欄 + 編號 caption、SERVICES muted 背景 + index、SLOT PICKER 黑底 selected recap bar、Footer QRMark + mono 文字

**02 `/<slug>/packages`** — 按服務分組、popular Pill yellow、in-card 申請表單展開、付款狀態 segmented control

**03 `/book/<slotId>`** — 時段詳情卡 + 套裝餘額 radio cards + 取消政策框 + 沒套裝時 dashed empty state

**04 `/login`** — 沿用 S6 split layout，補 `?signedup=1` banner

**05 `/signup`** — 同 login，補 `?invite=<token>` 邀請模式 banner

**06 `/my-bookings`** — 沿用 S6 date-strip + 補 KPI 列（本週 / 待回覆 / 已完成 / 已取消，server query GROUP BY status）+ 改期按鈕跳 `?reschedule=`

### Coach Backoffice 7 頁

**01 `/dashboard`** — 黑底 hero card + 右上黃半透明圓 + 大 display + 黃圓點 + Hero CTA (黃 pill + 兩個次要)、4 KpiCard grid、Today timeline（含 NEXT UP 高亮 + 群班 N/M）+ Pending column（內聯確認/拒絕）+ Quick action card + Empty state

**02 `/calendar`** — Tabs (Week / List / Month)、Week 7 欄 grid + 衝突 badge + 群班 N/M、Slot popover、List by date 分組、Month grid + 每日小點、Owner filter chip

**03 `/services`** — Tab (1on1 / Group / All)、卡片列表 + in-place 編輯展開、群班參數欄、新增 placeholder dashed card

**04 `/customers`** — 搜尋 + 篩選 chips、列表 + 右側詳情 drawer（avatar / 聯絡 / 預約紀錄 / 套裝餘額進度條）

**05 `/packages`** — 按服務分組（kicker = 服務名 + N items）、新增 placeholder dashed card、Tab 切換

**06 `/packages/pending`** — KPI 列、第一筆 yellow 邊框強調、同意/拒絕內聯

**07 `/notifications`** — 列表 + Tab、未讀左側黃色色條 + 字重粗、頂端 Web Push 偏好按鈕

### Coach Settings 4 頁

**01 `/settings/profile`** — SubNav 切換、6 sections + 編號 badge、Sticky 底部儲存列

**02 `/settings/notifications`** — Web Push 訂閱卡 + 裝置列表 + **事件 × 2 通道矩陣（Web Push / In-app，不含 Email）** + QuietHoursInput

**03 `/calendar/availability`** — 模板列表 + 編輯展開（週幾 chip + 時段範圍）+ 不可用事件列表 + Materialize 預覽展開區

**04 `/calendar/rules`** — Segmented 4 種類型、動態參數區、結束條件、衝突偵測 inline

## Done Criteria

**Batch 0：** 13 個新元件 + 既有元件全部存在、smoke test 過、`npm run lint` / `npm run typecheck` 過

**Batch 1：** Migration 走 `supabase db push` 不出錯、新欄位有 RLS、`supabase db reset` 後 seed 可見、UI 一啟動有完整 demo 資料

**Batch 2-4（每頁）：**
- Desktop / tablet / mobile 三斷點不破版
- Light + Dark 都 ok
- Layout 對齊 mockup（結構 / 版型 / token 用法同；字距 / 行高 / padding 容忍 ±10%）
- 鍵盤可達、focus ring 顯眼
- 沒 console error / hydration warning
- Server query / action 有 error handling（throw AppError，memory: Error handling）
- 既有功能不退化（預約 RPC、auth、cron 等）

**Final QA：**
- 17 頁 × 4 breakpoints 親手過一輪
- `npm run lint` + `npm run typecheck` + `npm run test` + `npm run build` 全綠
- `docs/ux-audit.md` 更新對齊結果與 Phase 2 backlog
- `README.md` Design language section 提及 17 頁完成
- master 直推（memory: Dev conventions），commit 群組化

**Performance gate（memory: Performance baseline）：**
- 公開頁 warm hit ≤500ms 不退化
- Skeleton / Suspense 保留
- 沒新引入 N+1

**Security gate（memory: Security baseline）：**
- 新欄位 RLS 補齊
- Profile server action 走 next-safe-action + zod
- Notification preferences 寫入時驗 user_id own
- Public page 不暴露 internal field

## Phase 1 完成記錄(2026-05-28)

| Plan | 範圍 | Status | Commits |
|---|---|---|---|
| P1 Foundation | 3 migrations + 11 primitives + seed | ✅ | `ae1e757`…`70098d4` |
| P2 Student 6 頁 | /<slug> · /<slug>/packages · /book · /login · /signup · /my-bookings | ✅ | `4886601`…`1753764` |
| P3 Coach 7 頁 | /dashboard · /calendar(3 views) · /services · /customers · /packages · /packages/pending · /notifications | ✅ | `0ffbc36`…`37c2b46` |
| P4 Settings 4 頁 | /settings/profile · /settings/notifications(新建) · /calendar/availability · /calendar/rules | ✅ | `960d7a8`…`e7a8e4e` |
| Post-deploy fixes | middleware `/account`+`/packages` 保護 · /platform/* 對齊 Direction C(原本漏列) | ✅ | `04758de` · `52b6467` |

**Production deploy:** 2026-05-28 via `git push origin master`(latest commit `52b6467`)。Schema migrations B1/B2/B3 已套用於 linked Supabase。Dev seed (`supabase/seed.sql`) **未對 production DB 套用**(故意,demo 用)。

**Quality gate at completion:** `npm run lint` ✓ · `typecheck` ✓ · `test`(105/105) ✓ · `build`(33 routes) ✓

## Out of scope (Phase 2 backlog)

- Web Push 真實訂閱流程（service worker + push API）
- Email 通知（pending 付費 / 流量限制決策）
- Dashboard 進階分析（比上週 / 比上月圖表）
- 互動式套裝選擇 on /book(`book_with_purchase` RPC 加 `p_purchase_id` 參數)
- /<slug>/packages 第 3 種付款狀態 `部份付` + receipt note
- /signup invite mode banner 顯示 tenant_name(需新公開 API endpoint)
- /notifications persistent read state(需新 `read_at` column)
- /calendar slot popover live conflict-detection inline
- /settings/profile services 拖曳排序
- Public page slot picker group capacity / full state(`/api/public/slots` 補返回 group_filled / group_capacity)
- supabase types regen(`supabase gen types`,目前 P1 + P4 部分欄位手動補進 types.ts)
- Audit report（原 S7 排程：耦合度、檔案大小、test coverage、RLS audit 等）

## References

- `claudeDesign/QuickReserve {Anchor,Coach,Settings,Student}.html` — mockup
- `claudeDesign/styles/tokens.css` — direction A/B/C tokens
- `claudeDesign/coach/*.jsx` + `claudeDesign/student/*.jsx` — page mocks
- `docs/superpowers/briefs/s6/{00-anchor,01-student-experience,02-coach-app,03-coach-settings}.md`
- `docs/superpowers/specs/2026-05-26-s6-design-refresh-design.md`
- `src/app/globals.css` — Direction C tokens（已就緒）
- `src/components/ui/{section-head,primary-cta,badge}.tsx` — 既有 primitives
