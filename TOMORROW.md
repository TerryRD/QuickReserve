# 明天開機要做的事

## TL;DR — 給 Claude 看的一行

> claudeDesign UI Alignment Phase 1 + S7 audit + 高優 P0 fix 全上 production(latest commit `1811011`)。docs / advisor fixes / Playwright E2E + GitHub Actions / S7 audit report 都到位。剩下大頭是 **S7 RLS rewrite**(120 lints,該走 brainstorm→spec→plan)+ 中工程 backlog 項目。

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
- 所有 quality gates 過(`lint 0` / `typecheck 0` / `test 105/105` / `build` 33 routes)
- Production 部署完成(`https://quick-reserve-mu.vercel.app/`)
- Docs 同步:`README.md` `docs/ux-audit.md` 4 個 user-guides 都更新

**後續 polish(2026-05-28):**
- Lint pre-existing warnings 全清(8 個 → 0)— next/image + remotePatterns + eslint `^_` ignore + drop unused vars
- Supabase advisor 跑過: 17 sec WARN + 145 perf WARN,報告在 `docs/superpowers/specs/2026-05-28-supabase-advisors-snapshot.md`
- Advisor low-risk fixes 套用: 5 個缺的 FK indexes + 收緊 `coach-media` bucket listing(security 17→16)
- 真實 bug found by E2E: customer hit `/dashboard` 會 500(無 tenant membership 但 middleware 不知道)— 加 role-based redirect 在 tenant/platform layout 修掉
- `docs/e2e-manual-checklist.md`: 4 角色 × 17 頁手動 walkthrough checklist(含已知 deferred 提示,不會 false-positive)
- **Playwright E2E suite 設好**: 31 tests(28 active + 3 skipped platform),covers public + coach + customer + flows against production
- **GitHub Actions e2e workflow**: push to master → 90s 等 Vercel deploy → 跑全 suite + 失敗時 upload artifacts
- `claudeDesign/` 推上 GitHub(含 README + 對照表),`uploads/` 守 .gitignore(真實行事曆 PNG 不上)
- Supabase types regen(`npm run db:types`)— manual patches 已乾淨,只多 `service_packages.is_popular`
- **S7 audit report 寫好**:`docs/superpowers/specs/2026-05-28-s7-audit-report.md` — 補完 advisor 沒覆蓋的部分(open-redirect / 權限矩陣 / 檔案大小 / 機密 / test coverage)
- **🔴 P0 fix shipped**: OAuth callback 的 open-redirect 修了(commit `1811011`)— `safePath` 抽到 `src/lib/`,3 處 import 共用,加 6 case unit test

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

**已 pre-scanned 過**:`docs/superpowers/specs/2026-05-28-supabase-advisors-snapshot.md` 已抓到 ~80% 的 RLS / perf 問題,S7 spec 可以從這延伸:

剩下要做的 audit(advisor 沒覆蓋的):
- 耦合度檢查
- 檔案大小分布
- Test coverage gaps
- Open-redirect 殘留掃描(S5 加的 `safePath` 是 baseline)
- 權限矩陣交叉檢查(platform / tenant_owner / tenant_staff / customer × 各路由)
- Storage 規則交叉檢查
- Hard-coded secrets / API keys 掃描

高優先 fix(從 advisor 來):
- ✅ 120 `multiple_permissive_policies` 重寫(commit `64bd953`,2026-05-28)
- ✅ 10 `auth_rls_initplan` wrap auth.uid()(同 commit)
- ✅ SECURITY DEFINER RPC caller-guard 9/9 OK(2026-05-29):audit 報告 `docs/superpowers/specs/2026-05-29-security-definer-rpc-audit.md`;**P0 fix shipped** — `book_slot_atomic` + `book_with_purchase` 加 `auth.uid()` guard 阻擋 cross-customer 攻擊;3/3 integration test green
- 🔴 **WAITING ON YOU** — 1-click in Dashboard: 開「Prevent sign up with leaked passwords」(Supabase Dashboard → Authentication → Policies → Password Settings)

產出主要為 **S7 audit report**(在 `docs/superpowers/specs/`)+ 高優先 fix。

#### 方向 C:小清理 / 延伸

- **supabase types regen**:跑 `npm run db:types`(需要 `SUPABASE_ACCESS_TOKEN`),移除 P1+P4 手動補進 `src/lib/supabase/types.ts` 的欄位
- **更多 Playwright tests**:
  - 真實 booking flow(學員選時段 → 進 /book → 確認 → 看 /my-bookings)
  - 改期 flow(my-bookings 點改期 → 公開頁 reschedule mode → 選新時段)
  - Coach create booking from calendar(slot popover → 確認預約)
  - GitHub Actions workflow 跑 e2e on PR
- **`/notifications` persistent read state**:加 `notification_log.read_at` column + mark-read action(取代現在 24h cosmetic)
- **`coach-media` bucket** 進一步收緊 — 看 advisor 是否還能挑 owner-only path-scoped SELECT(目前是純 public,沒 SELECT policy)
- ~~**修 `atomic-booking.test.ts`**~~ — ✅ 2026-05-29 rewrite,改測 `book_with_purchase + cancel_booking` lifecycle (4/4 green)
- ~~**revoke `book_slot_atomic` from `authenticated`**~~ — ✅ migration `20260529100100_revoke_book_slot_atomic.sql`
- ~~**supabase types regen**~~ — ✅ no-op (yesterday `9361940` 已 sync)
- **更多 Playwright booking flow tests**(下次開新 batch 寫;需設計 drift-safe + no-submit 慣例,因為這些都是 mutate prod):
  - 學員選時段 → `/book/<slotId>` chrome 渲染 + 確認 button enable(no-submit)
  - reschedule mode 公開頁的 new-slot picker 渲染(no-submit)
  - Coach `/calendar?view=week` slot popover 彈出 + "add booking" action 可見(no-submit)

## 重要原則(給 Claude 看的)

- 直接在 `master` 上工作(專案慣例)
- HEREDOC commit message + `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`
- Subagent-Driven flow:implementer (sonnet) → spec reviewer (sonnet) → code quality reviewer (sonnet),小任務可 inline 直接做
- 完成後 push origin master 並等 Vercel READY 才算結束
- 文件更新 follow `memory/feedback_docs_after_impl.md`(完成 batch 後主動更新 README/ux-audit/spec)
- 不要 batch by batch 驗,整批做完才一次驗(memory `project_claudedesign_ui_alignment.md` 已標)
