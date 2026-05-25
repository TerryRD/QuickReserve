# S2 — RWD Audit

**範圍**：14 條已有 loading.tsx 的 route + 已有 4 條 platform route，共 ≈ 20 條。
**Viewports**：375 × 667（iPhone SE）、768 × 1024（iPad mini）。
**Pass 標準**：無橫向 scroll、按鈕 touch target ≥ 32px、表單 1 column、dialog 不超 viewport、表格不橫向爆炸、行事曆 grid 在 375px 強制切換 day view、sidebar drawer 可開合。
**Severity**：P1 = 無法操作（必修）。P2 = 視覺不佳但可用（推 S6）。P3 = nit。

## Checklist 結果（待使用者親跑後填）

| # | Route | 375 | 768 | Issue 摘要 | Severity | Commit |
|---|---|---|---|---|---|---|
| 1 | `/login` | | | | | |
| 2 | `/signup` | | | | | |
| 3 | `/invite/[token]` | | | | | |
| 4 | `/[tenantSlug]`（公開） | | | | | |
| 5 | `/book/[slotId]` | | | | | |
| 6 | `/dashboard`（教練） | | | | | |
| 7 | `/calendar` | ✓ | ✓ | 已強制 ≤ 640px 自動切 day view（見 commit 欄） | — | <FILLED_BY_COMMIT_AT_END> |
| 8 | `/calendar/rules` | | | | | |
| 9 | `/bookings` | | | | | |
| 10 | `/services` | | | | | |
| 11 | `/customers` | | | | | |
| 12 | `/staff` | | | | | |
| 13 | `/settings/profile` | | | | | |
| 14 | `/notifications` | | | | | |
| 15 | `/my-bookings`（學員） | | | | | |
| 16 | `/settings/notifications`（學員） | | | | | |
| 17 | `/platform/dashboard` | | | | | |
| 18 | `/platform/tenants` | | | | | |
| 19 | `/platform/tenants/[id]` | | | | | |
| 20 | `/platform/bookings` | | | | | |

> 空白格代表使用者尚未完成該 viewport 的視覺檢查。完成一條後填入結果與 commit hash。

## P1 Issue Log

| 路徑 | 描述 | 修法 | Commit |
|---|---|---|---|
| `/calendar` (週視圖) | week-grid 在 ≤ 640px 橫向爆炸（7 欄 + 時間欄共 8 欄無法閱讀） | `CalendarPanel` 加 `useEffect` 偵測 viewport，初始進站若 ≤ 640px 且 initialView === 'week' 自動切換為 'day' | <FILLED_BY_COMMIT_AT_END> |

## P2 / P3 (留 S6)

（使用者填寫）

---

## 流程備忘

跑 audit 時：
1. `npm run dev`，開 Chrome DevTools 切換 iPhone SE / iPad mini 模擬
2. 用三種身份各 login 一次（platform admin / tenant owner / customer），跑完該角色能看到的 route
3. 邀請流程要實際 invite 出 token 才能測 `/invite/[token]`
4. 每條 route 跑兩個 viewport，按「Pass 標準」逐項檢查
5. P1 必修，獨立 commit；P2/P3 寫入下表，留 S6
