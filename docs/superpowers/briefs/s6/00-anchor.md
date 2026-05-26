# Brief 00 — Anchor：3 個視覺方向提案

> 這份 brief 是 S6 的第一份、定整體設計方向。請貼到 **新的** Claude Design 對話開頭，得到 3 組 direction 後挑 1 組，後續 brief（01~03）會繼續在同一個對話中要求 Claude Design 用選定 direction 延伸到其他頁面。

---

## 專案背景

**QuickReserve** 是 B2B2C 教練預約 SaaS：
- 三層使用者：平台管理員、教練（Owner + Staff 助教）、學員
- 教練申請帳號後拿到 `/<slug>` 公開連結；學員點連結瀏覽服務、買套裝、預約時段
- 技術：Next.js 15 App Router + React 19 + Tailwind v4 + shadcn/base-ui + Supabase
- 中文：`<html lang="zh-Hant">`，繁體中文為主使用者語言

---

## 為什麼要重做視覺

目前累積出四個問題：

1. **中文字型 fallback 醜** — 字型只設 Latin subset，中文走系統字、各裝置不一致
2. **Dark mode token 已備但沒 toggle 出來給使用者選**
3. **跨頁 UI 不一致** — 公開頁是 editorial gradient hero、後台是 plain header，視覺語言不連貫
4. **整體質感不足** — micro-interaction、spacing、對比、字型搭配都還沒「拉到專業級」

---

## 設計系統限制（**所有 direction 都必須遵守**）

### 1. Shadcn token 名稱不可改

CSS variables 變數名必須維持下列原樣（值可以全換、名不可動），否則整套 UI components 會爆：

```
--background, --foreground
--primary, --primary-foreground
--secondary, --secondary-foreground
--accent, --accent-foreground
--muted, --muted-foreground
--card, --card-foreground
--popover, --popover-foreground
--destructive
--border, --input, --ring
--sidebar, --sidebar-foreground, --sidebar-primary, --sidebar-primary-foreground, --sidebar-accent, --sidebar-accent-foreground, --sidebar-border, --sidebar-ring
--radius
```

### 2. Light + Dark mode 都要

每組 direction 需提供 **兩套完整 palette**（light + dark），dark 不是 light 反相、要獨立調對比與飽和度。

### 3. CJK 字型

`lang="zh-Hant"`。中文字型必須：
- 與 Latin display font 搭配自然（heading 中英混排不跳體）
- 與 Latin sans 搭配（body 中英混排不破節奏）
- 可從 **Google Fonts** 載入（避免自託管）

候選（不限於此）：Noto Sans TC、Source Han Sans TC、GenJyuuGothic、Klee One、LXGW WenKai TC、jf openhuninn。

### 4. RWD 三斷點（每個 mockup 都要含三個 viewport）

| 斷點 | 寬度 | Tailwind | 目標 |
|---|---|---|---|
| Mobile | <640px | default | iPhone / Android 手機 |
| Tablet | 640~1023px | `sm:` / `md:` | iPad 直立、平板橫式 |
| Desktop | ≥1024px | `lg:` 以上 | 筆電 / 桌機 |

### 5. a11y 基線

- 對比 WCAG AA（4.5:1 文字 / 3:1 大字 / 3:1 UI）
- focus ring 可見且不被裁切
- prefers-reduced-motion 尊重
- 點擊區 ≥ 44×44 px（mobile）

---

## 本份 mockup 範圍

**只 mockup 公開頁 `/<slug>` 的 hero + 緊鄰下方一個 section（services 或 bio）**。其他頁面等 direction 確定後才延伸。

### 公開頁 `/<slug>` 結構（要 mockup 的部分）

頁面元素（從上到下，**每組 direction 都需要呈現完整這些元素**）：

1. **Hero 區塊**
   - 教練 avatar（圓形，80×80px desktop / 64×64 mobile）
   - 教練名字（大型 display 字）
   - 一句短介紹（subtitle）
   - 聯絡方式（email / 電話 / LINE ID — icon + 文字）
   - 「尚未登入」CTA（給訪客）— 登入 / 註冊 按鈕

2. **緊鄰下方一個 section**
   - 「關於」（Bio block，rich text 區）— 含一段 prose（粗體、清單、連結）
   - 「服務」(service grid — 服務卡片，2~3 張，每卡有名稱、描述、時長、價格)
   - 或「介紹影片」+「環境照片 gallery」

選 1~2 個能凸顯 direction 風格的 section 即可。

### 互動細節
- 公開頁無需登入即可瀏覽；CTA 按鈕引導學員去登入
- 三斷點下 hero 高度自適應；avatar 與名字排列在 mobile 可堆疊
- 後續會在 hero 加 hover/scroll micro-interaction 提示

---

## 任務 — 請給我 3 組設計方向

每組 direction 都要包含：

1. **Direction 名（含 1~2 個 mood 字）** — 例如「Editorial / 編輯系」「Minimalist / 極簡」「Warm Craft / 暖手作」「Sport Bold / 運動硬派」
2. **設計理念**（200~400 字）— 為什麼選這個方向、適合什麼性格的教練、視覺重點
3. **CSS variables**（light + dark 兩套，**含 shadcn 全套 token**）— 以 `:root { --background: oklch(...); ... }` 和 `.dark { ... }` 形式給出
4. **字型搭配** — display / sans / mono / CJK 各一支，列 Google Fonts 名稱與選用 weight
5. **公開頁 hero + 一個 section 的 mockup**（HTML+CSS+JS），含：
   - Desktop（≥1024px）視圖
   - Tablet（768px）視圖
   - Mobile（375px）視圖
   - 內部可用 `<meta name="viewport">` 模擬，或用 iframe 並列展示
6. **設計細節說明**（200~300 字）— hero 為什麼這樣排、字型為什麼這樣搭、對比與留白決策

### 3 組 direction 之間的差異要明顯

不要全 3 組都是同一 mood 的微調。可以包含但不限：
- 顏色基調差異（warm vs cool / saturated vs muted）
- 字型氣質差異（serif-driven vs sans-only / contemporary vs classic）
- 排版氣質差異（dense vs spacious / centered vs left-aligned / editorial vs grid-card）

### 不需要做的事

- 不要做後台介面（後續 brief 處理）
- 不要做 dark mode 切換 toggle UI（功能性元件、後續處理）
- 不要做 RWD 之外的響應式技巧（容器查詢、scroll-driven animation 等先不必）

---

## 期望輸出格式

請以 **單一 HTML+CSS+JS artifact** 形式給出，artifact 內含：

1. 頂部一個「切換方向」的 nav（3 個 tab，點擊切到對應 direction）
2. 每個 direction 內含：
   - 設計理念說明文字
   - palette 視覺色卡（顯示每個 token 的色塊 + 名稱 + 色值）
   - 字型樣本（display / sans / CJK 各印幾個字，中英文都要）
   - 三斷點 hero mockup（用 iframe 或 viewport switcher 並列）
3. 用 `<style>` 直接放 CSS variables（讓我容易 copy）
4. 不需要打包工具、不依賴外部 npm package；可以引用 Google Fonts CDN

---

## Acceptance checklist（我收到 artifact 後會檢查）

- [ ] 3 組 direction 明顯不同
- [ ] 每組都含 light + dark 兩套 palette
- [ ] 每組都含 CJK 字型（中英文混排不跳體）
- [ ] 每組都含三斷點 mockup（desktop + tablet + mobile）
- [ ] CSS variables 用 shadcn token 名（不要新增變數名、不要重命名）
- [ ] 對比通過 AA（你可以說明每組的對比驗證結果）
- [ ] 設計理念說明清楚（不只給圖、要說 mood / target user / 視覺決策）

收到後我會挑 1 組、然後續貼 brief 01~03 延伸到其他頁面。
