# Brief 03 — Coach Settings：教練設定與配置

> 接在 `00-anchor.md` + `01-student-experience.md` + `02-coach-app.md` 之後，**請繼續用 anchor 選定的 direction**。這份是 S6 最後一份 brief。

---

## 痛點重述（這份要解決的）

- `/settings/profile` 剛在 S5 重做（5 個 section + sticky 儲存列），sections 視覺差異化不足、節奏太單調
- `/calendar/availability` 與 `/calendar/rules`（作息模板與重複規則）是教練偶爾要碰但容易迷路的頁，需要更好的引導與視覺
- `/settings/notifications` 是純表單，缺視覺品味

---

## 設計系統限制（與 anchor 一致）

- 沿用選定 direction
- shadcn token 名不換
- 三斷點全做
- CJK 字型一致
- light + dark mode 都要
- a11y 基線
- 點擊區 ≥ 44×44（mobile）

---

## 要 mockup 的 4 頁

### 1. `/settings/profile` 租戶資料設定（S5 剛做完）

**功能：** 教練 Owner 維護公開頁顯示的資料

**頁面元素（6 個 section）：**
1. **基本資料** — 租戶名稱、一句介紹（hero subtitle）
2. **Hero 大頭照（avatar）** — 上傳器（含 preview + 移除）；JPEG/PNG/WebP，≤ 5 MB
3. **完整介紹（Bio）** — TipTap 編輯器（粗體 / 斜體 / 標題 / 清單 / 連結 / 加連結 6 個 toolbar 按鈕）
4. **介紹影片** — URL 輸入 + 即時 preview iframe（YouTube/Vimeo whitelist）
5. **照片** — 多檔上傳 dropzone + 已上傳 grid（每張可改 caption / 刪除）+「N/10」計數；上限 10 張
6. **聯絡方式** — Email / 電話 / LINE ID / 備註 4 個欄位
7. 底部 sticky 儲存列「儲存所有變更」

**要保留：** 6 個 section 結構（不要重組）、sticky 儲存列、TipTap toolbar 6 鍵
**要重做：** section 之間的視覺節奏（現在每段太像），avatar uploader 視覺、photo gallery 上傳 UX、整體密度

### 2. `/settings/notifications` 通知偏好

**功能：** 教練設定哪些事件要收 Web Push 推播

**元素：**
- 通知事件列表（每項一行 toggle）：
  - 新預約申請
  - 預約確認
  - 預約取消
  - 預約改期
  - 套裝申請
  - 每日 7:00 當日預覽
  - 每週日 20:00 下週預覽
  - 預約前 N 分鐘提醒（含分鐘數 input）
- Web Push 訂閱狀態 + 啟用 / 停用按鈕
- 各 device 的訂閱列表（可逐個取消）

**要保留：** toggle 列表結構
**要重做：** Web Push 訂閱流程引導、device 列表視覺

### 3. `/calendar/availability` 作息模板

**功能：** 教練設定每週可用時段模板（例如「每週一三五 9:00-18:00」），系統會 materialize 成實際 slot

**元素：**
- 模板列表（每項：名稱、套用範圍、時段描述）
- 新增 / 編輯模板表單：
  - 名稱
  - 套用週幾（複選 chip：一二三四五六日）
  - 時段範圍（多筆：開始時間、結束時間、break 分隔）
  - 套用範圍（哪些 service、哪位 staff、起始日期、結束條件）
- 不可用事件區塊：請假 / 個人事務 / 國定假日
- 「materialize 預覽」— 看模板會展開成的具體 slot

**要保留：** 模板 + 不可用事件分離結構
**要重做：** 表單視覺、materialize 預覽呈現方式

### 4. `/calendar/rules` 重複規則設定

**功能：** 設定 slot 的重複規則（每天 / 每週 / 每月 / 每 N 天 + 結束條件）

**元素：**
- 規則列表（每項：規則描述、套用 slot 數、編輯 / 刪除）
- 新增 / 編輯規則表單：
  - 重複類型 radio：每天 / 每週 / 每月第 N 號 / 每 N 天
  - 對應參數欄位（隨重複類型動態變）
  - 結束條件 radio：N 次 / 截止日 / 無限
  - 衝突偵測結果預覽（如有衝突顯示 badge + 跳到衝突 slot 連結）
- 空狀態

**要保留：** 重複類型 + 結束條件分離
**要重做：** 表單動態欄位視覺、衝突偵測結果呈現

---

## 期望輸出

**單一 HTML+CSS+JS artifact**，sidebar nav（與 02-coach-app 一致）+ 切上述 4 個區塊。三斷點全做。

- 沿用 anchor 選定 direction
- 提供新增的 CSS variables
- 互動可用假資料（dummy template / rule / 通知偏好）

---

## Acceptance checklist

- [ ] 4 頁都齊（profile / notifications / availability / rules）
- [ ] settings/profile 6 個 section 視覺差異化、節奏清晰
- [ ] TipTap toolbar 6 鍵呈現
- [ ] Photo gallery 上傳 + grid 設計到位
- [ ] availability 與 rules 表單有引導感，不像 raw form
- [ ] 衝突 badge 跨頁一致（與 02-coach-app 的 calendar 設計同源）
- [ ] 三斷點全做
- [ ] light + dark 都呈現
- [ ] 與 anchor / 01 / 02 視覺連貫
