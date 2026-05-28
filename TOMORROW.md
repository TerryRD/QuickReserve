# 明天開機要做的事

## TL;DR — 給 Claude 看的一行

> claudeDesign UI Alignment Phase 1 已完成並上 production(2026-05-28,latest commit `52b6467`)。下一步看你想做哪個方向: Phase 2 backlog(下表)、原本排定的 **S7 架構/資安 audit**、或一些手動驗收。

## 起手式

```text
打開 Claude Code,第一句說:
「看 TOMORROW.md 接著做」
然後挑下面其中一條方向。
```

## 目前狀態(2026-05-28 收工時)

### ✅ 已完成

- **claudeDesign UI Alignment Phase 1**:54 commits since `dfb6863`,涵蓋:
  - **P1 Foundation** — 3 schema migrations + 11 primitives + dev seed + vitest TSX setup
  - **P2 Student 6 頁** — `/<slug>` + reschedule + DateRibbon/TimeChip · `/<slug>/packages` POPULAR · `/book` empty state · `/login` `/signup` Kicker · `/my-bookings` KPI + DateStrip
  - **P3 Coach 7 頁** — `/dashboard` 黑底 hero · `/calendar` 三視圖 · `/services` `/customers` `/packages` `/packages/pending` `/notifications` 全部
  - **P4 Settings 4 頁** — `/settings/profile` 6 sections + sticky save · `/settings/notifications`(新建) · `/calendar/availability` `/calendar/rules` polish
  - **Post-deploy fixes** — middleware 補 `/account` `/packages` 保護 · `/platform/*` 3 頁也對齊 Direction C(原 spec 漏列)
- 所有 quality gates 過(`lint` / `typecheck` / `test 105/105` / `build` 33 routes)
- Production 部署完成(`https://quick-reserve-mu.vercel.app/`)
- Docs 同步:`README.md` `docs/ux-audit.md` 4 個 user-guides 都更新

### 🧪 手動驗收(你有空時跑)

打開 https://quick-reserve-mu.vercel.app/ 登入後巡:
- `/dashboard` — 黑底 hero card + 4 KpiCard + Today timeline + Pending column
- `/calendar?view=week|list|month` — 三個 view 都會走 + slot popover 還能用
- `/customers` — 搜尋 + filter chips + 點 row 開右側 drawer 看 bookings + 套裝餘額進度條
- `/settings/profile` — 6 numbered sections + sticky 底部儲存列;Section 02 填 `執業年資 / 創立年份 / 城市` 三欄
- `/settings/notifications` — 9 events × 2 channels(web push / in-app)矩陣 + 勿擾時段
- `/<你的 slug>` — Hero meta line(填完 Section 02 才會顯示)+ 新 SlotPicker + 黑底 selected recap bar
- `/my-bookings` — 4 KpiCard + DateStrip 群組 + 改期 link
- `/platform/dashboard` `/platform/tenants` `/platform/bookings` — 全平台後台也對齊了

### 📋 後續可選方向

#### 方向 A:Phase 2 backlog(挑幾項補)

依優先建議:
1. **互動式套裝選擇 on `/book`** — 現在 RPC 強制選最近到期的;改成 user 可選需要 `book_with_purchase` RPC 加 `p_purchase_id` 參數 + 修改 booking action
2. **Web Push 真實訂閱完整流程** — service worker 註冊 + Notification permission flow + 後端 push API hook(VAPID keys 應該已經有)
3. **slot popover live conflict-detection inline** — 建 recurring rule 時即時顯示「會跟 N 個現有時段重疊」
4. **`/<slug>/packages` 第 3 種付款狀態 `部份付` + receipt note** — 需要 alter `customer_purchases.payment_self_reported` CHECK + 加 `receipt_note` column
5. **`/notifications` persistent read state** — 加 `notification_log.read_at` column + mark-read action
6. **public page slot picker group capacity** — `/api/public/slots` 補 group_filled / group_capacity 欄位讓 TimeChip 顯示真實 N/M
7. **`/signup` invite mode banner 顯示 tenant_name** — 新建 `/api/invite/resolve?token=` public endpoint
8. **Email 通知**(等成本/流量決策)
9. **`/settings/profile` services 拖曳排序** — 加 `display_order` column + DnD library + reorder server action

#### 方向 B:S7 架構/資安 audit(memory `project_s7_next.md` 排定的工作)

範圍(read-only review,產 audit report):
- 耦合度檢查
- 檔案大小分布
- Test coverage gaps
- RLS audit(每張表 + 每條 policy 驗證)
- Open-redirect 殘留掃描(S5 加的 `safePath` 是 baseline)
- 權限矩陣交叉檢查(platform / tenant_owner / tenant_staff / customer × 各路由)
- Storage 規則交叉檢查
- Hard-coded secrets / API keys 掃描

產出主要為**audit report**(在 `docs/superpowers/specs/`)+ 高優先 fix。

#### 方向 C:小清理

- **supabase types regen**:跑 `supabase gen types`(需要 `SUPABASE_ACCESS_TOKEN`),移除 P1+P4 手動補進 `src/lib/supabase/types.ts` 的欄位
- **`claudeDesign/`** 還是 untracked。決定要 commit 或加到 `.gitignore`
- 既有 lint warnings(`<img>` vs `<Image>` 在幾個地方、unused vars 在 `calendar/rules/actions.ts` 等)集中清掉

## 重要原則(給 Claude 看的)

- 直接在 `master` 上工作(專案慣例)
- HEREDOC commit message + `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`
- Subagent-Driven flow:implementer (sonnet) → spec reviewer (sonnet) → code quality reviewer (sonnet),小任務可 inline 直接做
- 完成後 push origin master 並等 Vercel READY 才算結束
- 文件更新 follow `memory/feedback_docs_after_impl.md`(完成 batch 後主動更新 README/ux-audit/spec)
- 不要 batch by batch 驗,整批做完才一次驗(memory `project_claudedesign_ui_alignment.md` 已標)
