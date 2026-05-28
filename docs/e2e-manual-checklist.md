# Manual E2E Checklist — 2026-05-28 Phase 1 ship

四個角色按表操作一遍,每項都有「應該看到什麼」可對。預計 30~45 分鐘走完。

> **Production URL:** https://quick-reserve-mu.vercel.app/
>
> **每個測試帳號密碼都是** `Test1234!`(由 `scripts/seed-test-data.mjs` 種出來)

---

## 通用驗收(每頁都要看)

每打開一頁,順手檢查:

- [ ] **黑白主軸** + 鮮黃 accent 只在「punctuation」(badge / kicker dot / 強調 underline / NEXT-UP / accent CTA / POPULAR pill / yellow side bar)
- [ ] **Direction C 字型** 載入:大標 `Anton`(英文 condensed)、CJK `Noto Sans TC`(粗體混合用 font-cjk)、mono `Space Mono`(kicker / 標籤 / time)
- [ ] **18px radius cards** + 陰影 `0 8px 24px -18px rgba(0,0,0,0.18)`
- [ ] **999px pill buttons** for primary CTA
- [ ] **Dark mode 切換**(畫面右上 ThemeToggle 三態:日/夜/系統)— 切過去不應該有「殘留亮色塊」或「文字看不清」
- [ ] **三斷點**(用 DevTools resize):desktop ≥1280 / tablet 768 / mobile 375 都不破版

---

## 🛠️ 平台管理員(`terry@webplus.com.tw`)

### `/platform/dashboard`
- [ ] 上方 mono kicker `PLATFORM · 平台後台`
- [ ] 大 display 標題「平台儀表板」
- [ ] **6 個 KpiCard 網格**(啟用租戶 / 使用者總數 / 預約紀錄總數 / 待確認預約 / 推播訂閱數 / 平台管理員)
- [ ] 待確認預約 > 0 時整張 card 有 `border-accent`(黃邊)
- [ ] 左邊 sidebar:`QRMark` logo + 「QuickReserve · PLATFORM · 平台後台」mono 標
- [ ] sidebar 底部 ThemeToggle 三態切換正常

### `/platform/tenants`
- [ ] Kicker + display h1「租戶管理」
- [ ] 中間 InviteCoachForm 卡片正常
- [ ] 下方 SectionHead「TENANTS · ALL TENANTS」+ 租戶列表 table
- [ ] 點任一租戶 → `/platform/tenants/[id]` drill-in 正常

### `/platform/bookings`
- [ ] Kicker + display h1「全平台預約」
- [ ] **Pill 風格 segmented filter**(全部 / 待確認 / 已確認 / 已完成 / 已取消)— 點切換有 query param
- [ ] 旁邊 tenant filter dropdown 過濾
- [ ] Table 用 mono uppercase tracking 表頭、`StatusBadge` 4 狀態
- [ ] 沒資料時顯示 `EmptyState`(dashed 框 + Bell icon)

---

## 🏓 教練 Owner(`demo-coach-wang@example.com`)

### `/dashboard`(P3-1 重頭戲)
- [ ] **黑底 hero card** 佔 hero 區、右上半透明黃色大圓裝飾
- [ ] 上面 mono kicker `DASHBOARD · 日期 · 教練名`
- [ ] 大 display 早安/午安/晚安 + 教練名 + 黃圓點
- [ ] hero 內 3 顆按鈕:**黃 pill accent**「開啟今日行事曆」+ outline「建立可用時段」+ ghost「開放新套裝」
- [ ] hero 下方:**4 個 KpiCard**(本週待確認 / 本週時段 / 今日預約 / 本月新學員)
- [ ] **兩欄 layout**(lg 寬):左 Today timeline + 右 Pending column
- [ ] Today timeline:每個 row time 用 `font-display tabular-nums`,**NEXT UP row 黃底**,團班 row 右側 GROUP/N/M badge
- [ ] Pending column:列 3 筆 + 底下「查看全部待確認 →」link
- [ ] 條件式:本週時段 < 5 時下方出現 **muted-bg Quick Action card**
- [ ] 條件式:tenant.description 空時出現 **dashed EmptyState**

### `/calendar` 三視圖
- [ ] 切 `?view=week`:7 欄日期 grid + slot 卡片
- [ ] 切 `?view=list`:by-date 分組 list
- [ ] 切 `?view=month`:**新 MonthView** 6×7 grid + 每日小點 + 今日 highlight + 衝突警告 icon + 點 cell 跳該週 list
- [ ] **Slot popover** 點 slot 還能彈出 detail(誰預約了、刪除/編輯按鈕)
- [ ] **Owner filter chip**:URL 加 `?member=<staff-id>` 過濾,旁邊出現 dismissible chip
- [ ] 衝突 / 群班 N/M badge 視覺正常

### `/services`
- [ ] 上方 **segmented tab pill**(全部 / 一對一 / 團班)— 按 max_capacity 過濾
- [ ] 2~3 欄 grid + 每張 `ServiceCard`:大 display 服務名 + 價格大字 + 副 description
- [ ] 群班 service card 底部多一條 **CAP / MIN / CXL 3 欄參數區**(`max_capacity` / `min_attendance` / `cancel_deadline_hours`)
- [ ] 最後一格 **dashed 新增服務 placeholder** card(點開 ServiceFormDialog)

### `/customers`(P3-4 大頭)
- [ ] GET-form 搜尋(姓名 / 電話 substring),有 q 時旁邊出現「✕ 清除」
- [ ] **Status filter chip**(全部 / 啟用 / 封鎖)— 每個 chip 旁顯示 count
- [ ] 列表 row 卡片:左 avatar 圓圈含 initial + 名字 + StatusBadge(封鎖時)+ 統計(BOOKINGS / BALANCE / LAST SEEN)
- [ ] 點任一 row → **右側 Sheet drawer 滑出**
- [ ] Drawer 內:PACKAGES section 每張套裝顯示「N/M 堂」+ **進度條** + 期限;BOOKINGS section 列最近 10 筆 + StatusBadge;ACTIONS 區 BlockButton 還在

### `/packages`
- [ ] **segmented tab**(全部 / 一對一 / 團班 / 草稿)
- [ ] **按服務分組** — 每組 SectionHead + 內含 2~3 欄 PackageCard grid
- [ ] PackageCard:`is_popular` 顯示 **黃色 POPULAR pill** 右上角;`is_active=false` 顯示 outline「草稿」badge
- [ ] 每組最後 **dashed 新增套裝 placeholder**(點開預選該 service)

### `/packages/pending`
- [ ] 上方 **4 KpiCard 列**(總待審 / 等待最久 / 本週新進 / 本月通過)— 總待審 > 0 時 accent border
- [ ] **第一筆 PurchaseRow 有 accent ring + 黃色 tint**(強調最舊)
- [ ] 確認 / 拒絕按鈕還能用(本來就有的 action)

### `/notifications`(P3-7 重寫)
- [ ] **這是 inbox 不是設定頁** — 跟舊版差很大
- [ ] **4 個 tab**(全部 / 預約 / 套裝 / 系統)按 type prefix 過濾
- [ ] 每筆 row 左側有 Bell icon
- [ ] **24h 內事件:左側黃色側條 + 字重粗 + Bell icon 黑色**(cosmetic「未讀」)
- [ ] 較舊事件:opacity 70% + 字重正常
- [ ] 右上「推播偏好」outline button 跳 `/settings/notifications`
- [ ] EmptyState 顯示「沒有通知」when filter 沒結果

### `/settings/profile`
- [ ] 上方 Kicker + h1 + **SubNav**(公開頁 / 通知 / 作息 / 重複)4 個 pill,當前 active
- [ ] **6 個 numbered sections**:左 64px 黑圓 + 編號(01 BASIC / 02 HERO META / 03 CONTACT / 04 ABOUT / 05 VIDEO / 06 GALLERY),右 fields
- [ ] **02 HERO META 三欄輸入**:執業年資 / 創立年份 / 城市(P1 新 column)
- [ ] **底部 sticky save bar**:`fixed bottom-0` 對齊 sidebar `md:left-[240px]`,顯示 「已同步 / 有未儲存的變更」+ 取消 + 儲存 pill button
- [ ] 改任何欄位 → bar 變「未儲存」+ accent 圓點;儲存後變回同步
- [ ] 儲存後刷新 → 公開頁 `/<slug>` hero meta line(EST / YRS / TAIPEI)出現

### `/settings/notifications`(P4-2 新建)
- [ ] SubNav active 在「通知」
- [ ] 上方 **Web Push 訂閱卡**(PushOptIn)+ 啟用按鈕(瀏覽器同意 push 權限後 endpoint 寫進 push_subscriptions)
- [ ] **已訂閱裝置列表**:看到 UA-parsed 裝置名 + 「最後使用」+ 移除 button
- [ ] **9 events × 2 channels 矩陣**(列= 新預約 / 預約已確認 / 取消 / 改期 / 套裝申請 / 套裝核准 / 課前提醒 / 每日提醒 / 每週摘要,欄= WEB PUSH / IN-APP)
- [ ] **無 Email 欄**(本期不做)
- [ ] **勿擾時段** checkbox + 兩個 time input,跨午夜時段(22:00 → 07:00)可設
- [ ] 「儲存設定」按鈕 → server action upsert,toast 「儲存成功」+ 「已儲存 HH:MM:SS」

### `/calendar/availability`
- [ ] SubNav active 「作息」
- [ ] **3 個 SectionHead 區段**(01 TEMPLATES / 02 EVENTS / 03 PREVIEW)
- [ ] 模板 cards 18px radius + token-coloured 啟用 badge(accent 黃,不是 emerald)
- [ ] 不可用事件 list 跟既有 dialog 正常
- [ ] 預覽展開後 chip 用 mono + muted-bg(不是綠)

### `/calendar/rules`
- [ ] SubNav active 「重複」
- [ ] 規則 card:每筆有 icon block + mono freq kicker(WEEKLY · 每週 / BIWEEKLY · 雙週 / MONTHLY · 每月 / CUSTOM · 自訂)
- [ ] 「新增規則」dialog 內 **segmented 4 chip type**(可看到 code label like `WKLY`)+ weekday picker token-coloured + **3 種結束條件 pill**(COUNT / UNTIL / INFINITE)
- [ ] 預覽 / 衝突 callout 已 retokenize(無 blue-50 / red-50)

---

## 🤝 教練 Staff(`demo-staff-ming@example.com`)

(隸屬於林教練)

- [ ] 登入後 chrome 還是 tenant sidebar
- [ ] `/dashboard` 跟 Owner 一樣但 KPI 數字只算自己
- [ ] `/calendar`:**看不到「成員 filter」**(只有 Owner 有此功能)
- [ ] `/settings/profile`:**進不去**(redirect 或 forbidden — 只有 Owner 能改租戶資料)
- [ ] `/settings/notifications`:可用,設自己的 notification preferences
- [ ] `/notifications` inbox 可用
- [ ] `/services` `/customers` `/packages` `/packages/pending` 都能看,但 mutation 動作(刪除 service、確認 purchase 等)可能受限 — 看具體 server action 行為

---

## 👤 學員 Customer(`demo-student-ming@example.com`)

### 公開頁 `/demo-wang-coach`(P2-1 大頭)
未登入也可瀏覽。
- [ ] **Hero**:`Badge variant="yellow" COACH` + `/slug` mono · 大 display 英文 slug(uppercase Anton)+ 黃圓點 · CJK 中文名 + 「教練 / COACH」mono 副標
- [ ] **Hero meta line**(若 Section 02 填過):`EST 2018 · 7 YRS · TAIPEI · 內湖`
- [ ] **Avatar + subtitle 配對排版**
- [ ] **Contact pills** row(Mail / Phone / LINE / Note,visible 時),mono 字體,secondary bg
- [ ] **AuthCta**(若 logged out):「登入預約」`PrimaryCtaLink` + 「建立帳號」outline
- [ ] **BIO** + **VIDEO**(若 tenant.intro_video_url 有設) + **GALLERY** sections
- [ ] **Services** section(muted bg) — 3 欄 service cards
- [ ] **SlotPicker**:`DateRibbon` 橫向 chip row + `TimeChip` 4 state(open / full / group / selected)
- [ ] **選到時段 → 黑底 selected slot recap bar 出現**(大 display 時段 + 服務 + 「前往預約」accent button)
- [ ] **Footer**:`QRMark` + mono 文字 + 套裝/我的預約/登入 navi

### 公開頁改期模式 `/demo-wang-coach?reschedule=<bookingId>`
- [ ] 上方出現 **黃色 RescheduleBanner** + Calendar icon + 退出 link
- [ ] 標題改成「改期模式 · 選擇新時段後原預約自動取消」
- [ ] 選到新時段時 recap bar 的 CTA 文字變「**改期到此時段**」

### `/demo-wang-coach/packages`
- [ ] 按服務分組,每組 SectionHead
- [ ] `is_popular` 套裝顯示 **黃色 POPULAR pill 含 Star icon** 右上角
- [ ] 點「申請此套裝」→ **in-card 表單展開**(不是 modal)
- [ ] **付款狀態 segmented**(2 chips:claimed_paid / awaiting_payment)— 第 3 種「部份付」現在沒有(deferred)

### `/book/<slotId>`(P2-3)
- [ ] **大 display slot card**:`EEEE, MMM dd` mono kicker + 大字時間 + CJK 服務名/時長
- [ ] 有套裝時:**radio cards 每張顯示「remaining/total 堂」+ 進度條**(注:目前是 read-only,RPC 自動選最舊的)
- [ ] 沒套裝時:**dashed EmptyState** + Package icon + 「瀏覽套裝」CTA 跳 `/<slug>/packages`
- [ ] **Cancellation policy frame**(muted-40 bg + mono kicker)正常顯示 `cancel_deadline_hours`

### `/login`(P2-4)
- [ ] **Split layout** — 左 form + 右 SidePanel(灰底 + 大 display 「登入　WELCOME BACK」+ 編號 lines)
- [ ] **`<Kicker>STEP 01 · LOGIN`** 在 form 上方
- [ ] h1「歡迎回來」font-display + cjk
- [ ] **Pill submit button** with inline arrow(`withArrow="inline"`)+ 旁邊「建立帳號」outline pill
- [ ] 帶 `?signedup=1` 進來 → 頂端出現 **accent 黃 banner**「SIGNED UP · 註冊成功!」

### `/signup`
- [ ] 跟 login 相同的 split + Kicker pattern
- [ ] 帶 `?invite=<token>` → 出現 accent banner「INVITED」(目前沒顯示 tenant_name,deferred)
- [ ] Submit 後跳 `/login?signedup=1` 或自動 sign-in

### `/my-bookings`(P2-6)
- [ ] 上方 **4 KpiCard 列**(本週 / 待回覆 / 已完成 / 已取消)— 待回覆 > 0 時 accent border
- [ ] 中間「我的教練」聚合區
- [ ] 下方按時間群組,每組 header 用 **`<DateStrip>` primitive**(今日 / 本週 / 之後 / 已過)+ count
- [ ] 每筆 booking card:date strip + status badge + 服務名 + 時間 + **改期 link**(active booking 才有)
- [ ] **改期 link 帶 `?service=<id>&reschedule=<bookingId>` 跳教練 `/<slug>`**

### `/account/notifications`(舊路徑 `/settings/notifications` 已被 tenant 用)
- [ ] 可達(P4 route fix 後)
- [ ] PushOptIn + 偏好設定(4 個 boolean toggle:週報 / 每日提醒 / 課前提醒 / 預約狀態變更)

---

## 跨角色 / 安全驗收

- [ ] 學員試打 `/dashboard` → 應該 redirect to `/login?redirect=/dashboard`
- [ ] 學員試打 `/platform/dashboard` → 同上 redirect
- [ ] 學員試打 `/packages` → redirect(P4 middleware fix 後不會 500)
- [ ] 學員試打 `/account/notifications` → 自己可以,但 unauth 也 redirect 到 login
- [ ] 助教試打 `/settings/profile` → forbidden
- [ ] 教練 A 試打教練 B 的 `/dashboard` → 看到自己的(因為 dashboard 走 session,自動帶自己的 tenant)

## 已知限制(不必驗,看到不要當 bug)

- 公開頁 SlotPicker 看不到 group N/M 真實計數(`/api/public/slots` 沒返回 group_filled — Phase 2)
- `/book` 套裝 radio 是視覺只讀(RPC 強制選最舊到期的 — Phase 2)
- `/signup?invite=` banner 沒顯示 tenant_name(沒 public endpoint — Phase 2)
- Web Push 真實訂閱(瀏覽器 permission + push)目前只有 UI 殼,不會實際 push — Phase 2
- `/notifications` 24h 內黃色側條是 cosmetic,**不會記** read state(沒 read_at column — Phase 2)
- Calendar slot popover 沒有 live conflict-detection inline(Phase 2)

## 找到 bug 怎麼回報

格式建議:

```
[頁面] /dashboard
[斷點] mobile 375
[模式] dark
[期望] hero card 黑底 + 右上黃圓裝飾
[實際] 黃圓沒看到
[備註] Chrome 128 / Windows
[screenshot] [貼圖]
```

我這邊就能 reproduce + fix。
