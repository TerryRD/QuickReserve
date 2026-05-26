# Brief 01 — Student Experience：學員端完整旅程

> 接在 `00-anchor.md` 的同一個 Claude Design 對話之後。**請繼續用上一輪我挑選的 direction**（palette / 字型 / spacing 規則），延伸到下列 6 頁，保持視覺一致。

---

## 痛點重述（這份要解決的）

- 公開頁 `/<slug>` 是 editorial gradient hero，但學員後續流程（套裝、預約、查我的預約）視覺斷掉、像不同 app
- 學員未登入點 slot 會被擋去 `/login`、回不到原處（已修但 UI 不夠引導）
- `/my-bookings` 純表列、缺視覺層次
- 公開頁 / 套裝 / 預約 三個頁面要連起來像一條順暢的「逛 → 買 → 預約」flow

---

## 設計系統限制（與 00-anchor 一致，不可改）

- 沿用 00-anchor 選定 direction 的 palette、字型、spacing
- shadcn token 名不換
- 三斷點全做（mobile <640px / tablet 640-1023px / desktop ≥1024px）
- CJK 字型一致
- light + dark mode 都要
- a11y 基線（AA 對比、focus ring、reduced-motion、44×44 點擊區）

---

## 要 mockup 的 6 個頁面

### 1. `/[tenantSlug]` 教練公開頁完整版

**功能：** 學員瀏覽教練介紹、選服務、選時段、送出預約申請

**頁面元素：**
- Hero 區塊（同 00-anchor 的 hero）：avatar、名字、短介紹、聯絡方式、未登入 AuthCta
- Bio block（rich text — 含 H2 / 粗體 / 清單 / 連結）
- 介紹影片 iframe（YouTube/Vimeo embed，16:9）
- 環境照片 gallery（grid：1 col mobile / 2 cols tablet / 3 cols desktop；每張可有 caption）
- **服務選擇 section** — 卡片網格（每卡：服務名、描述、時長、價格、選取狀態）
- **時段選擇 section（SlotPicker）** — 日期 ribbon（橫向捲動）+ 時段 grid（每個時段 chip：開始時間、可預約人數 N/M 給團班）
- 「改期模式」黃色 banner（當 URL 帶 `?reschedule=<id>` 時顯示，提示「選擇新時段後原預約自動取消」）

**互動：**
- 點服務卡 → URL 加 `?service=<id>` + slot picker 重抓
- 點日期 → URL 加 `?date=<yyyy-MM-dd>`
- 點時段 chip → 跳 `/book/<slotId>`（需登入）
- 未登入時 AuthCta 顯示「登入 / 註冊」兩按鈕

**要保留：** hero editorial 氣質、avatar inset 設計、bio prose 排版
**要重做：** services 卡片 hierarchy、slot picker 視覺密度（現在太擠）、整體 spacing rhythm

### 2. `/[tenantSlug]/packages` 套裝瀏覽 + 申請購買

**功能：** 學員看教練開放的套裝（X 堂 + 期限 + 價格），按「申請」表單填付款狀態送單

**頁面元素：**
- Header（返回連結到 `/<slug>` + 教練名 + 一句說明）
- 未登入 AuthCta（與公開頁一致）
- 套裝列表，按服務分組（每組 H2 服務名）；每張卡：
  - 套裝名稱 + 堂數
  - 期限說明（「30 天內上完」或「永久有效」）
  - 大型價格數字
  - 「申請」按鈕（點開後展開表單：付款狀態、收據備註、送出）
- 空狀態（教練尚未開放套裝）

**互動：** 點申請 → 表單展開 → 送出 → toast 確認

**要保留：** 卡片網格佈局、價格 prominent 排版
**要重做：** 表單展開動畫、按鈕 hierarchy、套裝卡的視覺差異化

### 3. `/book/[slotId]` 預約確認頁

**功能：** 學員點時段後落地此頁，看時段詳情、選擇用哪張 punch-card（餘額來自 customer_purchases），送出預約

**頁面元素：**
- 大標：「預約 <服務名> <日期 時間>」
- 服務資訊卡（時長 / 價格 / 教練）
- 套裝餘額顯示（學員此教練下已購買的套裝列表，含剩餘堂數）；無餘額時顯示「需先購買套裝」+ 跳轉 `/<slug>/packages`
- 確認按鈕（「確認預約」），送出後 pending 狀態待教練核可
- 取消改期模式時跳回公開頁

**互動：** 點確認 → 送出 → toast「待教練確認」→ 跳 `/my-bookings`

**要保留：** 預約確認的儀式感（不是隨便一個 form）
**要重做：** 套裝餘額視覺呈現、餘額不足時的引導路徑

### 4. `/login` 登入頁

**功能：** Email + 密碼登入；支援 `?redirect=` 與 `?signedup=1`

**頁面元素：**
- 大標「歡迎回來」
- Email + 密碼欄位
- 登入按鈕
- 「還沒有帳號？建立帳號」連結
- `?signedup=1` 時頂部綠色 banner「✓ 註冊成功，請使用該帳號登入」

**要保留：** 簡潔
**要重做：** 視覺品味（現在很 basic、缺氛圍）

### 5. `/signup` 註冊頁

**功能：** 學員自註冊（姓名 + email + 密碼）；支援 `?invite=<token>` 與 `?redirect=`

**頁面元素：**
- 大標「建立帳號」
- 姓名 / Email / 密碼 欄位
- 「建立帳號」按鈕
- 「已有帳號？登入」連結
- 若 `?invite=` 帶 token，文案改「完成註冊後將自動接受邀請」

**與 login 視覺一致**

### 6. `/my-bookings` 學員的預約列表

**功能：** 學員看自己所有預約（跨教練），按時間排序

**頁面元素：**
- 大標「我的預約」+ 月份/狀態 filter
- 每筆預約卡：
  - 教練名 + 服務名
  - 日期 時間
  - 狀態 badge（pending / confirmed / cancelled / completed）
  - 操作按鈕：「改期」（跳 `/<slug>?reschedule=<id>`）/「取消」（含確認）
- 空狀態（尚未有預約）

**要保留：** 卡片列表
**要重做：** 狀態 badge 視覺、時間排序的視覺分組（今日 / 本週 / 之後）

---

## 期望輸出

**單一 HTML+CSS+JS artifact**，內含 sidebar 或 top-nav 切換上述 6 頁。每頁需含 mobile / tablet / desktop 三斷點（可用 viewport switcher 或 iframe 並列）。

- 沿用 anchor 對話選定 direction 的 palette + 字型，不要重新提案
- 提供任何**新增**的 CSS variables 給我（不重複 anchor 已有的）
- 互動可用假資料（dummy 教練 / 服務 / 時段）

---

## Acceptance checklist

- [ ] 6 頁都齊（公開頁完整 / packages / book / login / signup / my-bookings）
- [ ] 視覺與 anchor 選定 direction 一致
- [ ] 三斷點全做
- [ ] light + dark mode 都呈現（可用 toggle 或 side-by-side）
- [ ] 互動細節到位（hover、focus、loading state）
- [ ] AuthCta、未登入引導、改期模式 banner 等狀態都呈現
