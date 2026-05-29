# UX Audit — 各角色實際走過後的問題清單

> 從 4 個角色實際登入跑完整流程後整理。
> 標 ⭐ = 本次優先修；標 🟡 = 中期改善；標 ⚪ = 未來再說
>
> **狀態：✅ 所有項目於 2026-05-22 全部完成。** 對應 FR 與 commit 見 `docs/superpowers/specs/2026-05-21-quickreserve-redesign-design.md` 附錄 C。

## 🛠️ Platform Admin（你）

| # | 問題 | 嚴重度 | 狀態 |
|---|------|--------|------|
| P1 | 沒辦法快速進到某個教練的資料看（只能用 SQL 或公開頁） | ⭐ | ✅ `/platform/tenants/[id]` drill-in |
| P2 | 邀請過期了沒辦法重新邀請 / 看邀請紀錄 | 🟡 | ✅ `reinviteOwnerAction` |
| P3 | 沒搜尋 / 排序 / 篩選租戶 | 🟡 | ✅ TenantsTable client-side search + status filter |
| P4 | 想看「全平台所有預約 / 所有使用者」沒入口 | 🟡 | ✅ `/platform/bookings` |
| P5 | 無法幫某個教練重設密碼（只能去 Supabase Dashboard） | ⚪ | ✅ `resetCoachPasswordAction`（產生 recovery link） |

## 🏓 教練 Owner

| # | 問題 | 嚴重度 | 狀態 |
|---|------|--------|------|
| O1 | **行事曆只能看一個成員** — Owner 想同時看全部助教 + 自己 | ⭐ | ✅ MemberFilter 多選 |
| O2 | **重複規則建完就消失** — 無法看 / 編輯 / 刪除既有規則 | ⭐ | ✅ `/calendar/rules` 管理頁 |
| O3 | **行事曆上的時段點不開** — 看不到誰預約了、沒辦法刪除單一 slot | ⭐ | ✅ slot popover + 刪除 |
| O4 | 沒「我的學員」清單 | ⭐ | ✅ `/customers` |
| O5 | 沒辦法 reschedule | 🟡 | ✅ 改期 RPC + 公開頁 reschedule 模式 |
| O6 | Service 啟用 / 停用 toggle | 🟡 | ✅ |
| O7 | 行事曆沒「日視圖」 | ⚪ | ✅ `?view=day` |
| O8 | 沒法 ban / block 麻煩客戶 | ⚪ | ✅ 學員封鎖 + RPC 防呆 |

## 👨‍🏫 Staff（助教）

| # | 問題 | 嚴重度 | 狀態 |
|---|------|--------|------|
| S1 | Services 頁沒明示是唯讀 | 🟡 | ✅ 唯讀 banner |
| S2 | Sidebar 跟 Owner 看起來一樣，無「我是 staff」明顯標示 | ⚪ | ✅ Sidebar 顯示 Owner / Staff badge |

## 👤 Customer 學員

| # | 問題 | 嚴重度 | 狀態 |
|---|------|--------|------|
| C1 | 公開頁只能看 7 天 | ⭐ | ✅ 14 天 + 「再 7 天 ►」 |
| C2 | 公開頁服務 description 沒顯示 | ⭐ | ✅ |
| C3 | 取消預約後無法**改期** | 🟡 | ✅ |
| C4 | 沒辦法看過去預約過哪些教練 | ⚪ | ✅ `/my-bookings` 上方「我的教練」按教練聚合 |
| C5 | 公開頁無教練聯絡方式 | ⚪ | ✅ hero 區顯示 email / phone / LINE / note |

## 🌐 跨角色 / 系統面

| # | 問題 | 嚴重度 | 狀態 |
|---|------|--------|------|
| X1 | 手機版排版沒做 responsive 測試 | 🟡 | ✅ `md:hidden` Sheet drawer |
| X2 | 取消 / 刪除動作無確認 dialog | ⚪ | ✅ `ConfirmDialog` 全面取代 `window.confirm()` |
| X3 | 沒有 toast 持久顯示成功操作 | ⚪ | ✅ Sonner 預設 `duration=5000` + `closeButton` |

---

# 🚀 本次要修的 ⭐ 項目

1. **O1**：Owner 的行事曆支援「全部成員」+「個別篩選」（用 checkbox 多選）
2. **O2**：新增「重複規則」管理頁 — 列表、編輯、刪除（含級聯刪除生成的 slots 選項）
3. **O3**：行事曆上的時段點擊 → 跳出 detail panel（誰預約了、何時建立的）+ 刪除按鈕
4. **O4**：新增「學員」頁 — 列出有跟自己預約過的所有客戶 + 預約次數
5. **C1**：公開頁從 7 天延伸到 14 天 + 加「下一週」按鈕
6. **C2**：公開頁顯示服務 description
7. **P1**：平台管理員可從租戶列表直接 impersonate-view（唯讀進入該租戶後台）

修完後再來決定下一輪。

---

# 🎨 claudeDesign UI Alignment(2026-05-27 已完成)

S6 之後再做的一次完整 UI 對齊到 `claudeDesign/` mockup,Direction C(B&W + 鮮黃 accent / 18px card / 999px pill / Anton + Space Grotesk + Noto Sans TC + Space Mono)。Spec: `docs/superpowers/specs/2026-05-27-claudedesign-ui-alignment-design.md`。

## Phase 1 覆蓋(已完成)

| Plan | 範圍 | 完成 commits |
|---|---|---|
| P1 Foundation | 3 schema migrations(hero meta / is_popular / notification matrix + quiet hours)+ 11 primitives(Button 擴充、Kicker、EmptyState、KpiCard、SubNav、AppShell、DateRibbon、TimeChip、RescheduleBanner、DateStrip、NotificationMatrix、QuietHoursInput)+ supabase/seed.sql 基礎 demo + vitest TSX setup | `ae1e757`~`70098d4` |
| P2 Student 6 頁 | /<slug> hero meta + reschedule banner + DateRibbon/TimeChip + recap + footer / /<slug>/packages 分組+POPULAR / /book empty state+radio cards / /login+/signup polish / /my-bookings KPI+DateStrip | `4886601`~`1753764` |
| P3 Coach 7 頁 | /dashboard 黑底 hero+4 KPI+timeline+pending / /calendar 三視圖 / /services tab+grid / /customers 搜尋+Sheet drawer / /packages 分組+POPULAR / /packages/pending KPI / /notifications log inbox | `0ffbc36`~`37c2b46` |
| P4 Settings 4 頁 | SubNav 跨頁共用 / /settings/profile 6 sections+sticky save+hero inputs / /settings/notifications 新建(matrix+quiet hours,無 email) / /calendar/availability+/rules SectionHead polish | `960d7a8`~`e7a8e4e` |

## Phase 2 backlog(2026-05-29 全部完成)

| 條目 | 結果 |
|---|---|
| `/book/<slotId>` 互動式套裝選擇 | ✅ A-1。`book_with_purchase` 加 `p_purchase_id`,radio enabled,新 error `PURCHASE_INVALID`。3/3 integration test。 |
| Public page slot picker group capacity | ✅ A-6。`/api/public/slots` 回傳 `max_capacity` + `current_bookings`,`TimeChip state='group'`。同 commit 修底層 slot lifecycle 3 RPC(`booked` 只在 capacity 滿才標)。 |
| `/<slug>/packages` 部份付 + receipt note | ✅ A-4。CHECK 加 `'partial_paid'`,新 `receipt_note text` column,form 加條件 textarea,coach pending 顯示 RECEIPT block。 |
| `/signup` invite banner tenant_name | ✅ A-7。新公開 endpoint `/api/invite/resolve`,debounced useEffect 抓 tenant 名。 |
| `/notifications` persistent read state | ✅ A-5。`read_at timestamptz` + RLS UPDATE policy(self only)+ partial unread index;per-row click + 「全部標為已讀」bulk button。 |
| recurring rule live conflict-detection | ✅ A-3。抽 `computeRulePreview` helper,`previewRecurringRuleAction` 無 DB writes,dialog 300ms debounce 顯示「共 N 個時段 · 其中 K 個衝突 · M 個落在作息外」。 |
| Services 拖曳排序 | ✅ A-9。`services.display_order` + dnd-kit + `reorderServicesAction`(owner only + cross-tenant count guard);只在 ALL tab + 啟用 view + >1 service 才開 drag。 |
| **Email 通知** | ⚠️ 不做。Owner 決定,memory `project_claudedesign_ui_alignment.md` 已標。 |
| Web Push 真實訂閱 | ✅ 復查確認已完整 wired(早於本期);剩下純手動驗。 |
| S7 audit report | ✅ `docs/superpowers/specs/2026-05-28-s7-audit-report.md` + 後續 RPC caller-guard audit(`2026-05-29-security-definer-rpc-audit.md`)+ P0 fix(commit `a96cf02`,擋 cross-customer booking 攻擊)。 |
| zxcvbn password strength | ✅ HIBP 鎖 Pro Plan 的 mitigation(commit `382791e`,Score≥2 threshold)。

## 對齊 token / 規則(全站已套)

- 18px radius cards / 999px pill buttons / 卡片陰影 `0 8px 24px -18px rgba(0,0,0,0.18)`
- Anton + Space Grotesk + Noto Sans TC + Space Mono via `next/font/google`
- B&W 主軸 + accent 黃**僅作 punctuation**(badge / kicker dot / arrow circle / Pill yellow / NEXT-UP highlight / RescheduleBanner)
- Dashed border-[1.5px] empty states / Mobile drawer overlay bg-black/45 backdrop-blur
- Direction C tokens light + dark 兩套,next-themes 切換
