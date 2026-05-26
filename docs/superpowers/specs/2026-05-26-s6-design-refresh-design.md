# S6 — 設計重整（主題色 + 字型 + UI/UX）設計文件

**建立日期**：2026-05-26
**狀態**：草稿（待使用者複審）
**作者**：terry@webplus.com.tw（透過 brainstorming skill 共同產出）
**Parent spec**：[`2026-05-21-quickreserve-redesign-design.md`](2026-05-21-quickreserve-redesign-design.md)（FR-137~143 將回寫到附錄 C）
**前置子專案**：S1~S5（最後 commit `e4d4a21`）

---

## 1. 背景

S1~S5 把功能性都做完了（bug、效能、行事曆、商品模型、教練介紹頁），但視覺端有四個累積出的問題：

1. **中文字型 fallback 醜** — `layout.tsx` 三套字（Instrument Serif / Plus Jakarta Sans / Geist Mono）都只設 Latin subset，但 `<html lang="zh-Hant">`，所以中文渲染走系統字（Windows/Mac/Android/iOS 各自不一致）。
2. **Dark mode token 已備但沒 toggle** — `globals.css` `.dark` block 完整、`next-themes` 安裝在 `package.json`，但沒任何 UI 讓教練或學員切換。
3. **跨頁 UI 不一致** — `/[tenantSlug]` 是 editorial gradient hero（dark bg + serif italic h1），`/dashboard` `/calendar` 是 plain header；hero / card / button / spacing 在 S1~S5 各 batch 各長一套，缺一致的 design language。
4. **整體質感不足** — 使用者表述「看起來就是沒啥質感」，需要從 micro-interaction / spacing / 對比 / 字型搭配整體拉升。

S6 把這四個問題打包成一個視覺重整批次。架構 / 資安 audit 分到 S7。

---

## 2. 範圍

### 2.1 In scope（FR-137~143）

- **FR-137**：CJK 字型導入 + 與 Latin display/sans 字組搭配；`layout.tsx` 加 Noto Sans TC（或經評估後選的 CJK 字）
- **FR-138**：主題色重整 — `globals.css` 的 OKLCH 變數依 Claude Design 選定 direction 換新；保留 shadcn token 語意（`--primary`, `--accent`, `--secondary`, `--muted`, `--destructive`）
- **FR-139**：Dark mode 接 `next-themes` ThemeProvider + 後台 sidebar / 公開頁角落加 toggle 按鈕；確保 dark token 跟新 palette 配對重做
- **FR-140**：跨頁 UI 一致化 — hero 模式統一、card style 統一、button hierarchy 統一、spacing token 統一；以 design system artifact 為唯一依據
- **FR-141**：RWD 三斷點完備 — 桌機（≥1024px）、平板（640~1023px）、手機（<640px），每頁都要過三斷點 visual + 互動驗收
- **FR-142**：micro-interaction polish — hover/focus/active state、entry animation、loading skeleton 與新 palette 配套
- **FR-143**：a11y 基線 — 對比度 AA、focus ring 可見、reduced-motion 尊重、CJK 字級可讀

### 2.2 Out of scope（明確排除）

- **架構 review**（耦合度、檔案大小、test coverage） — S7 處理
- **資安 review**（RLS audit、open-redirect 殘留、權限矩陣、Storage 規則交叉） — S7 處理
- **新功能** — 不引入任何 user-facing 功能
- **重大 UI 結構改動** — 例如把後台從 sidebar 改 top-nav、把行事曆從 grid 改 timeline — 這些算 redesign 不算 refresh，避免吃掉 S6
- **教練個人主題色** — 允許教練選自己的 brand color 是個別 feature，S6 不做
- **i18n / 多語** — 仍只 zh-Hant
- **自訂網域 / favicon 系統** — 與視覺有關但獨立 feature

### 2.3 成功標準（驗收 gate）

完成 S6 後（套用 Claude Design 選定 direction 之後）：

1. **CJK 渲染** — 任一頁面在 Windows / Mac / iOS / Android 開啟，中文字皆顯示為設定的 CJK font（非系統 fallback），與 Latin 字組視覺搭配自然
2. **Dark mode** — 後台 sidebar 與公開頁右上有 toggle，切換後三斷點全頁面 token 正確套用、無 colour mismatch、無 contrast 失敗
3. **跨頁一致** — `/[tenantSlug]`、`/dashboard`、`/calendar`、`/settings/profile`、`/book/X`、`/my-bookings` 六頁的 hero / card / button / spacing 視覺一致，從一頁切到下一頁不覺得「換了一個 app」
4. **RWD** — 上述六頁在三斷點下都不破版、互動可用、文字可讀、按鈕可點
5. **a11y** — Chrome DevTools Lighthouse a11y ≥ 95；focus 可鍵盤循環；對比度通過 AA
6. **質感** — micro-interaction（hover/focus/skeleton）順、不卡頓；整體視覺一看就比 S5 收尾時專業

---

## 3. 兩階段工作流（核心架構）

S6 跟 S1~S5 不同 — 中間有「使用者操作外部工具」的真實世界繞道。

### 3.1 階段 A：spec + brief（本文件 commit 後）

我（Claude in QuickReserve session）產出：
- 本 spec（覆蓋背景、範圍、流程、整合策略）
- 4 份 brief 在 `docs/superpowers/briefs/s6/` 給使用者貼進 Claude Design

### 3.2 階段 B：使用者操作 Claude Design（離開本 session）

使用者：
1. 開新 Claude Design 對話
2. 貼 `briefs/s6/00-anchor.md` → Claude Design 回 3 組 direction artifact（每組 = palette + fonts + 公開頁 hero mockup × 3 斷點）
3. 看 3 組挑 1 組
4. 同對話續貼 `briefs/s6/01-student-experience.md` → 用選定 direction 延伸學員全流程
5. 同對話續貼 `briefs/s6/02-coach-app.md` → 延伸教練後台
6. 同對話續貼 `briefs/s6/03-coach-settings.md` → 延伸教練設定
7. 4 份 artifact 全帶回本 session

### 3.3 階段 C：整合（artifact 帶回後）

我：
1. 從 4 個 artifact 抽 design token（CSS variables、字型 family、spacing 規則、breakpoint 行為）
2. invoke `writing-plans` 寫 S6 implementation plan，涵蓋：
   - `globals.css` 變數重寫
   - `layout.tsx` 加 CJK font + ThemeProvider
   - 新建 `theme-toggle.tsx` 與接點
   - 各頁面 UI 對齊 artifact（不重寫功能、只調 className 與結構）
   - RWD 驗證 + a11y 驗證
3. subagent-driven 執行 plan（與 S2~S5 同模式）

---

## 4. 4 個 Brief 的範圍對照

| Brief | 涵蓋頁面 | 主要互動元素 |
|---|---|---|
| `00-anchor` | `/[tenantSlug]` hero 區塊（×3 direction 並列比較） | hero 排版、palette 提案、字型樣本 |
| `01-student-experience` | `/[tenantSlug]` 完整版、`/[tenantSlug]/packages`、`/book/[slotId]`、`/login`、`/signup`、`/my-bookings` | 服務瀏覽、套裝購買、預約、註冊登入、查預約 |
| `02-coach-app` | `/dashboard`、`/calendar`（week+list+month+popover）、`/services`、`/customers`、`/packages`、`/packages/pending`、sidebar nav | 日常後台工作介面 |
| `03-coach-settings` | `/settings/profile`、`/settings/notifications`、`/calendar/availability`（作息模板）、`/calendar/rules`（重複規則） | 設定與配置 |

平台管理員（`/platform/*`）頁面不在 brief 內 — 設計系統定下來後直接從 S6 結果反推（沿用後台 design language）。`/invite/[token]` 同理。

---

## 5. Brief 統一結構

每份 brief 都含以下 sections（00-anchor 多出 direction proposal section）：

1. **專案背景** — QuickReserve 簡介、三層使用者、技術 stack
2. **這份要解的痛點** — 3~5 個具體 pain point（從 S6 spec §1 抽出對應的子集）
3. **設計系統限制** — shadcn token、CJK、light/dark、RWD（3 斷點明列）、a11y
4. **頁面清單** — 每頁含：URL、功能列表、既有 UI 元素、互動需求、要保留 vs 要重做
5. **期望輸出** — HTML/CSS/JS artifact、頁面 nav 方式、CSS variables 區塊、字型用 Google Fonts、「設計理念」說明

00-anchor 額外含：

6. **3 個 direction 要求** — 給 3 個 mood seed（editorial / minimalist / warm-craft 之類）但允許 Claude Design 自己延伸；每組需 palette + fonts + 公開頁 hero × 3 斷點 mockup + 1 段設計理念說明

---

## 6. 設計系統限制（所有 brief 共用）

### 6.1 Shadcn token 不換名

`globals.css` 內的 token 變數名必須保留：

- `--background`, `--foreground`
- `--primary`, `--primary-foreground`
- `--secondary`, `--secondary-foreground`
- `--accent`, `--accent-foreground`
- `--muted`, `--muted-foreground`
- `--card`, `--card-foreground`
- `--popover`, `--popover-foreground`
- `--destructive`
- `--border`, `--input`, `--ring`
- `--sidebar` 系列（5 個）

值可以全換，名不可以動。否則 shadcn / base-ui components 全爆。

### 6.2 Dark mode 必須完整

每組 direction 都要提 light + dark 兩套 palette。dark 不是 light 反相 — 需獨立調對比度與飽和度。

### 6.3 中文字型

`lang="zh-Hant"`。CJK font 必須能：
- 與 Latin display font 搭配（heading 不能跳體）
- 與 Latin sans 搭配（body 中英混排不破節奏）
- Google Fonts 可載入（避免自託管字檔）

候選（不限）：Noto Sans TC、Source Han Sans TC、GenJyuuGothic、Klee One、LXGW WenKai TC。

### 6.4 RWD 三斷點

| 斷點 | 寬度 | Tailwind | 目標裝置 |
|---|---|---|---|
| Mobile | <640px | (default) | iPhone / Android |
| Tablet | 640~1023px | `sm:` / `md:` | iPad 直立 / 平板橫式小 |
| Desktop | ≥1024px | `lg:` 以上 | 筆電 / 桌機 |

每頁 mockup 需提供三斷點版本（artifact 內用 viewport 切換或並列展示）。

### 6.5 a11y

- 對比度通過 WCAG AA（4.5:1 文字 / 3:1 大字 / 3:1 UI）
- focus ring 可見且不被裁切
- prefers-reduced-motion 尊重（micro-interaction 退化到 fade / 立即顯示）
- 點擊區 ≥ 44×44 px（mobile）

---

## 7. 檔案異動清單

### Create（階段 A，本 spec commit 階段）

- `docs/superpowers/specs/2026-05-26-s6-design-refresh-design.md`（本檔）
- `docs/superpowers/briefs/s6/00-anchor.md`
- `docs/superpowers/briefs/s6/01-student-experience.md`
- `docs/superpowers/briefs/s6/02-coach-app.md`
- `docs/superpowers/briefs/s6/03-coach-settings.md`

### Modify（階段 C，artifact 帶回後 — 由 implementation plan 詳列）

預計（具體會由 plan 補實）：

- `src/app/globals.css` — OKLCH 變數重寫（light + dark）
- `src/app/layout.tsx` — 加 CJK font + 包 ThemeProvider
- `src/components/theme-provider.tsx`（新）— next-themes wrapper
- `src/components/theme-toggle.tsx`（新）— light/dark/system 三態 toggle
- `src/app/(tenant)/sidebar-nav.tsx` — 加 toggle
- `src/app/[tenantSlug]/page.tsx` — 公開頁 hero / sections 對齊 artifact
- `src/app/(tenant)/calendar/*.tsx` — calendar 視覺對齊
- `src/app/(tenant)/dashboard/page.tsx` — dashboard 拉升
- `src/app/(tenant)/settings/profile/profile-form.tsx` — section 視覺對齊
- 等等

---

## 8. 風險與緩解

| 風險 | 機率 | 緩解 |
|---|---|---|
| Claude Design 輸出的 palette 換掉 shadcn token 語意（例 --primary 不再是主色） | 中 | brief §3 明列 token 名鎖死、要求保留 |
| 3 個 direction 都不合意、要重生 | 中 | 階段 B 可任意重跑 Claude Design，本 session 不阻擋；fallback 是補 per-page prompt 局部重做 |
| CJK font 拖慢 LCP（字檔大） | 中 | 用 Google Fonts subset + `display: swap` + 只載必要 weight；測 mobile LCP ≤ 2.5s |
| Dark mode 套用後既有 inline color class（如 `text-amber-900`）對比失敗 | 中 | 階段 C plan 含 grep 找 hard-coded color、改用 token；a11y gate 跑 Lighthouse 雙模式 |
| RWD 三斷點 × 14 頁 × 1 direction = 大量驗收成本 | 中 | 階段 C 用 puppeteer screenshot 自動化（同 S2 既有 measurement tooling）或 list-based 手動逐頁過 |
| Tailwind v4 + base-ui + shadcn 的 token 整合若衝突 | 低 | base-ui 已能讀 CSS variables，與 shadcn 同源；不引入第三套 token 系統 |
| 使用者帶回的 artifact 與 brief 期望落差大（例如沒含 dark mode、沒三斷點） | 中 | brief 結尾加「Acceptance checklist」，使用者收到 artifact 自檢；缺什麼就請 Claude Design follow-up |
| 階段 B 拖時間（等使用者操作 Claude Design） | 高 | 不擋進度條 — 本 session 待命，使用者帶回再續；spec 階段 commit 已 ship、視為 milestone |

---

## 9. doc 更新清單（按 [feedback-docs-after-impl] memory）

- 階段 A 結束時：本 spec + 4 brief 都 commit
- 階段 C 結束時：
  - `README.md` 加「主題與字型」section（CJK font 名 + dark mode toggle 位置 + token 結構說明）
  - `docs/superpowers/specs/2026-05-21-quickreserve-redesign-design.md` 附錄 C 加 FR-137~143
  - `memory/MEMORY.md` 視需要新增 feedback memory（例如 design-system convention）

---

## 10. 後續

- 本 spec commit
- 4 brief commit（同階段 A）
- 使用者複審
- 使用者進 Claude Design 拿 artifact 回來
- writing-plans invoke 出 implementation plan
- subagent-driven 執行

S6 完成後接 **S7（架構 / 資安 review）**。
