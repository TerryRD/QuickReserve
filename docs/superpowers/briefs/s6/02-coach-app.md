# Brief 02 — Coach App：教練後台日常工作介面

> 接在 `00-anchor.md` + `01-student-experience.md` 的同一個 Claude Design 對話之後。**請繼續用 anchor 選定的 direction**。

---

## 痛點重述（這份要解決的）

- 後台目前是純 plain header / sidebar / grid 結構、缺視覺品味
- `/dashboard` 過於空（build output 只有 834B），缺 hero / KPI / 引導
- `/calendar` 是教練最常用的頁、但密度高、視覺層次不夠、tablet 體驗差
- 後台與公開頁設計語言差異大、像兩個 app

---

## 設計系統限制（與 anchor 一致）

- 沿用選定 direction
- shadcn token 名不換
- 三斷點全做
- CJK 字型一致
- light + dark mode 都要
- a11y 基線

---

## 要 mockup 的 8 個區塊

### 1. Sidebar Nav（共用、所有後台頁的左側欄）

**功能：** 後台主導覽

**元素：**
- Logo / 品牌名 + slug 顯示
- 教練 avatar + 名字 + 角色（Owner / Staff）
- 主要 nav 項目：Dashboard、Calendar、Customers、Services、Packages、Packages > Pending、Settings
- 各項目可有 badge（例：Pending 套裝申請數）
- 底部：theme toggle（light/dark/system）、登出
- Mobile：抽屜模式（漢堡 → 滑入）
- Tablet：可摺疊（icon-only 或 expanded）
- Desktop：固定展開 ~240px 寬

**要保留：** sidebar 結構（不要換成 top-nav）
**要重做：** 視覺層次、icon 與文字搭配、active state、theme toggle 加進去

### 2. `/dashboard` 教練首頁

**功能：** 登入後落地頁，看今日狀態與快速 action

**元素：**
- Hero 區（含問候語：「早安，<教練名>」+ 今日日期）
- KPI 卡片：本週待確認預約數、本週確認預約數、套裝待審核數、本月新學員數
- 「今日預約」list（時間 + 學員 + 服務）
- 「待確認預約」list（含「確認 / 拒絕」inline action）
- 快速 action：建立可用時段、查行事曆、開放新套裝
- 空狀態（新教練尚未有資料）

**要保留：** 沒什麼要保留（這頁太空、整個重做）
**要重做：** 整個內容架構

### 3. `/calendar` 行事曆（最重要頁面）

**功能：** 教練看自己 + 助教的時段與預約，含三種視圖切換

**元素：**
- Header：日期範圍顯示 + 上下週 nav + 「今天」按鈕 + 視圖切換 toggle（週 / 列表 / 月）
- 視圖切換按鈕（Tab style 或 Segmented Control）
- 教練/助教 filter（多選 chip）
- 主視圖：
  - **Week view**: 7 column × 時間 row grid，每格塞 slot 卡（含預約者 / 衝突 badge / 團班 N/M 徽章）
  - **List view**: 時間排序列表，每筆 slot 含完整資訊
  - **Month view**: 月曆格子，每格顯示當日 slot 數量點
- Slot popover（點 slot 彈出）：時段詳情、預約者列表、操作按鈕（取消 / 改期 / 開放新預約）
- 不可用事件 badge（紅色標記，撞 event 的 slot）
- 團班 capacity badge（藍色「2/4」）

**要保留：** 三視圖切換、popover 模式、衝突 badge 設計、團班 N/M 徽章
**要重做：** 整體密度與留白、tablet 的視圖（現在 week view 太擠）、popover 視覺品質

### 4. `/services` 服務管理

**功能：** 教練 Owner CRUD 自己的服務（含團班參數）

**元素：**
- Header：「服務管理」+ 「新增服務」按鈕
- Tab：使用中 / 已刪除
- 服務卡片網格：每卡顯示
  - 服務名、描述
  - 時長、價格
  - capacity / min_attendance / cancel_deadline_hours（團班參數）
  - 編輯 / 刪除 按鈕
- 編輯/新增 dialog：表單含上述欄位
- 空狀態

**要保留：** 卡片網格、Tab 切換
**要重做：** 卡片視覺、團班參數顯示方式

### 5. `/customers` 學員管理

**功能：** 教練看在自己租戶下註冊預約過的學員

**元素：**
- Header：「學員管理」
- Filter（搜尋名字 / 狀態）
- 學員列表，每筆：
  - 名字、Email
  - 累積預約數
  - 目前套裝餘額
  - 最後預約日
  - 「查看詳情」連結
- 學員詳情側邊抽屜或 modal：所有預約紀錄、所有購買的套裝
- 空狀態

**要保留：** 列表 + 詳情 drawer 結構
**要重做：** 列表視覺、抽屜資料密度

### 6. `/packages` 套裝管理

**功能：** 教練 Owner CRUD 服務的套裝（X 堂 + 期限 + 價格）

**元素：**
- Header：「套裝管理」+「新增套裝」+ 切到「審核列表」連結
- 按服務分組（每組 H2）
- 每張套裝卡：套裝名、堂數、期限、價格、編輯 / 刪除
- Tab：使用中 / 已刪除
- 編輯 dialog

**要保留：** 按服務分組
**要重做：** 卡片視覺、空狀態

### 7. `/packages/pending` 套裝申請審核

**功能：** 學員申請套裝後待教練核可，含「同意」「拒絕」按鈕

**元素：**
- 列表，每筆 pending：
  - 學員名 + Email
  - 申請套裝（含堂數 / 價格 / 期限）
  - 學員自報付款狀態（已付 / 未付 / 收據）
  - 申請時間
  - 同意 / 拒絕 按鈕（含確認 dialog）
- 空狀態（沒有 pending 申請）
- 「查看歷史紀錄」連結

**要保留：** 同意/拒絕的雙按鈕
**要重做：** pending 卡片視覺、狀態 prominent

### 8. `/notifications` 通知列表（如果有）

**功能：** 教練收到的所有通知（新預約 / 確認 / 取消 / 改期 / 套裝申請）

**元素：**
- 列表，每筆通知含 icon + 內容 + 時間
- 未讀標記
- 點擊 → 跳對應頁面（slot / purchase）

**互動：** 標記已讀、清空

---

## 期望輸出

**單一 HTML+CSS+JS artifact**，sidebar nav + 主內容區，可切上述 8 個區塊。三斷點全做。

- 沿用 anchor 選定 direction
- 提供新增的 CSS variables（不重複 anchor 已有的）
- 互動可用假資料（dummy 預約、學員、套裝）

---

## Acceptance checklist

- [ ] 8 個區塊都齊
- [ ] Sidebar 可摺疊 / mobile 抽屜
- [ ] Theme toggle 在 sidebar 底部
- [ ] Calendar 三視圖（週 / 列表 / 月）切換可用
- [ ] Slot popover 設計到位
- [ ] 團班 N/M 徽章 + 衝突 badge 視覺一致
- [ ] 三斷點全做
- [ ] light + dark 都呈現
- [ ] 與 anchor / 01-student-experience 視覺連貫
