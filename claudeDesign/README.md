# claudeDesign — 設計參考檔(非 build artifact)

本資料夾是 **2026-05-27 claudeDesign UI Alignment Phase 1** 工作的設計來源:用 Claude Design canvas 工具產的 React mockup,涵蓋 Anchor(三方向探索)、Student 6 頁、Coach 後台 7 頁、Settings 4 頁。

> 這不是 build 進 production 的 code — Next.js 不會看到它。所有 spec / plan 文件引用這資料夾作為 mockup 對照來源。

## 結構

```
claudeDesign/
├── QuickReserve {Anchor,Coach,Settings,Student}.html  # canvas tool 的進入點 shell
├── app.jsx                                            # Anchor 三方向探索(A/B/C)主應用
├── design-canvas.jsx, mockups.jsx, meta.jsx           # canvas 框架 + 字型 / palette 比較卡
├── styles/tokens.css                                  # 三方向 light + dark shadcn tokens
├── coach/                                             # 教練後台 7 頁 + atoms + settings-app
│   ├── app.jsx, settings-app.jsx                      # canvas entry
│   ├── atoms.jsx                                      # Sidebar / Btn / Card / KpiCard 等共用
│   └── page-{dashboard,calendar,services-customers,packages,notifications,
│              settings-profile,settings-notifications,availability,rules}.jsx
├── student/                                           # 學員 6 頁 + atoms
│   ├── app.jsx
│   ├── atoms.jsx                                      # Pill / Avatar / ImgSlot / ServiceCard / SlotPicker 等
│   └── page-{public,packages,book,auth,bookings}.jsx
└── screenshots/                                       # qr-mark 圖樣 + canvas tool 截圖
```

## 對照表(mockup → 實作)

| Mockup | 對應 spec § | 對應實作 |
|---|---|---|
| `app.jsx`(三方向 anchor) | §1 spec | `src/app/globals.css`(選定 Direction C tokens) |
| `coach/atoms.jsx` Sidebar | §4b chrome | `src/app/(tenant)/layout.tsx` + `(platform)/layout.tsx` |
| `coach/page-dashboard.jsx` | §4b-01 | `src/app/(tenant)/dashboard/page.tsx` |
| `coach/page-calendar.jsx` | §4b-02 | `src/app/(tenant)/calendar/*` |
| `coach/page-services-customers.jsx` | §4b-03, 04 | `services/page.tsx` + `customers/page.tsx` |
| `coach/page-packages.jsx` | §4b-05, 06 | `packages/page.tsx` + `packages/pending/page.tsx` |
| `coach/page-notifications.jsx` | §4b-07 | `notifications/page.tsx`(inbox)|
| `coach/page-settings-profile.jsx` | §4c-01 | `settings/profile/*` |
| `coach/page-settings-notifications.jsx` | §4c-02 | `settings/notifications/*` |
| `coach/page-availability.jsx` | §4c-03 | `calendar/availability/*` |
| `coach/page-rules.jsx` | §4c-04 | `calendar/rules/*` |
| `student/page-public.jsx` | §4a-01 | `[tenantSlug]/page.tsx` + `slot-picker.tsx` |
| `student/page-packages.jsx` | §4a-02 | `[tenantSlug]/packages/*` |
| `student/page-book.jsx` | §4a-03 | `book/[slotId]/page.tsx` |
| `student/page-auth.jsx` | §4a-04, 05 | `(auth)/login/*` + `(auth)/signup/*` |
| `student/page-bookings.jsx` | §4a-06 | `(customer)/my-bookings/page.tsx` |

## 在本機檢視 mockup(可選)

每個 `QuickReserve *.html` 是獨立的 React playground,直接用瀏覽器打開即可:

```bash
# Mac/Linux
open "QuickReserve Coach.html"

# Windows
start "QuickReserve Coach.html"
```

(這 4 個 HTML 都載 unpkg CDN 的 React + Babel standalone,有網路就能跑;不需要 npm install)

## 後續

當 Phase 2 backlog 要回頭做這些 deferred 項目時(改期 banner 流程、互動式套裝選擇、Web Push 訂閱、Service 拖曳排序等),這資料夾的 mockup 仍是視覺對照來源 — 不要刪除。

詳細的設計決策跟 commit 範圍記錄於 `docs/superpowers/specs/2026-05-27-claudedesign-ui-alignment-design.md`。
