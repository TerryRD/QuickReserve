# 預約流程改版 v2 — 第 2 階段（P2 取消、改期、成班）實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 預約一送出就成立；學員過了取消期限或會讓團班掉到開班人數以下時，改走請假申請由教練決定；團班成班只判一次、未成班才自動取消；教練多了「學員臨時取消（不退回）」「代改期」「關閉時段」三個動作；到期日與補堂的規則補齊。第一個任務先修好「團班有人預約後別人就看不到時段」，可單獨上線。

**Architecture:** 沿用第 1 階段（設計文件 §14.1 做法 A）：規則全部放在 `security definer` 資料庫函式，同一交易寫 `activity_log` 與 `class_ledger`。名額算法集中成一支 `slot_taken_count`，時段狀態由 `refresh_slot_status` 統一重算，成班由 `mark_slot_formed` 判定，退回由 `refund_class` 統一處理（含補堂）。改期的搬移邏輯集中在 `reschedule_booking_core`，學員改期、教練代改期、同意請假改期三條路共用。

**Tech Stack:** Next.js 15 App Router、TypeScript、next-safe-action、zod、Supabase PostgreSQL（RLS、security definer RPC、pg_cron）、vitest、Playwright。

**Spec:** `docs/superpowers/specs/2026-11-25-booking-flow-v2-design.md`（§6、§7、§9.2、§9.3、§16、§18；§20 是 2026-11-26 的決議修訂）

**同一批文件：**
- SQL 給 terry 審閱的清單：`docs/superpowers/plans/2026-11-26-booking-flow-v2-p2-sql-review.md`
- 示意圖與截圖需求：`docs/superpowers/plans/2026-11-26-booking-flow-v2-p2-mockup-screenshots.md`
- 還要 terry 決定的問題：`docs/superpowers/plans/2026-11-26-booking-flow-v2-p2-open-questions.md`

**前提：**
- PR #24（第 1 階段）已合併，master `d8617d5`。本分支 `feat/booking-flow-v2-p2` 以它為基底。
- PR #25（`test/integration-stability`，整合測試「只替宣告的身分登入」）**尚未合併**。新的整合測試檔一律用它的 `setupBfv2(label, 登入清單)` 寫法，所以線 A 要等 #25 合併並 `merge origin/master` 後才開始。
- **團班時段可見性（任務 1～4）已由 QR-D 在分支 `fix/group-slot-visibility` 實作並 commit（`e2ccd34`）**，SQL 是 `20261126110000_group_slot_visibility_functions.sql`、`20261126110100_group_slot_visibility_policy.sql` 兩個檔，terry 已同意由他自己執行。本分支原本的同名草稿已移除，以 QR-D 的為準；該 PR 合併後本分支 `merge origin/master`。

**專案慣例（與第 1 階段相同）：**
- RPC：`language plpgsql security definer set search_path = public`；錯誤 `raise exception '<代碼>' using errcode = '42501' | 'P0001' | 'P0002'`。
- 整合測試連的是 `.env.local` 指向的 Supabase（會寫入資料），**要等 terry 執行完 migration 並同意後才跑**；與 e2e、其他人的整合測試不可同時跑（登入頻率上限）。
- **不 commit、不 push、不切分支**，除非 terry 在該 session 親口指示。每個任務最後一步是回報改了哪些檔。
- **SQL 一律由 terry 審閱後親自執行。** 實作代理不得執行任何 Supabase 指令。
- 不強制 TDD；每個任務列出要補的測試與驗證指令。
- 實作由 Opus 子代理執行；規格、計畫、SQL 設計由 Fable 負責。

> **SQL 草稿的位置（2026-11-27）：** 6 份草稿放在 `docs/superpowers/plans/sql-drafts/`，**不在** `supabase/migrations/`。原因：還沒經 terry 同意執行的 SQL，不該放在會被資料庫推送指令當成正式 migration 的位置。各組實作 PR 要用時，再把對應的檔搬回 `supabase/migrations/` 並把檔名的時間改成當時的時間；本文件裡出現的檔名（例如 `20261127100100_…`）指的都是草稿資料夾裡的檔。

## Global Constraints

- 畫面、通知、錯誤訊息一律用設計文件 §2 的用語。禁用詞：**套裝、課卡、套票、方案（指預購堂數時）、已完成、未到場**；「退還」寫「退回」。`tests/unit/forbidden-terms.test.ts` 必須維持全過。
- 學員端永遠只出現「教練」。
- 給使用者看的文字不得含錯誤代碼、欄位名、資料庫原始錯誤。未知錯誤顯示「操作失敗，請稍後再試」。
- 權限照 §12 最終版：助教只能動自己時段的預約；「學員臨時取消」只限 Owner；平台管理員不可代操作。全部在資料庫函式內檢查。
- 數值不寫死：提醒提前量、補堂寬限天數取自 `platform_settings`；讀不到就擋下動作，不用預設值頂替。
- 失敗要擋住後續動作：通知查詢失敗只記錄、不影響已成立的動作；但畫面上「能不能取消／改期／請假」讀不到判斷依據時，一律顯示無法操作，不猜。
- **P2 不做：** 「一律需要教練確認」開關、單堂預約與付款、確認期限、點名／待點名／改判、異議、購買撤回／作廢、堂數異動明細的畫面、行事曆時段標籤改名（留第 5 階段）。
- 全文與新增文字用繁體中文（台灣用語）。

## Review Focus

以下情況容易沒被測到，各自掛在負責任務的測試裡：

1. **「剛好等於取消期限」算期限之前**——等於時學員仍可取消；多 1 秒被擋。→ 任務 13。
2. **團班門檻的臨界值**——開班人數 2：已成班、有效 2 人，學員取消被擋；有效 3 人可取消，取消後 2 人、下一位再取消被擋。未成班（1 人）可自由取消。→ 任務 13。
3. **成班只判一次**——成班後掉到開班人數以下再補回，成班時間不變、不重複寫歷程、不重複通知；成過班的時段到了取消期限人數不足**不**被自動取消。→ 任務 12、17。
4. **不退回的取消續佔名額**——一對一被記臨時取消後時段仍額滿；團班少一個名額；同一學員再訂被擋；第 1 階段過渡期的「學員取消＋不退回」**不佔**名額。→ 任務 14。
5. **同意請假改期時新時段已滿／已關閉／到期日不夠**——整筆不變：申請仍審核中、預約仍已確認、歷程與明細筆數不變。→ 任務 15。
6. **請假申請的失效**——審核中時預約被教練取消、被關閉時段、被代改期、學員簽到，申請都變成已失效。→ 任務 15。
7. **補堂**——退回時原購買已過期：原購買已用堂數不變、新增 1 筆補堂、補堂到期日＝當下＋平台設定天數；「已用堂數＝−明細加總」對兩筆購買都成立。→ 任務 16。
8. **到期日**——到期日剛好等於上課時間可以預約；早 1 秒被擋。→ 任務 16。
9. **直接呼叫函式**——助教呼叫臨時取消、學員呼叫處理請假、非本人撤回請假、直接寫 `leave_requests` 表，全部被擋。→ 任務 14、15。

---

## terry 的決議（2026-11-26）

W17 第一輪 13 題的回覆，以這裡為準（題目原文見 scratchpad 的 W17-P2-2-questions.md，已寫回規格 §20）。

| 題 | 決議 | 計畫怎麼落實 |
|---|---|---|
| Q1 | PR #24 已合併，從 master 開新分支 | 本分支 `feat/booking-flow-v2-p2` 以 `d8617d5` 為基底 |
| Q2 | 團班時段可見性放進第 2 階段當**第一個任務**，而且要能**單獨先出一個 PR 上線** | 任務 1～4；migration 獨立一個檔，不依賴 P2 其他 SQL |
| Q3 | 不提前「一律需要教練確認」開關 | P2 用堂數預約一律已確認；`services` 不加欄位 |
| Q4 | 既有待確認轉已確認：**不推播，但系統上要有通知或記號**（terry 原話：像小鈴鐺數字 +1） | 轉換寫歷程，並替每位學員寫一筆站內通知（第二輪 N1 決議，見下表） |
| Q5 | 成班時通知這堂課的所有學員與該時段的教練 | 任務 31；成班後才報名的學員不另外通知，畫面直接顯示已成班 |
| Q6 | 學員臨時取消照規格在第 2 階段上線；通知先寫「如有疑問請聯絡教練」，第 4 階段補異議入口 | 任務 14、26、31 |
| Q7 | 做「關閉時段」 | `close_slot`；任務 14、28 |
| Q8 | 第 2 階段做教練代改期畫面 | 任務 27 |
| Q9 | 教練代改期：開課前任何時間、不受團班人數限制；**要能指定幫哪一位學員改** | `reschedule_booking` 對教練不套用取消期限與團班門檻；入口 A＋B＋C 三個都做（第二輪 N3 決議） |
| Q10 | 請假申請撤回後可以再送 | `submit_leave_request` 只擋「審核中」與「被不同意過」 |
| Q11 | 預約管理加篩選與卡片標記；儀表板待辦區也列出 | 任務 24、29 |
| Q12 | 提醒提前量 2 小時、補堂寬限 30 天，照現值 | 不改 `platform_settings` |
| Q13 | 堂數異動明細的畫面排第 3 階段；P2 只顯示補堂 | 任務 22、30 |

### 第二輪 4 題的回覆（2026-11-26）

| 題 | 決議 | 計畫怎麼落實 |
|---|---|---|
| N1 | 選 2：第 2 階段就做學員端站內通知（鈴鐺＋未讀數字＋通知清單）。既有待確認轉已確認改成寫一筆站內通知，不推播 | 新增「站內通知」一組任務 4A～4F，可單獨出 PR；資料轉換的 SQL 直接寫入站內通知；任務 19 不再做卡片提示 |
| N2 | 選 1：不同意必填處理說明；同意改期、同意退回選填 | `resolve_leave_request` 已補檢查（回 `REASON_REQUIRED`）；任務 15 案例 13、任務 25 |
| N3 | 選 1：代改期入口 A＋B＋C 都做，行事曆時段視窗改成學員名單 | 任務 24、27、28 |
| N4 | 選 3：先看預覽查詢 B 的結果再決定 | 查詢已交司令，terry 自己執行；結果出來前資料轉換維持「不動已過上課時間的待確認」 |

### 第三輪回覆（2026-11-26）

| 題 | 決議 | 計畫怎麼落實 |
|---|---|---|
| P1 | 選 1：教練端通知頁一起補齊，含側欄未讀數字 | 任務 4E 確定要做；示意圖 M15 |
| P2 | 選 1：站內一律留紀錄；教練端推播偏好那一欄沒有作用的「站內」拿掉 | 任務 4B（開關只管推播）；任務 4E Step 4（拿掉那一欄）；示意圖 M16。**不改資料表**，見下方說明 |
| 預覽查詢 B | 1 筆（預約 `d00f3b93-…`，原上課時間 2026-06-02）。處理方式當時未定，第四輪已決定取消並退回 | 資料轉換檔的第二段：以人數不足（系統）取消並退回，附處理前後的查詢 |

### 第七輪回覆（2026-11-27）——站內通知 A 的示意圖 M13～M15 定案

示意圖：<https://claude.ai/artifact/XszeqaGgdAQirrF6YX8dEe>（本機 `D:\terry\VSProject\dispatch\mockups\QR-W23-in-app-notification-mockups.html`）。terry 已看過並選定，任務 4D、4E 可以動工。

| 題 | 決議 | 計畫怎麼落實 |
|---|---|---|
| 1 學員點鈴鐺之後 | **1-B：先跳出小視窗列最近 5 則，再點「看全部通知」進清單頁**（我原本建議 1-A，terry 選 1-B） | 任務 4C 多一個小視窗元件與一支「最近 5 則」讀取；任務 4D Step 1 改寫；任務 4F 補測試。差異見下方 |
| 2 改版前沒有標題內文的舊通知 | 2-A：照樣列出，只顯示一行名稱 | 任務 4C Step 1 原本就是這樣做，不變 |
| 3 教練端側欄那一項 | 3-A：「通知設定」改叫「通知」，加未讀數字 | 任務 4E Step 2 原本就是這樣做，不變 |
| 4 教練用手機時 | 4-A：選單按鈕右上角加小紅點（有未讀才出現） | 任務 4E 新增 Step 2a |

**1-B 與原規劃（1-A）的差異：** 任務數不變（仍是 50 個），多的工作都併進既有任務——
- 任務 4C：多 1 個共用元件（小視窗）、多 1 個基礎元件（專案的共用元件目錄目前沒有浮動小視窗，只有對話框與側拉面板）、多 1 支讀取。
- 任務 4D：鈴鐺從「一個連結」變成「會開關的按鈕」，要處理鍵盤操作、點外面關閉、手機寬度。
- 任務 4F：單元測試多 1 個檔，e2e 第 1 例多一步。
- 我的估計：站內通知 A 整組大約多兩成工作量。不改資料表、不多 SQL、不影響其他 PR 的順序。
- 小視窗的細節（示意圖沒畫到、由我補的設計決定，實作前若 terry 有意見再改）：打開時才去讀最近 5 則（不在每一頁載入時都讀）；**打開小視窗不會把通知標為已讀**，點其中一則才標；沒有通知時顯示「沒有通知」；讀取失敗顯示「目前無法取得通知，請稍後再試」，不顯示成沒有通知；教練端沒有鈴鐺，不用小視窗。

### 第六輪回覆（2026-11-26）——至此沒有待決問題

| 題 | 決議 | 計畫怎麼落實 |
|---|---|---|
| W1 教練以前在勾選表關掉、但沒作用的勾選 | 採用（關的優先） | 轉換 SQL 照草稿；上線步驟加公告：「先前在推播偏好關掉的項目會開始生效」 |
| 定時提醒被關掉時要不要留站內紀錄 | 也留，與事件類一致 | 排程不再用開關篩人；每日提醒、每週摘要採「只留最新一則未讀」（見下方設計決定）；任務 4B、4I |
| 學員送出購買申請時 | 補上通知教練 | 新增任務 4N（放在站內通知 A）；事件清單加回「購買申請」、勾選表保留這一列 |

**設計決定（我的建議，不多出畫面元素，所以沒有再問 terry）：關掉推播的人，站內的提醒不會無限累積。**
- 每日提醒、每週摘要：寫入新的一則時，把同一位使用者、同一種提醒之前**還沒讀**的那幾則自動標為已讀。紀錄都留著（清單裡看得到），但未讀數字裡這兩種各最多算 1。理由：昨天的每日提醒到了今天已經沒有意義，不該一直掛在鈴鐺上。
- 課前提醒：不做這個處理。它是跟著某一堂課的，數量本來就不會超過實際的課數。
- 事件類（預約、取消、請假、購買、簽到）：完全不合併，每一則都算未讀。
- 這條規則寫在事件清單上（哪些事件「只留最新一則未讀」），由唯一的發送函式執行，不散落在各個排程裡。
- 清單頁本來就只顯示最新 100 筆；要不要定期清掉很舊的紀錄，上線後看資料量再提（風險 R11）。

### 第五輪回覆（2026-11-26）

| 題 | 決議 | 計畫怎麼落實 |
|---|---|---|
| V1 以哪一份設定為準 | 選 2：**整合成一份**。terry 原話：「要整合起來，不要亂，要以系統長期好用為主」 | 以勾選表為唯一來源；四個舊開關用 SQL 轉進去後停用（欄位先不刪）；學員端設定頁改用同一套；`pushToUser` 與兩個排程改讀新的一份；事件清單只定義一次。任務 4G～4M |
| V2 勿擾時段內的通知 | 選 1：不推播、只留站內紀錄；畫面上「延後到結束後發送」的文字改掉 | 任務 4I、4K |

**範圍變大後，站內通知 A 仍然可以先獨立出 PR，不被 B 卡住**（已逐項確認）：
- A 的 SQL（通知紀錄加 3 欄）與 B 的 SQL（轉換偏好）互不相依。
- A 完全不碰偏好：`pushToUser` 在 A 只是「多寫站內紀錄」，仍照舊讀四個舊開關；B 才換成讀整合後的設定。
- 事件清單的檔案 `src/lib/notification-events.ts` **在 A 就建立**（任務 4C，A 只用它來顯示通知名稱），B 再讓勾選表與發送處也用它。這樣「只定義一次」從第一天就成立，B 不用回頭改 A 的東西。
- 第 2 階段其餘功能（任務 5～35）與資料轉換只依賴 A。任務 31 新增的通知直接用事件清單裡的鍵，不論 B 合併了沒都能運作。
- 兩邊都改 `src/lib/push.ts`，所以順序是先 A 後 B；B 可以與第 2、3 段平行。

### 第四輪回覆（2026-11-26）

| 題 | 決議 | 計畫怎麼落實 |
|---|---|---|
| S1 那 1 筆已過上課時間的待確認舊預約 | 取消並退回堂數 | 資料轉換檔的第二段正式保留（任務 8） |
| 教練端推播偏好的「推播」欄與勿擾時段沒有接上發送 | 排進第 2 階段站內通知那組一起修 | 先重現再修；做法依第五輪回覆（V1、V2），任務 4G～4M |

**站內通知那組要不要拆成兩個 PR：建議拆。**

| PR | 任務 | 內容 |
|---|---|---|
| 站內通知 A | 4A～4F、4N | 通知紀錄加欄位、每則通知都留站內紀錄、學員端鈴鐺與清單、教練端通知頁與側欄未讀數字、學員送出購買申請時通知教練 |
| 站內通知 B | 4G～4M | 重現偏好無效、事件清單只定義一次、發送入口讀整合後的設定、轉換 SQL、兩端設定頁改用同一套（含拿掉「站內」欄）、測試 |

理由：
1. **風險種類不同。** A 只是「多留紀錄、多顯示」；B 會改變「這則通知到底推不推」，影響現有每一種通知。分開上線，出問題時一眼看得出是哪一邊。
2. **B 比 A 大，而且有一個要在部署前一刻執行的資料轉換**，還要先重現、還有一題待決（W1）；A 不需要等，資料轉換與第 2 階段其餘通知都只依賴 A。
3. 兩邊都會改 `src/lib/push.ts`，所以是**先 A 後 B**，不平行。原本放在 4E 的「拿掉站內欄」搬到 B 的任務 4K——同一個畫面只改一次。

**拿掉「站內」那一欄會動到什麼（P2）：**
- 畫面：只有教練端「推播偏好」頁（`/settings/notifications`）那張勾選表，從「事件／推播／站內」三欄變成「事件／推播」兩欄。學員端的推播偏好頁本來就沒有這一欄，不受影響。
- 程式：`src/components/settings/notification-matrix.tsx`（共用的勾選表元件，只有這一頁在用）、`src/app/(tenant)/settings/notifications/page.tsx`、`notification-prefs-form.tsx`、`actions.ts`，以及 `tests/unit/components/settings/notification-matrix.test.tsx`。
- 資料：設定存在 `notification_preferences.channels`（一個 JSON 欄位）裡的 `in_app` 這一組。**欄位不刪、舊資料不清**：儲存時不再寫入 `in_app`，已存在的值留著不讀。所以這件事沒有 SQL。

**查這一欄時另外發現的既有問題：** 教練端那張勾選表的「推播」欄與下方的「勿擾時段」，存得進去，但發通知的程式同樣沒有讀它們——實際決定發不發的是另一組四個舊開關（每週摘要、每日提醒、課前提醒、預約狀態變更），而教練端畫面上改不到那四個。也就是說教練在那一頁不管怎麼勾，目前都不影響推播。terry 已決定排進第 2 階段一起修，並整合成一份設定（第四、五輪回覆），做法見任務 4G～4M。

**站內通知排在哪裡、為什麼：排在團班修正之後、第 2 階段其餘功能之前。**
1. 第 2 階段會新增十幾種通知（請假、成班、臨時取消、代改期、關閉時段）。先把「每一則通知都留下站內紀錄」做進唯一的發送函式，後面每種通知只要寫一次文案，不用回頭補。
2. 它不依賴第 2 階段任何 SQL，只要加 3 個欄位，可以在 terry 審其他 SQL 的等待期間先做完、先上線。
3. 資料轉換要寫站內通知，欄位必須先存在。

### Q4 的現況查核（站內通知）

- **學員端沒有鈴鐺、沒有通知清單。** 只有 `src/app/(customer)/account/notifications/`，是推播偏好設定。
- **教練端有一頁「通知設定」**（`src/app/(tenant)/notifications/`），列出 `notification_log` 的紀錄並可標為已讀，但：
  - 紀錄只有類型、時間、狀態，**沒有標題與內文**；
  - `pushToUser` 在使用者關掉該類通知或沒有訂閱推播時會提前結束、**不寫紀錄**，所以沒開推播的人清單是空的；
  - 側欄沒有未讀數字。
- 教練端「通知設定」的推播偏好裡有一欄「站內」開關（`notification_preferences.channels.in_app`），**存得進去但沒有任何程式讀它**；實際決定發不發的是另一組舊的開關欄位。
- 結論：terry 說的「鈴鐺數字 +1」在學員端是全新的畫面元素。terry 已決定第 2 階段就做（N1 選 2）。教練端那頁一起補齊、「站內」開關拿掉（第三輪回覆）。

### 教練代改期的入口（Q9、N3）

terry 的要求是「要能指定幫誰改」。三個入口都做（N3 決議），版面仍以示意圖定案：

| 入口 | 位置 | 怎麼指定學員 |
|---|---|---|
| A | 教練端預約明細頁的「代改期」按鈕 | 這筆預約就是那位學員 |
| B | 預約管理清單每張卡片的「代改期」 | 同上 |
| C | 行事曆時段視窗：列出這個時段的學員名單，每位學員一列，各有「代改期」「明細」 | 團班一個時段有多位學員，在這裡挑一位 |

三個入口都導到同一個代改期畫面（`/bookings/[bookingId]/reschedule`）：顯示學員與原時段 → 選同一個服務的新時段（可以是其他成員的時段）→ 必填原因 → 送出。C 需要時段視窗從「只顯示一位學員名字」改成「列出名單」，這是現有畫面的結構變動，會在示意圖裡呈現。

---

## 任務總覽與平行分組

共 **50 個任務**（任務 0～35，加上站內通知的 4A～4N）。任務 1～4 已由 QR-D 做完。

```
第 0 段（主對話）          任務 0   出示意圖，取得 terry 同意
第 1 段（獨立 PR）          任務 1～4   團班時段可見性——QR-D 已實作（fix/group-slot-visibility，e2ccd34）
        ── terry 執行兩個 SQL 檔、PR 合併 ──
第 1.5 段 A（獨立 PR，序列） 任務 4A→4B→4C→（4D、4E、4N 可平行）→4F   站內通知：紀錄、鈴鐺、兩端通知頁、購買申請通知教練
        ── terry 審並執行 20261126120000、PR 合併 ──
第 1.5 段 B（獨立 PR，序列） 任務 4G→4H→4I→4J→（4K、4L 可平行）→4M   推播偏好整合（可與第 2、3 段平行）
        ── terry 審 20261126130000，B 的 PR 部署前一刻執行 ──
第 2 段（單一代理，序列）   任務 5→6→7→8（migration 檔定稿）→ 9（型別）→ 10（用語與錯誤對照）
        ── terry 審 SQL（可與第 3 段同時進行；執行後線 A 才能跑測試）──
第 3 段（四條線平行）
   線 A 資料庫整合測試     任務 11～17
   線 B 學員端             任務 18～22
   線 C 教練端             任務 23～30
   線 D 通知、排程、歷程    任務 31～33
第 4 段（單一代理，序列）   任務 34（e2e）→ 35（合併、全量驗證、對照表、文件回寫）
```

**檔案衝突面**——每個檔案只屬於一條線：

| 線 | 獨占的檔案 |
|---|---|
| 第 1 段（QR-D，已做） | `supabase/migrations/2026112611*_group_slot_visibility_*`、`src/app/api/public/**`、`src/lib/public-slots.ts`、`src/app/book/[slotId]/page.tsx`（可進入條件）、`tests/integration/group-slot-visibility.test.ts`、`tests/e2e/group-slot-visibility.spec.ts`、`tests/unit/public-slots-mapping.test.ts` |
| 第 1.5 段 | `supabase/migrations/20261126120000_*`、`src/lib/push.ts`、`src/lib/notifications.ts`（新）、`src/components/notifications/**`（新）、`src/app/(customer)/layout.tsx`、`src/app/(customer)/my-notifications/**`（新）、`src/app/(tenant)/notifications/**`、`src/app/(tenant)/sidebar-nav.tsx`、`src/app/(tenant)/mobile-sidebar.tsx`、對應測試 |
| 第 2 段 | `supabase/migrations/202611271*`、`src/lib/supabase/types.ts`、`src/lib/booking-terms.ts`、`src/lib/booking-rpc-errors.ts`、`src/lib/cancel-deadline.ts`、`src/lib/leave-request.ts`（新）、對應單元測試 |
| 線 A | `tests/integration/**`（除第 1 段那一檔）、`scripts/e2e-verify.mjs` |
| 線 B | `src/app/book/[slotId]/**`、`src/app/(customer)/my-bookings/**`、`src/app/[tenantSlug]/**`、`src/components/booking/**`、`src/components/bookings/leave-request-dialog.tsx`（新）、`src/components/bookings/leave-request-panel.tsx`（新，線 C 也使用，介面寫死在任務 20） |
| 線 C | `src/app/(tenant)/bookings/**`、`src/app/(tenant)/calendar/**`、`src/app/(tenant)/dashboard/**`、`src/app/(tenant)/customers/**`、`src/components/bookings/late-cancel-dialog.tsx`（新） |
| 線 D | `src/lib/notify-booking.ts`、`src/lib/notify-leave.ts`（新）、`src/app/api/cron/**`、`src/lib/activity-log.ts`、`src/components/bookings/booking-timeline.tsx`、`tests/unit/notify-*.test.ts` |

**跨線依賴：**
- 線 B 任務 20 的請假申請區塊 `leave-request-panel.tsx` 線 C 任務 25 也要用 → 任務 20 排在線 B 第一個，介面先寫死；任務 25 等它合併進整合分支。
- 線 B、線 C 的 Server Action 送出後要呼叫線 D 的通知函式 → 線 D 任務 31 先把函式簽章定好（空實作也可），再補文案。

**需要示意圖才能動的任務：** 4D、4E、4K、4L、19、20、21（僅到期提示）、24、25、26、27、28、29。其餘可立刻開始。

---

## 規則 × 入口對照表（P2）

每格寫「任務 → 驗證它的測試或實測項目」。「—」＝無關。「現況無入口」已在程式核對。

| 規則 | 公開頁選時段 | 預約確認頁 | 我的預約（卡片＋明細） | 改期流程 | 教練行事曆 | 教練預約管理（清單＋明細） | 教練儀表板 | 直接呼叫函式 |
|---|---|---|---|---|---|---|---|---|
| 團班有人預約後仍看得到、人數正確 | 任務 2 → T4-1～3、實測 H1 | 任務 3 → T4-4、H1 | — | 任務 2 | — | — | — | 任務 1 → T4-1～6 |
| 用堂數預約直接成立 | — | 任務 18、21 → T12-1、H2 | 任務 19 → H2 | 任務 18 → T13-7 | — | — | 任務 29（待確認區不再出現新預約）→ H2 | 任務 6 → T12-1 |
| 成班只判一次 | — | — | 任務 19（顯示）→ H3 | 任務 6 → T12-5 | 任務 28（顯示）→ H3 | 任務 24、25（顯示）→ H3 | — | 任務 6 → T12-2～6 |
| 未成班才自動取消 | — | — | 結果顯示 → H4 | — | — | — | — | 任務 6、32 → T17-1～5 |
| 過取消期限不可自己取消／改期 | — | 任務 21（政策文字）→ H5 | 任務 19：改顯示「請假申請」→ H6 | 任務 18：擋 → T13-2 | — | — | — | 任務 6 → T13-1～3 |
| 成班後不可掉到開班人數以下 | — | — | 任務 19：改顯示「請假申請」→ H7 | 任務 18：擋 → T13-5 | — | — | — | 任務 6 → T13-4～6 |
| 待確認不可改期 | — | — | 任務 19：不顯示改期 | 擋 → T13-8 | — | 代改期：擋 → T13-8 | — | 任務 6 → T13-8 |
| 開課後教練不可取消 | — | — | — | — | 任務 28：關閉時段不顯示 → H12 | 任務 24：不顯示按鈕 → H8 | 現況無入口 | 任務 6 → T13-9、T14-8 |
| 臨時取消：只限 Owner、只在取消期限後到開課前 | — | — | 結果顯示 → H9 | — | — | 任務 24、26 → H9 | 現況無入口 | 任務 6 → T14-1～4 |
| 臨時取消續佔名額、同學員不可再訂 | 任務 2（人數含佔用）→ T14-5 | 擋 → T14-6 | — | 擋 → T14-6 | 任務 28（人數含佔用）→ H9 | — | 任務 29（今日人數）| 任務 6 → T14-5～7 |
| 教練代改期：開課前任何時間、不受團班門檻、必填原因 | — | — | 結果顯示 → H10 | — | 任務 28（入口 C）→ H10 | 任務 24、27（入口 A、B）→ H10 | 現況無入口 | 任務 6 → T13-10～12 |
| 關閉時段＝逐筆教練取消 | — | — | 結果顯示 → H12 | — | 任務 28 → H12 | — | — | 任務 6 → T14-8～11 |
| 請假申請：送出條件、一筆審核中、被不同意後不可再送、撤回可再送 | — | — | 任務 19、20 → H6、H11 | — | — | — | — | 任務 7 → T15-1～8 |
| 請假申請：處理（三種）與權限 | — | — | 看結果 → H11 | — | — | 任務 24、25 → H11 | 任務 29（待辦）→ H11 | 任務 7 → T15-9～16 |
| 請假申請：開課自動不同意、失效、提醒 | — | — | 看結果 | — | — | 看結果 | — | 任務 7、32 → T15-17～21 |
| 上課時間不可晚於到期日 | 任務 21（提示）→ H13 | 任務 21（擋）→ T16-1、H13 | — | 擋 → T16-3 | — | 代改期、同意請假改期：擋 → T16-3、T15-12 | — | 任務 6 → T16-1～4 |
| 補堂 | — | — | — | — | — | — | — | 任務 6 → T16-5～8；顯示：任務 22、30 → H14 |
| 助教只能動自己的時段 | — | — | — | 代改期看舊時段 → T13-11 | 關閉時段 → T14-10 | 取消、代改期、處理請假 → T15-14、H15 | 現況無入口 | 任務 6、7 |
| 每個動作寫歷程 | — | ✓ T12-1 | ✓ | ✓ T13-7 | ✓ T14-9 | ✓ | — | 各任務的測試都驗歷程筆數與事件 |
| 預約狀態與用語一致 | 任務 21 | 任務 21 | 任務 19 | 任務 21 | 任務 28 | 任務 24、25 | 任務 29 | `forbidden-terms.test.ts`、任務 10 的用語表測試 |

---

# 第 0 段

### Task 0: 出示意圖並取得同意（主對話執行）

**Files:** 無（示意圖以 artifact 提供）

- [ ] **Step 1:** 依 `2026-11-26-booking-flow-v2-p2-mockup-screenshots.md` 取得現有實際畫面的截圖（需要 dev server 與 e2e 席位，由司令安排）。
- [ ] **Step 2:** 依截圖產生 M1～M12 的示意圖，不得憑想像。
- [ ] **Step 3:** 示意圖裡有兩處要請 terry 選版本：M3（請假申請選時段的兩種做法）、M11（時段視窗的學員名單）。目前沒有其他待決問題。
- [ ] **驗證：** 每張示意圖都有 terry 的明確同意紀錄，才放行需要示意圖的任務。

---

# 第 1 段 — 團班時段可見性（獨立 PR）——已由 QR-D 實作

> 分支 `fix/group-slot-visibility`，commit `e2ccd34`。以下是實際做出來的內容（以該分支為準），列在這裡是為了讓後面的任務知道可以依賴什麼。

### Task 1～4（已做）

| 任務 | 實際內容 |
|---|---|
| 1 SQL | `20261126110000_group_slot_visibility_functions.sql`：`slot_taken_count(p_slot_id) returns int`、`public_bookable_slots(p_tenant_id, p_service_id, p_from, p_to) returns table(id, start_at, end_at, max_capacity, taken)`，anon 與 authenticated 可呼叫。`20261126110100_group_slot_visibility_policy.sql`：`slots_select` 讓非成員讀得到 `available` 與 `pending` |
| 2 公開頁 | `src/app/api/public/slots/route.ts`、`slot-days/route.ts` 改用 `public_bookable_slots`；對應與分組抽到 `src/lib/public-slots.ts` |
| 3 確認頁 | `src/app/book/[slotId]/page.tsx` 可進入條件改為「可預約或有人預約，且未額滿」 |
| 4 測試 | `tests/integration/group-slot-visibility.test.ts`、`tests/unit/public-slots-mapping.test.ts`、`tests/e2e/group-slot-visibility.spec.ts` |

**與第 2 階段的銜接（QR-D 提醒，已確認計畫有這一步）：** `slot_taken_count` 已經把「學員臨時取消」算進名額，但現行的預約函式只數未取消的預約。這個 PR 上線到第 2 階段函式上線之間，兩邊的差異沒有實際影響（這段期間不會有「學員臨時取消」的資料）。第 2 階段的任務 6 把預約、改期、確認三支函式與時段狀態重算全部改用 `slot_taken_count`，兩邊就對齊了；任務 14 案例 5～7 驗證。

---

# 第 1.5 段 — 站內通知（獨立 PR）

> 不依賴第 2 階段的其他 SQL。分支建議從 master 另開 `feat/in-app-notifications`，合併後本分支 `merge origin/master`。
> 做法：通知紀錄表加 3 個欄位（標題、內文、連結），並讓唯一的發送函式 `pushToUser` **不論有沒有推播出去都寫一筆紀錄**。現有 18 個呼叫處都已經帶標題、內文、連結，所以不用逐一改。

### Task 4A: Migration — 通知紀錄加標題、內文、連結

**Files:** `docs/superpowers/plans/sql-drafts/20261126120000_in_app_notifications.sql`（草稿；實作時搬回 `supabase/migrations/` 並改檔名時間）

**Interfaces:** `notification_log.title | body | url`（皆可空；`url` 限站內路徑）。`read_at` 與未讀索引是既有的。

- [ ] **Step 1:** 靜態檢查可重複執行。
- [ ] **Step 2:** 回報附驗證與回滾 SQL，交 terry 審閱並執行。**不得自己執行。**

### Task 4B: 發送函式一律留下站內紀錄

**Files:**
- Create: `src/lib/notification-events.ts`
- Modify: `src/lib/push.ts`、`src/lib/supabase/types.ts`
- Test: `tests/unit/push-in-app.test.ts`（新）、`tests/unit/notification-events.test.ts`（新）

現況三個會「什麼都不留」的路徑，全部改成仍然寫一筆站內紀錄：

| 情況 | 現況 | 改成 |
|---|---|---|
| 推播金鑰沒設定 | 直接丟錯，什麼都沒寫 | 不推播，寫站內紀錄，狀態記為略過 |
| 使用者關掉這一類推播 | 提前結束，不寫紀錄 | 不推播，寫站內紀錄（開關只管推播，站內一律留） |
| 使用者沒有訂閱任何裝置 | 提前結束，不寫紀錄 | 寫站內紀錄 |

- [ ] **Step 0:** 建立 `src/lib/notification-events.ts`（事件清單，唯一定義處；內容見「第 1.5 段 B」的表，含每個事件「是不是只留最新一則未讀」）。站內通知 A 用它做兩件事：顯示通知名稱、決定哪些提醒要把舊的未讀標為已讀。
- [ ] **Step 0b:** 寫入一則「只留最新一則未讀」的提醒（每日提醒、每週摘要）之前，先把同一位使用者、同一類型、尚未讀的舊紀錄標為已讀。
- [ ] **Step 1:** `pushToUser` 簽章不變。內部改成：去重檢查（不變）→ 判斷可否推播 → 能推就推 → **一定**寫一筆 `notification_log`，帶 `title`、`body`、`url`（取自 `payload`；`url` 不是以 `/` 開頭時存空值並 `console.error`）。
- [ ] **Step 2:** 新增 `recordInAppNotification(supabase, { userId, type, title, body, url, relatedId })`：只寫站內、不推播（`channel: 'in_app'`）。給「不想打擾但要留紀錄」的情況用。
- [ ] **Step 3:** 寫紀錄失敗要 `console.error`，但不往外丟（通知失敗不可影響已成立的預約動作——沿用現有原則）。
- [ ] **Step 4:** `types.ts` 加 3 個欄位。
- [ ] **測試：** 用假的資料庫 client：三種情況都會寫入且帶標題內文；寫入每日提醒時，同類型舊的未讀被標為已讀、其他類型與別人的不受影響；課前提醒與事件類不會動到舊紀錄；去重命中時不寫；連結不合法時存空值；推播成功／失敗的狀態值不變。
- [ ] **驗證：** `npm test -- push`、`npm run typecheck`。

### Task 4C: 共用的讀取與元件

**Files:**
- Create: `src/lib/notifications.ts`（server only）、`src/components/notifications/notification-list.tsx`、`notification-bell.tsx`、`notification-popover.tsx`、`actions.ts`、`src/components/ui/popover.tsx`
- Move: `src/app/(tenant)/notifications/actions.ts`、`notification-item.tsx`、`mark-all-read-button.tsx` 的內容搬到 `src/components/notifications/`（兩端共用；先列出所有使用處再搬）

**Interfaces（4D、4E 依賴，先寫死）:**

```ts
// src/lib/notifications.ts
export type InboxItem = {
  id: string
  type: string
  title: string | null   // 舊紀錄為 null → 畫面改顯示通知類型的中文名稱
  body: string | null
  url: string | null
  sentAt: string
  readAt: string | null
}
/** 最新 100 筆。查詢失敗丟 AppError，不回空陣列冒充「沒有通知」。 */
export async function listInbox(supabase, userId: string): Promise<InboxItem[]>
/** 未讀數。查詢失敗回 null（鈴鐺顯示成沒有數字，不顯示 0）。 */
export async function countUnread(supabase, userId: string): Promise<number | null>

// src/components/notifications/notification-bell.tsx
export function NotificationBell(props: { href: string; unread: number | null }): JSX.Element
// 0 或 null 不顯示數字；超過 99 顯示「99+」；aria-label「通知，N 則未讀」
// 〔11/27 決議 1-B〕鈴鐺是按鈕（client component），點了開小視窗；href 是小視窗裡「看全部通知」的去處

// src/components/notifications/notification-popover.tsx 〔11/27 決議 1-B〕
export function NotificationPopover(props: { href: string; unread: number | null }): JSX.Element
// 打開時才呼叫 listRecentAction() 讀最近 5 則；讀取中、沒有通知、讀取失敗三種狀態都要有畫面
// 打開不標為已讀；點一則＝標為已讀並前往 url；最下方「看全部通知」連到 href

// src/components/notifications/actions.ts
export async function listRecentAction(): Promise<{ ok: true; items: InboxItem[] } | { ok: false }>   // 最新 5 筆，只讀自己的

// src/components/notifications/notification-list.tsx
export function NotificationList(props: { items: InboxItem[] }): JSX.Element   // 名稱一律用 notificationLabel(type)
// 點一則：標為已讀並前往 url（沒有 url 的舊紀錄只標為已讀）
```

- [ ] **Step 1:** 用任務 4B 建立的事件清單提供 `notificationLabel(type)`：改版前的舊類型（`booking_status` 等）也查得到名稱；查不到的類型顯示「通知」，**不得顯示類型代碼**（現況會直接顯示代碼，順手修）。教練端通知頁原本自己寫的名稱表改用它。
- [ ] **Step 2（11/27 決議 1-B）：** 浮動小視窗的基礎元件。`src/components/ui/` 目前沒有（只有 `dialog.tsx`、`sheet.tsx`）。先看 `dialog.tsx` 用的是哪一套基礎元件庫，用同一套的 Popover 照同樣寫法包成 `ui/popover.tsx` 並登錄到共用元件目錄；那一套沒有 Popover 時停下回報，不自己另裝套件。
- [ ] **Step 3（11/27 決議 1-B）：** `NotificationPopover`：寬度上限約 320px，手機寬度時不超出畫面（左右各留 16px）；Esc 與點外面可關閉；關閉後焦點回到鈴鐺。每一列用 `NotificationList` 的同一個列元件（不另寫一份）。
- [ ] **測試：** `tests/unit/components/notifications/notification-bell.test.tsx`（0、null、5、120）、`notification-list.test.tsx`（未讀樣式、舊紀錄的顯示、沒有連結的處理、空清單）、`notification-popover.test.tsx`（打開才讀取、最多 5 則、沒有通知、讀取失敗顯示錯誤而不是「沒有通知」、打開不會標為已讀）。

### Task 4D: 學員端——鈴鐺與通知清單（需示意圖 M13、M14）

**Files:**
- Modify: `src/app/(customer)/layout.tsx`
- Create: `src/app/(customer)/my-notifications/page.tsx`、`loading.tsx`

- [ ] **Step 1:** 頁首（登出按鈕左邊）加鈴鐺，帶未讀數字。**點鈴鐺先跳出小視窗（最近 5 則），小視窗最下方「看全部通知」連到 `/my-notifications`**（terry 11/27 選 1-B）。未讀數查不到時鈴鐺照樣顯示、不顯示數字。
- [ ] **Step 2:** `/my-notifications`：清單（新到舊，最新 100 筆）、「全部標為已讀」、連到「推播偏好」（`/account/notifications`）。空狀態：「目前沒有通知」。讀取失敗顯示「目前無法取得通知，請稍後再試」。
- [ ] **Step 3:** 網址不能用 `/notifications`（教練端已經用了同一個路徑）。
- [ ] **Step 4:** 標為已讀後要讓頁首數字跟著變：action 內 `revalidatePath('/', 'layout')`。
- [ ] **範圍說明：** 鈴鐺只放在學員登入後的頁面（我的預約、預約明細、帳號設定）。教練的公開頁、預約確認頁用的是另一套頁首，這次不加（示意圖時若 terry 要加再擴充）。

### Task 4E: 教練端——通知頁補齊（需示意圖 M15）

**Files:** `src/app/(tenant)/notifications/page.tsx`、`src/app/(tenant)/sidebar-nav.tsx`、`mobile-sidebar.tsx`、`src/app/(tenant)/layout.tsx`

- [ ] **Step 1:** 清單改用 `NotificationList`：顯示標題與內文、可點進對應頁面。
- [ ] **Step 2:** 側欄的「通知設定」改名「通知」並帶未讀數字（桌機側欄與手機抽屜都要）。沒有未讀時不顯示數字（terry 11/27 選 3-A）。
- [ ] **Step 2a（terry 11/27 選 4-A）：** 手機頂列的選單按鈕右上角加小紅點，有未讀才出現；未讀數查不到時不顯示。按鈕的 aria-label 要帶出「有未讀通知」。
- [ ] **Step 3:** 既有的分頁（全部／預約／購課／系統）保留。
- 推播偏好那個畫面（拿掉「站內」欄、把勾選表與勿擾時段接上發送）在任務 4G～4J，屬於另一個 PR。

### Task 4N: 學員送出購買申請時通知教練（terry 2026-11-26 決定補上）

**現況：** 學員送出購買申請（`src/app/[tenantSlug]/packages/purchase-request-action.ts`）只寫入資料，**沒有發任何通知**；教練要自己進「購買申請」頁才看得到。教練端推播偏好的勾選表卻一直有「購買申請」這一列。

**通知誰（依據寫清楚）：** 這個租戶所有**啟用中的成員**（Owner 與助教）。
- 依據是現有權限：核准／拒絕的 action（`src/app/(tenant)/packages/pending/purchase-actions.ts`）與頁面都只要求「是租戶成員」（`requireTenantMember`），資料表的修改規則 `customer_purchases_update_member` 也是「租戶成員都可以改」。所以目前 Owner 與助教都能核准，都通知。
- 設計文件 §12 的最終規則是「核准購買申請只有 Owner」，terry 已決定在第 3 階段連同單堂付款一起收緊（第 1 階段決議 R9）。**屆時通知對象要跟著縮成只有 Owner**——所以「誰可以審購買申請」寫成一支函式 `purchaseReviewerUserIds(tenantId)`，第 3 階段只改這一處。

**Files:**
- Modify: `src/app/[tenantSlug]/packages/purchase-request-action.ts`、`src/lib/notify-booking.ts`
- Test: `tests/unit/notify-booking-copy.test.ts`（補）

- [ ] **Step 1:** `notifyPurchaseRequested(purchaseId)`：事件 `package_request`；標題「新的購買申請」；內文「{學員} 申請購買 {商品名稱}（{N} 堂課）。付款申報：{我已轉帳／已部分付款／尚未付款}」；連結 `/packages/pending`。文案由純函式產生。
- [ ] **Step 2:** 送出購買申請成功後呼叫（`void`，失敗只記錄、不影響申請本身）。新增失敗時不發。
- [ ] **Step 3:** `purchaseReviewerUserIds` 查詢失敗時記錄錯誤、不發通知，不以空名單當作「沒有人要通知」而靜默略過——log 要看得出是查詢失敗。
- [ ] **測試：** 文案含學員、商品、堂數、付款申報三種說法；不含禁用詞；通知對象包含 Owner 與助教、不含已移除的成員與學員本人。e2e 補一例（任務 4F）：學員送出購買申請 → 教練端鈴鐺數字 +1，點進去到購買申請頁。

### Task 4F: 測試

**Files:** `tests/integration/in-app-notifications.test.ts`（新）、`tests/e2e/in-app-notifications.spec.ts`（新）

整合（`setupBfv2('inapp', ['customer', 'otherCustomer', 'owner'])`）：
1. 後端寫入一筆給學員 → 學員讀得到標題、內文、連結；另一位學員讀不到；Owner 讀不到。
2. 學員把自己的那筆標為已讀 → 成功；標別人的 → 改不到。
3. 學員、Owner 直接新增通知 → 被擋。
4. 連結不是站內路徑 → 寫入被資料庫擋下。
5. 未讀數只算自己的未讀。

e2e（需席位）：
1. 教練取消學員的預約 → 學員頁首鈴鐺出現數字 → 點鈴鐺跳出小視窗、看得到「預約已取消」（此時數字不變）→ 點「看全部通知」進清單看到原因 → 點那一則到預約明細頁 → 回來數字歸零。
2. 學員**沒有**允許推播時，上面的流程一樣成立（這是這組任務的重點）。
3. 「全部標為已讀」。
4. 教練端手機寬度：有未讀時選單按鈕有小紅點；打開選單「通知」旁有數字；全部標為已讀後兩者都消失。

- [ ] **PR 範圍（站內通知 A）：** 任務 4A～4F 與 4N 的檔案。PR 說明寫明 migration 是否已執行。

---

# 第 1.5 段 B — 推播偏好整合（獨立 PR，接在站內通知 A 之後）

> terry 2026-11-26 決定：**整合成一份設定，以系統長期好用為主。** 設計用三條判準檢查：
> **一個設定來源、一個發送入口、事件種類的清單只定義一次。**
> 任務 4G 可以馬上做；4K、4L 要示意圖。沒有待決問題。

## 設計

**1. 一個設定來源**

| 設定 | 整合後存在哪裡 | 說明 |
|---|---|---|
| 每個事件要不要推播 | `notification_preferences.channels` 的 `web_push` 一組（事件 → 開／關） | **唯一來源**。學員端、教練端兩個畫面都改這一份 |
| 勿擾時段 | 同一列的 `quiet_hours_start`／`quiet_hours_end` | 沿用。學員端以前沒有這個設定，整合後也有 |
| 每日提醒的時間、課前提醒幾分鐘前 | 同一列的 `daily_reminder_hour`／`pre_event_minutes` | 這兩個是「參數」不是開關，沿用原欄位。教練端以前改不到，整合後也改得到 |
| 四個舊開關 `*_enabled` | 停用 | 值用 SQL 轉進勾選表（任務 4J）。**欄位先不刪**，新版程式不再讀寫；確定不需要退版後可另外清掉 |
| `channels` 裡的 `in_app` 一組 | 停用 | 從來沒有作用。留著不讀；畫面上的「站內」欄拿掉 |

**2. 一個發送入口**

所有通知都經過 `pushToUser`（任務 4B 之後它同時負責留站內紀錄）。要不要推播到裝置，只在這裡用一個純函式 `decidePush` 判斷；排程與各個通知函式不再自己看開關。

**3. 事件種類只定義一次**

新檔 `src/lib/notification-events.ts`（任務 4C 建立、這一段擴充）是唯一的事件清單。勾選表畫了哪些列、發送處能用哪些事件、站內通知清單顯示什麼名稱，全部從這一份來；加一種新通知只要在這裡加一筆。

| 事件 | 畫面名稱 | 誰會收到 | 可以關嗎 | 取代的舊類型 |
|---|---|---|---|---|
| `booking_created` | 新預約 | 教練 | 可 | `booking_status` |
| `booking_confirmed` | 預約已確認／已成班 | 學員、教練 | 可 | `booking_status` |
| `booking_cancelled` | 預約取消 | 學員、教練 | 可 | `booking_status` |
| `booking_rescheduled` | 預約改期 | 學員、教練 | 可 | `booking_status` |
| `leave_request` | 請假申請 | 學員、教練 | 可 | （新） |
| `package_request` | 購買申請 | 教練 | 可 | （新，任務 4N） |
| `package_approved` | 購買申請結果 | 學員 | 可 | `booking_status` |
| `pre_event` | 課前提醒 | 學員（現況只發給學員） | 可 | 同名 |
| `daily_reminder` | 每日提醒（只留最新一則未讀） | 學員、教練 | 可 | 同名 |
| `weekly_summary` | 每週摘要（只留最新一則未讀） | 學員、教練 | 可 | 同名 |
| `checkin_reminder` | 簽到提醒 | 學員 | 不可（維持現況：一律發） | 同名 |
| `checkin_missing` | 尚未簽到 | 學員、教練 | 不可 | 同名 |
| `checkin_done` | 學員已簽到 | 教練 | 不可 | 同名 |

- 通知紀錄的「類型」欄之後直接存事件的鍵（例如 `booking_cancelled`），不再把所有預約通知都記成同一個 `booking_status`。舊紀錄的 `booking_status` 保留，清單上顯示為「預約通知」。教練端通知頁用「開頭是 `booking_`」分頁的寫法不受影響。
- 每個畫面只列「這個身分會收到」的事件：學員端不會出現「新預約」。
- 現有勾選表裡的「購買申請」原本**沒有對應的通知**（程式裡沒有發這一則）。terry 決定補上：任務 4N 新增這則通知，勾選表保留這一列。

**推播的判斷規則（`decidePush`）**——依序：
1. 這個事件不可關（簽到三種）→ 只看勿擾時段。
2. 勾選表裡這個事件是關的 → 不推播。沒有這個事件的鍵、或使用者從沒存過設定 → 視為開。
3. 現在（台北時間）在勿擾時段內 → 不推播（V2 決議）。開始含、結束不含；結束早於開始表示跨午夜；只設一邊視為沒設。
4. 其餘 → 推播。

**站內紀錄留不留：**
- 「發生了一件事」的通知（預約、取消、改期、請假、購買、簽到）：**一律留**，不管推播開關與勿擾時段（P2 決議）。
- 「定時提醒」（課前提醒、每日提醒、每週摘要）：**也一律留**，與事件類一致（terry 第六輪決議）。關掉推播＝不推播到裝置，站內照樣有。為了不讓關掉推播的人在站內無限累積，每日提醒與每週摘要採「只留最新一則未讀」（見「terry 的決議」第六輪的設計決定）。
- 現況有一個限制維持不變：從來沒有存過推播設定的使用者，排程不會為他產生課前提醒與每日提醒（排程是從設定表找人的）。這次不擴大對象，避免上線當下突然多出一批沒人設定過的提醒；要改成「沒設定過也用預設值提醒」另外提。

## 任務

### Task 4G: 重現「教練端推播偏好怎麼勾都沒有作用」（先紅）

> 這個結論目前只來自讀程式，還沒有實際重現。**先重現，再修。** 重現不出來就停下回報，不要照著修。

**現況的讀寫路徑（讀程式得到）：**

| 項目 | 存在哪裡 | 誰寫 | 誰讀 |
|---|---|---|---|
| 教練端勾選表（事件 × 推播／站內） | `notification_preferences.channels`（JSON：`web_push`、`in_app` 各一組 9 個事件） | 教練端推播偏好頁 `saveNotificationPrefsAction` | 只有那一頁自己讀回來顯示；發通知的程式沒有讀 |
| 勿擾時段 | 同一列的 `quiet_hours_start`／`quiet_hours_end` | 同上 | 同上；也沒有任何「延後發送」的機制（畫面上寫的是會延後） |
| 四個舊開關（每週摘要、每日提醒、課前提醒、預約狀態變更）與兩個參數 | 同一列的 `weekly_summary_enabled`、`daily_reminder_enabled`、`pre_event_enabled`、`booking_status_changes_enabled`、`daily_reminder_hour`、`pre_event_minutes` | 學員端推播偏好頁 `updateNotificationPreferencesAction` | `pushToUser`（`src/lib/push.ts`，依通知類型對四個開關）；`api/cron/daily-reminder`、`api/cron/pre-event-reminder` 兩個排程 |

兩個畫面寫的是同一張表、同一列，只是各寫各的欄位，而且都改不到對方那一份。

**Files:** `tests/unit/push-prefs-repro.test.ts`（新；修好後併入 4M 的測試檔）

- [ ] **Step 1:** 用假的資料庫 client 與假的推播套件寫 3 個「期望的正確行為」：① 勾選表把「預約取消」的推播關掉、使用者有訂閱裝置 → 取消通知不應該推播；② 勿擾時段涵蓋現在 → 不應該推播；③ 對照組：把舊開關「預約狀態變更」關掉 → 不推播（現在應該是綠的，證明測試本身沒寫錯）。
- [ ] **Step 2:** 跑 `npm test -- push-prefs-repro`，把實際結果原文貼進回報。①② 紅、③ 綠＝重現成立，才進任務 4H。
- [ ] **Step 3（實機佐證，需席位，可與截圖 T13 同一次做）:** 教練帳號允許推播 → 勾選表關掉「預約取消」→ 學員取消一筆預約 → 教練仍收到推播。結果記在回報。

### Task 4H: 事件清單只定義一次

**Files:**
- Modify: `src/lib/notification-events.ts`（任務 4C 建立）、`src/lib/push.ts`（`NotificationDispatch`）、`src/lib/notify-booking.ts`、`src/lib/notify-checkin.ts`、`src/lib/notify-leave.ts`、`src/app/api/cron/daily-reminder/route.ts`、`pre-event-reminder/route.ts`、`weekly-summary/route.ts`、`src/app/(tenant)/notifications/page.tsx`
- Test: `tests/unit/notification-events.test.ts`（新）

**Interfaces:**

```ts
// src/lib/notification-events.ts
export const NOTIFICATION_EVENTS = [
  { key: 'booking_created', label: '新預約', audience: ['tenant'], configurable: true, kind: 'event' },
  // … 上表 12 筆
] as const
export type NotificationEventKey = (typeof NOTIFICATION_EVENTS)[number]['key']
/** 勾選表要畫的列：這個身分會收到、而且可以關的事件 */
export function configurableEventsFor(audience: 'customer' | 'tenant'): { key: NotificationEventKey; label: string }[]
/** 站內清單顯示的名稱；改版前的舊類型（booking_status 等）也查得到；查不到回「通知」，不回代碼 */
export function notificationLabel(type: string): string
```

- [ ] **Step 1:** `NotificationDispatch.type` 的型別由 `string` 改為 `NotificationEventKey`，讓編譯器擋住清單以外的類型。
- [ ] **Step 2:** 全庫搜尋 `pushToUser(` 與 `recordInAppNotification(`，把每個呼叫處的類型改成對應的事件（目前 18 處；對應關係貼進回報）：新預約 → `booking_created`；確認、成班 → `booking_confirmed`；各種取消（教練取消、拒絕、人數不足、學員臨時取消、關閉時段）→ `booking_cancelled`；改期、代改期 → `booking_rescheduled`；購買核准／拒絕 → `package_approved`；請假申請相關 → `leave_request`；其餘同名。
- [ ] **Step 3:** 教練端通知頁原本自己寫的類型名稱表與分頁判斷，改用 `notificationLabel`；分頁「購課」的判斷改為 `package_` 開頭（舊紀錄的 `purchase_` 開頭仍要認得）。
- [ ] **測試：** 清單的鍵不重複；每筆都有名稱；`configurableEventsFor('customer')` 不含「新預約」；舊類型 `booking_status` 查得到名稱；亂給一個字串回「通知」。

### Task 4I: 發送入口讀整合後的設定

**Files:**
- Create: `src/lib/push-prefs.ts`
- Modify: `src/lib/push.ts`、`src/app/api/cron/daily-reminder/route.ts`、`pre-event-reminder/route.ts`

**Interfaces:**

```ts
// src/lib/push-prefs.ts — 純函式，不碰資料庫
export type PushPrefs = {
  webPush: Partial<Record<NotificationEventKey, boolean>>
  quietStart: string | null   // 'HH:MM'
  quietEnd: string | null
}
export type PushDecision = { push: true } | { push: false; why: 'event_off' | 'quiet_hours' }
/** prefs 為 null（使用者沒存過設定）＝全部開、沒有勿擾時段 */
export function decidePush(prefs: PushPrefs | null, event: NotificationEventKey, now: Date): PushDecision
export function inQuietHours(start: string | null, end: string | null, now: Date): boolean
/** 把資料庫的一列轉成 PushPrefs；channels 形狀不對時當作全開並記錄 */
export function toPushPrefs(row: { channels: unknown; quiet_hours_start: string | null; quiet_hours_end: string | null } | null): PushPrefs | null
```

- [ ] **Step 1:** `pushToUser` 改成只讀 `channels, quiet_hours_start, quiet_hours_end`，用 `decidePush` 決定；**移除對四個舊開關的讀取**。不推播時站內紀錄照寫（提醒類被關掉的例外見 Step 3）。讀設定失敗時照常推播並記錄錯誤（不因為讀設定失敗讓通知消失）。
- [ ] **Step 2:** 時區一律台北時間，沿用 `src/lib/taipei-time.ts`，不自己加 8 小時。
- [ ] **Step 3:** 兩個排程不再用 `daily_reminder_enabled`／`pre_event_enabled` 篩人：有設定紀錄的人一律產生提醒（每日提醒依他設定的時間、課前提醒依他設定的分鐘數），要不要推播交給 `pushToUser` 裡的 `decidePush`；站內一律留。排程裡**不再自己判斷開關**。
- [ ] **Step 4:** 全庫搜尋四個舊欄位名稱，確認修改後**沒有任何程式再讀或寫它們**（型別檔除外），清單貼進回報。

### Task 4J: Migration — 把四個舊開關轉進勾選表

**Files:** `docs/superpowers/plans/sql-drafts/20261126130000_notification_prefs_unify.sql`（草稿；實作時搬回 `supabase/migrations/` 並改檔名時間）

- [ ] **Step 1:** 衝突規則已定：「關的優先」（W1 決議），草稿照此。確認事件清單的每個「可以關」的鍵都出現在 SQL 的對應表裡（含 `package_request`、`leave_request`）。
- [ ] **Step 2:** 回報附轉換前預覽 A、B 與轉換後驗證查詢。**不得自己執行。**
- **執行時機：** 站內通知 B 的 PR 合併部署**前一刻**。舊版程式只讀舊開關（這個檔不動它們），所以先跑不影響線上；但跑完到部署之間，學員在舊畫面改的設定不會被帶到新的一份，所以要緊接著部署。

### Task 4K: 共用的推播偏好表單＋教練端設定頁（需示意圖 M16）

**Files:**
- Create: `src/components/settings/notification-settings-form.tsx`、`src/components/settings/actions.ts`
- Modify: `src/components/settings/notification-matrix.tsx`、`quiet-hours-input.tsx`、`src/app/(tenant)/settings/notifications/page.tsx`、`notification-prefs-form.tsx`、`actions.ts`
- Test: `tests/unit/components/settings/notification-settings-form.test.tsx`（新）、`notification-matrix.test.tsx`、`quiet-hours-input.test.tsx`

- [ ] **Step 1:** 共用表單 `NotificationSettingsForm({ audience, initial })`：事件開關（列來自 `configurableEventsFor(audience)`，只有「推播」一欄）、每日提醒時間、課前提醒幾分鐘前、勿擾時段。兩端共用同一個元件與同一支儲存 action。
- [ ] **Step 2:** 儲存 action `saveNotificationSettingsAction`：zod 只接受事件清單裡的鍵；寫 `channels.web_push`（與資料庫現有值合併，不覆蓋掉這個畫面沒列出的事件）、勿擾時段、兩個參數。**不寫四個舊開關、不寫 `in_app`。**
- [ ] **Step 3:** 教練端設定頁改用共用表單；「此裝置訂閱」「所有裝置」「課前簽到提醒（Owner）」三區不動。
- [ ] **Step 4:** 文字改成與實際行為一致：頁首「選擇哪些事件要推播到裝置，並設定勿擾時段。事件類的通知都會留在站內的通知清單。」；勿擾時段「勿擾時段內不推播，通知仍會出現在站內的通知清單。」。原本的「延後到結束時段後發送」拿掉。
- [ ] **Step 5:** 動手前全庫搜尋 `in_app`、`NotificationChannel`、`NotificationMatrix`、`saveNotificationPrefsAction` 的使用處並列在回報裡。

### Task 4L: 學員端設定頁改用同一套（需示意圖 M17）

**Files:** `src/components/settings/notification-preferences.tsx`、`src/app/(customer)/account/notifications/page.tsx`、`preferences-form.tsx`（刪除，改用共用表單）、`actions.ts`（刪除，改用共用 action）

- [ ] **Step 1:** 學員端設定頁改用 `NotificationSettingsForm audience="customer"`。學員原本的一個「預約狀態變更」開關，變成依事件分開的開關（預約已確認、預約取消、預約改期、請假申請、購買申請結果）；新增勿擾時段。
- [ ] **Step 2:** 刪除舊表單與舊 action 前，全庫搜尋使用處確認沒有別的地方引用。
- [ ] **Step 3:** 從通知清單頁（任務 4D）連過來的入口不變。

### Task 4M: 測試與實機

**Files:** `tests/unit/push-prefs.test.ts`（新，併入 4G）、`tests/unit/push-in-app.test.ts`（補）、`tests/integration/notification-prefs.test.ts`（新）、`tests/e2e/in-app-notifications.spec.ts`（補）

1. `decidePush`／`isEventOn`：事件關 → 不推播；開 → 推播；沒有設定列 → 推播；沒有這個鍵 → 推播；不可關的事件即使被寫成關也照推；勿擾時段內 → 不推播。
2. `inQuietHours`：同日區間、跨午夜、剛好等於開始（算在內）、剛好等於結束（不算）、只設一邊（視為沒設）、台北時間換日前後。
3. `pushToUser`：不推播時仍寫站內紀錄；4G 的重現案例——①② 轉綠；③ 改寫成「舊開關關掉、勾選表開著 → 照推」（證明舊開關已停用）。
4. 排程：每日提醒關掉的人 → 站內有、不推播；開著但在勿擾時段 → 站內有、不推播；連續兩天的每日提醒 → 第一天那則被標為已讀，未讀數仍是 1。
5. 整合（`setupBfv2('prefs', ['customer', 'owner'])`）：自己存得進去、讀得回來；讀不到別人的設定；學員端與教練端存的是同一列同一組（學員端關掉「預約取消」，用教練端的讀法讀到同一個值）。
6. e2e（需席位）：學員在設定頁關掉「預約取消」→ 教練取消他的預約 → 鈴鐺有數字、清單有這一則（推播是否送達無法在自動測試驗證，列實機 H20）。
7. 轉換 SQL 不寫自動化測試（只跑一次）；以檔案內的預覽與驗證查詢為準，由 terry 執行。

- [ ] **PR 範圍（站內通知 B）：** 任務 4G～4M 的檔案。PR 說明寫明 `20261126130000` 是否已執行。
- [ ] **文件回寫：** `docs/usage-guide.md` 與 `docs/user-guides/**` 裡推播設定的說明。

---

# 第 2 段（序列）

> 任務 5～8 的 SQL 草稿已寫在本分支 `supabase/migrations/`。任務內容是「依 terry 審閱意見與待決問題的回覆定稿」，**不得執行**。

### Task 5: Migration 1 — 資料表

**Files:** `docs/superpowers/plans/sql-drafts/20261127100000_bfv2_p2_tables.sql`（草稿；實作時搬回 `supabase/migrations/` 並改檔名時間）

**Interfaces:** `availability_slots.formed_at`；`customer_purchases.source_booking_id`；表 `leave_requests(id, tenant_id, booking_id, customer_id, reason, requested_slot_id, status, handled_by, handled_at, handle_note, handled_by_system, created_at)`，唯一索引 `leave_requests_one_pending`。

- [ ] **Step 1:** 靜態檢查可重複執行。
- [ ] **Step 2:** 回報附檔案最上方的驗證與回滾 SQL。

### Task 6: Migration 2 — 預約、取消、改期、成班的函式

**Files:** `docs/superpowers/plans/sql-drafts/20261127100100_bfv2_p2_booking_functions.sql`（草稿；實作時搬回 `supabase/migrations/` 並改檔名時間）

**Interfaces（後續任務依賴這些名稱）:**

| 函式 | 簽章 | 誰可以呼叫 | 變更 |
|---|---|---|---|
| `book_with_purchase` | `(p_slot_id, p_customer_id, p_customer_notes default null, p_purchase_id default null) returns table(booking_id uuid, booking_status text, slot_formed boolean)` | authenticated（只能替自己）、service_role | **回傳欄位變更**（原 `auto_confirmed` 移除） |
| `confirm_booking` | `(p_booking_id) returns bookings` | authenticated | 只改時段狀態算法 |
| `cancel_booking` | `(p_booking_id, p_reason default null) returns bookings` | authenticated | 簽章不變，規則變更 |
| `late_cancel_booking` | `(p_booking_id, p_reason) returns bookings` | authenticated（函式內限 Owner） | **新增** |
| `reschedule_booking` | `(p_old_booking_id, p_new_slot_id, p_reason default null) returns bookings` | authenticated | 簽章不變，規則變更 |
| `close_slot` | `(p_slot_id, p_reason default null) returns table(cancelled_booking_id uuid, cancelled_customer_id uuid)` | authenticated（Owner／該時段助教） | **新增** |
| `checkin_booking` | 不變 | 不變 | 簽到時讓審核中的請假申請失效 |
| `auto_cancel_group_slot` | 不變 | service_role | 成過班就不取消 |
| `auto_cancel_unformed_slots` | `() returns table(slot_id, affected_customer_id, affected_member_user_id, service_name, slot_start_at)` | service_role | **新增**，排程改呼叫它 |

畫面查詢用：`slot_formation_info(p_slot_id) returns table(active_count, min_attendance, formed_at)` — authenticated（只回給與該時段有關的人）。

輔助（登入者不可直接呼叫）：`slot_active_count`、`refresh_slot_status`、`mark_slot_formed`、`platform_setting_int`、`refund_class`、`void_pending_leave`、`reschedule_booking_core`。

**新增錯誤代碼與畫面訊息（任務 10 寫進對照表）：**

| 代碼 | 畫面訊息 |
|---|---|
| `PAST_CANCEL_DEADLINE` | 已過取消期限，無法自己取消或改期。請改送請假申請，由教練決定 |
| `GROUP_MIN_LOCKED` | 這堂課目前剛好達到開班人數，取消或改期需要教練同意。請改送請假申請 |
| `PENDING_CANNOT_RESCHEDULE` | 尚未確認的預約不能改期，請先取消再重新預約 |
| `PURCHASE_EXPIRES_BEFORE_CLASS` | 這堂課的上課時間晚於堂數的到期日，請選到期日之前的時段 |
| `ALREADY_BOOKED` | 你已經預約過這個時段 |
| `LATE_CANCEL_NO_REBOOK` | 這個時段無法再預約 |
| `NOT_IN_LATE_WINDOW` | 只有在取消期限之後、開課之前才能登記學員臨時取消 |
| `SLOT_ALREADY_CLOSED` | 這個時段已經關閉 |
| `SLOT_HAS_ATTENDANCE` | 這堂課已有學員簽到，無法關閉時段 |
| `SETTING_MISSING` | 操作失敗，請稍後再試（並記錄，屬系統設定缺漏） |
| `SLOT_STARTED`（既有，訊息改寫） | 課程已經開始，無法進行這個操作 |

**新增歷程事件：** `slot.formed`（`detail: {active_count, min_attendance}`）、`slot.closed`（`detail.cause`: `under_min`｜`coach`）、`purchase.makeup_issued`（`detail: {source_purchase_id, source_booking_id, expires_at}`）；`booking.created` 的 `detail` 多 `status`；`booking.cancelled` 的 `detail` 多 `refund_result`（`returned`｜`makeup`｜`none`）與 `via`。

- [ ] **Step 1:** 逐函式對照檔案最上方 A～G 的白話說明，確認每一條都有對應程式。
- [ ] **Step 2:** 靜態檢查：鎖定順序一律「時段 → 預約 → 購買（→ 請假申請）」；每個新函式都有 `revoke ... from public, anon` 與正確的 `grant`。
- [ ] **Step 3:** 回報附「上線注意」與回滾步驟。

### Task 7: Migration 3 — 請假申請的函式

**Files:** `docs/superpowers/plans/sql-drafts/20261127100200_bfv2_p2_leave_functions.sql`（草稿；實作時搬回 `supabase/migrations/` 並改檔名時間）

**Interfaces:**

| 函式 | 簽章 | 誰可以呼叫 |
|---|---|---|
| `submit_leave_request` | `(p_booking_id, p_reason, p_requested_slot_id default null) returns leave_requests` | authenticated（函式內限學員本人） |
| `withdraw_leave_request` | `(p_request_id) returns leave_requests` | authenticated（學員本人） |
| `resolve_leave_request` | `(p_request_id, p_decision, p_note default null) returns leave_requests`；`p_decision` ∈ `approve_reschedule`｜`approve_refund`｜`reject` | authenticated（Owner／該時段助教） |
| `expire_leave_requests` | `() returns table(request_id, request_booking_id, request_customer_id)` | service_role |
| `leave_requests_due_reminder` | 同上 | service_role |

**錯誤代碼與畫面訊息：**

| 代碼 | 畫面訊息 |
|---|---|
| `LEAVE_NOT_NEEDED` | 這筆預約目前可以直接取消或改期，不需要送請假申請 |
| `LEAVE_ALREADY_PENDING` | 這筆預約已經有一筆審核中的請假申請 |
| `LEAVE_ALREADY_REJECTED` | 教練已回覆不同意，這筆預約無法再送請假申請 |
| `LEAVE_SLOT_INVALID` | 想改去的時段已經無法預約，請重新選擇或不附時段 |
| `LEAVE_NO_SLOT` | 學員沒有附上想改去的時段，無法同意改期 |
| `LEAVE_NOT_FOUND` | 找不到這筆請假申請 |
| `INVALID_DECISION` | 操作失敗，請稍後再試 |

**歷程事件：** `leave_request.submitted`｜`withdrawn`｜`approved_reschedule`｜`approved_refund`｜`rejected`｜`auto_rejected`｜`voided`（`detail.cause`）｜`reminded`。全部帶 `booking_id` 與 `customer_id`，所以預約明細頁的歷程會自動帶出。

- [ ] **Step 1:** 確認「不同意必填處理說明、另兩種選填」（N2 決議，草稿已補：不同意沒填回 `REASON_REQUIRED`）。
- [ ] **Step 2:** 靜態檢查同任務 6。

### Task 8: Migration 4 — 既有資料轉換

**Files:** `docs/superpowers/plans/sql-drafts/20261127100300_bfv2_p2_data_conversion.sql`（草稿；實作時搬回 `supabase/migrations/` 並改檔名時間）

- [ ] **Step 1:** 預覽查詢 B 的結果是 1 筆；terry 決定取消並退回堂數（第四輪回覆）。草稿的第二段就是做這件事，執行前先跑該段上方的預覽查詢，確認只有預期的那幾筆。
- [ ] **Step 1b:** 確認轉換會替每位學員寫一筆站內通知（不推播），而且前置的 `20261126120000` 已執行。
- [ ] **Step 2:** 回報附預覽查詢 A、B，請 terry 執行前先跑。

### Task 9: 同步 `src/lib/supabase/types.ts`

- [ ] **Step 1:** 手動加入：`availability_slots.formed_at`、`customer_purchases.source_booking_id`、表 `leave_requests`、任務 1、6、7 的函式（含 `book_with_purchase` 新的回傳欄位）。
- [ ] **Step 2:** 全庫搜尋 `auto_confirmed` 的使用處並列出（`src/app/book/[slotId]/actions.ts`、測試），交給擁有該檔的線處理。
- [ ] **驗證：** `npm run typecheck`（此時線 B 的 action 會紅是預期，回報註明）。

### Task 10: 用語表、錯誤對照、共用判斷

**Files:**
- Modify: `src/lib/booking-terms.ts`、`src/lib/booking-rpc-errors.ts`、`src/lib/cancel-deadline.ts`
- Create: `src/lib/leave-request.ts`
- Test: `tests/unit/booking-terms.test.ts`、`tests/unit/booking-rpc-errors.test.ts`、`tests/unit/cancel-deadline.test.ts`、`tests/unit/leave-request.test.ts`（新）

- [ ] **Step 1: `booking-terms.ts`** 新增 `LEAVE_REQUEST_STATUS_LABEL`（審核中／同意改期／同意退回／不同意／已撤回／已失效）；`describeActivity` 補任務 6、7 的所有新事件（`booking.created` 在 `detail.status = 'confirmed'` 時寫「{操作人}預約，已成立」；`booking.confirmed` 在 `detail.trigger = 'p2_conversion'` 時寫「系統改版調整：預約改為已確認」；`slot.formed` 寫「已達開班人數，成班」；`purchase.makeup_issued` 寫「系統發放補堂 1 堂」）；新增 `formationText(active, min, formedAt)` 回傳「尚未成班（3/5）」或「已成班」。
- [ ] **Step 2: `booking-rpc-errors.ts`** 加入任務 6、7 表列的訊息。
- [ ] **Step 3: `cancel-deadline.ts`** `willCustomerCancelRefund` 改名並改義為 `customerChangeOptions(now, booking)`，回傳 `{ canCancel, canReschedule, mustUseLeave, leaveReason: 'past_deadline' | 'group_min' | null }`。輸入含：狀態、取消期限、開課時間、是否團班、成班時間、有效人數、開班人數。這是畫面判斷用，資料庫函式才是最終把關。
- [ ] **Step 4: `leave-request.ts`** 純函式：`canSubmitLeave(booking, requests)`（沒有審核中、沒有被不同意過、尚未開課、`mustUseLeave` 為真）、`leaveStatusForViewer(...)`。
- [ ] **Step 5: 單元測試** 每個新訊息不含代碼；每個新事件有白話描述、學員視角不出現 Owner／助教；`customerChangeOptions` 的臨界值（等於期限、多 1 毫秒、團班 2/2、3/2、未成班）；`canSubmitLeave` 的每個分支。
- [ ] **驗證：** `npm test`。

---

# 第 3 段 — 線 A：資料庫整合測試

> 等 #25 合併、terry 執行完 4 個 migration 並同意後才跑。每個新檔 `setupBfv2(label, [只列用到的身分])`。全套整合測試**由一個人跑一次**，跑之前向司令登記。

### Task 11: 更新既有整合測試

**Files:** `tests/integration/atomic-booking.test.ts`、`group-slot-lifecycle.test.ts`、`cancel-booking-deadline.test.ts`、`bfv2-p1-cancel-record.test.ts`、`bfv2-p1-history-ledger.test.ts`、`bfv2-p1-permissions.test.ts`、`book-with-purchase-selection.test.ts`、`checkin-booking.test.ts`、`helpers/bfv2-fixture.ts`、`scripts/e2e-verify.mjs`

行為改變會讓這些既有案例變紅，逐一改成新規則的預期（**不是刪掉**；每改一例在回報寫明「原預期 → 新預期 → 依據」）：
- 新預約狀態 `pending` → `confirmed`；`auto_confirmed` → `booking_status`／`slot_formed`。
- 成班自動確認的歷程（第 1 階段 T12 的案例）→ 改驗 `slot.formed`。
- 學員逾期取消記為不退回（T10-2 等）→ 改驗 `PAST_CANCEL_DEADLINE`。
- 待確認可改期 → 改驗 `PENDING_CANNOT_RESCHEDULE`。
- 需要「待確認」預約當前置的案例（教練拒絕、確認）→ fixture 新增 `makePendingBooking()`：用 service role 直接建立一筆待確認預約並手動扣堂（模擬第 3 階段才會產生的狀態）。
- [ ] **驗證：** 既有整合測試全過；回報附改動對照表。

### Task 12: 預約、成班、名額 — `tests/integration/bfv2-p2-booking-formation.test.ts`

1. 一對一預約 → 已確認；歷程 `booking.created`（`status: confirmed`）；時段額滿。
2. 團班（開班 2、上限 3）第一位 → 已確認、`slot_formed = false`、`formed_at` 為空。
3. 第二位 → `slot_formed = true`、`formed_at` 有值、歷程 `slot.formed` 一筆。
4. 第三位 → `slot_formed = false`、`formed_at` 不變、時段額滿。
5. 成班後一位由教練取消（剩 1）→ `formed_at` 不變；再有人預約 → 不重複寫 `slot.formed`。
6. 改期進入新時段剛好達開班人數 → 新時段成班。
7. 同一學員重複預約同一時段 → `ALREADY_BOOKED`。
8. 失敗的預約不留歷程與明細。

### Task 13: 取消與改期規則 — `tests/integration/bfv2-p2-cancel-reschedule.test.ts`

1. 學員取消已確認、剛好等於期限 → 成功、退回。
2. 過期限 1 秒 → 取消與改期都回 `PAST_CANCEL_DEADLINE`，預約不變。
3. 學員取消待確認（fixture 建立）且已過期限 → 成功、退回。
4. 團班已成班 2/2，學員取消 → `GROUP_MIN_LOCKED`。
5. 同上，學員改期 → `GROUP_MIN_LOCKED`。
6. 團班 3/2 取消成功；未成班 1/2 取消成功。
7. 學員改期成功：新預約已確認、舊預約「改期／轉到新預約」、明細一對、歷程互相連結。
8. 待確認改期（學員、教練）→ `PENDING_CANNOT_RESCHEDULE`。
9. 開課後 Owner 取消 → `SLOT_STARTED`。
10. Owner 代改期：已過取消期限仍成功；團班 2/2 仍成功（不受門檻限制）；未填原因 → `REASON_REQUIRED`。
11. 助教代改自己時段的預約到別人的時段 → 成功；代改別人時段的預約 → `FORBIDDEN`。
12. 開課後代改期 → `SLOT_STARTED`。
13. 取消有審核中請假申請的預約 → 申請變已失效。

### Task 14: 臨時取消與關閉時段 — `tests/integration/bfv2-p2-late-cancel-close-slot.test.ts`

1. Owner 在取消期限後、開課前登記臨時取消 → 已取消、類別學員臨時取消、不退回、已用堂數不變、沒有新明細。
2. 取消期限之前 → `NOT_IN_LATE_WINDOW`；開課後 → `NOT_IN_LATE_WINDOW`。
3. 助教（自己的時段）→ `FORBIDDEN`；平台管理員、學員 → `FORBIDDEN`。
4. 未填原因 → `REASON_REQUIRED`，預約不變、無歷程。
5. 一對一被記臨時取消後：時段狀態仍額滿、`public_bookable_slots` 不回傳、`slot_taken_count = 1`。
6. 團班被記後：別的學員可訂剩餘名額；同一學員再訂 → `LATE_CANCEL_NO_REBOOK`；改期進來也被擋。
7. 第 1 階段過渡紀錄（學員取消＋不退回，以 service role 造資料）不佔名額。
8. 關閉時段：2 筆已確認 → 兩筆皆教練取消、退回、同一原因；時段關閉；歷程 `slot.closed`（`cause: coach`）。
9. 有預約未填原因 → `REASON_REQUIRED`、全部不變；沒有預約的時段不填原因可關。
10. 助教關別人的時段 → `FORBIDDEN`。
11. 開課後 → `SLOT_STARTED`；已關閉 → `SLOT_ALREADY_CLOSED`；已有人簽到 → `SLOT_HAS_ATTENDANCE`。

### Task 15: 請假申請 — `tests/integration/bfv2-p2-leave-request.test.ts`

1. 取消期限前、非團班 → `LEAVE_NOT_NEEDED`。
2. 過期限 → 送出成功、審核中、歷程一筆。
3. 團班 2/2、期限前 → 送出成功（被門檻擋的情況）。
4. 未填原因／只有空白 → `REASON_REQUIRED`。
5. 已有審核中 → `LEAVE_ALREADY_PENDING`。
6. 撤回 → 已撤回；再送 → 成功。
7. 被不同意後再送 → `LEAVE_ALREADY_REJECTED`。
8. 附的時段不同服務／已滿／已過去／原時段 → `LEAVE_SLOT_INVALID`。
9. 同意退回 → 預約已取消、類別請假、來源學員申請、原因＝申請原因、退回；申請「同意退回」。
10. 同意改期 → 舊預約改期、新預約已確認且在學員附的時段；申請「同意改期」。
11. 沒附時段卻同意改期 → `LEAVE_NO_SLOT`。
12. 同意改期時新時段已滿（或到期日不夠）→ 回錯誤；申請仍審核中、預約仍已確認、歷程與明細筆數不變。
13. 不同意（有填說明）→ 預約維持已確認；申請「不同意」。不同意沒填說明或只有空白 → `REASON_REQUIRED`，申請仍審核中。同意退回不填說明 → 成功。
14. 助教處理別人時段的申請 → `FORBIDDEN`；學員自己呼叫處理 → `FORBIDDEN`；別的學員撤回 → `FORBIDDEN`。
15. 助教同意改期到別的成員的時段 → 成功（權限看舊時段）。
16. 已處理過的申請再處理 → `INVALID_STATE`。
17. 開課後 `expire_leave_requests` → 不同意、系統處理、歷程 `auto_rejected`；重跑不重複。
18. `leave_requests_due_reminder`：進入提醒時間內且較早送出的 → 回傳一次；再呼叫不回傳；提醒時間內才送出的不回傳。
19. 失效：教練取消、關閉時段、代改期、學員簽到各一例。
20. 讀取範圍：學員只看得到自己的；助教只看得到自己時段的；Owner 全部；別的租戶看不到。
21. 直接 `insert`／`update` `leave_requests` 被擋。

### Task 16: 到期與補堂 — `tests/integration/bfv2-p2-expiry-makeup.test.ts`

1. 指定的購買到期日早於上課時間 → `PURCHASE_EXPIRES_BEFORE_CLASS`；剛好等於 → 成功。
2. 自動選購買：跳過到期日不夠的那筆，用夠的那筆；都不夠 → `PURCHASE_EXPIRES_BEFORE_CLASS`；完全沒有 → `NO_BALANCE`。
3. 改期到晚於到期日的時段 → `PURCHASE_EXPIRES_BEFORE_CLASS`。
4. 沒有到期日的購買不受限。
5. 退回時原購買已過期（以 service role 把到期日改到過去）→ 新增 1 筆補堂：1 堂、同服務、來源預約正確、到期日＝當下＋平台設定天數；原購買已用堂數不變、沒有新明細；歷程 `purchase.makeup_issued`。
6. 補堂可以拿來預約；扣堂後「已用堂數＝−明細加總」成立。
7. 把 `makeup_grace_days` 暫時移走 → 取消回 `SETTING_MISSING`、整筆不變（測完還原；此案例會動到共用設定，**只在確認沒有別人同時跑測試時執行**，否則標 skip 並在回報說明）。
8. 人數不足自動取消時原購買已過期 → 一樣發補堂。

### Task 17: 自動取消 — `tests/integration/bfv2-p2-auto-cancel.test.ts`

1. 未成班（1/2）到了取消期限 → `auto_cancel_unformed_slots` 取消、退回、時段關閉。
2. 已成班後掉到 1/2、到了取消期限 → **不**取消。
3. 還沒到取消期限的未成班時段 → 不取消。
4. 一對一時段 → 不處理。
5. 取消期限 72 小時的服務、開課前 60 小時 → 會被取消（舊排程 48 小時的掃描範圍會漏）。
6. 重跑不重複取消。

---

# 第 3 段 — 線 B：學員端

### Task 18: 學員端 Server Action

**Files:** `src/app/book/[slotId]/actions.ts`、`src/app/(customer)/my-bookings/leave-actions.ts`（新）

- [ ] **Step 1:** `createBookingAction`：改讀 `booking_status`、`slot_formed`；`slot_formed` 為真時呼叫 `notifySlotFormed(slotId)`（線 D）；預約成立通知改用 `notifyBookingChange(id, 'created', ...)` 的新文案（線 D）。
- [ ] **Step 2:** 改期：新預約直接成立；通知改用 `notifyRescheduled`（線 D）。
- [ ] **Step 3:** `cancelMyBookingAction`：錯誤對照已含新代碼，不需特別處理；移除回傳 `classDisposition` 中「不退回」的分支文案依賴（P2 學員取消一律退回）。
- [ ] **Step 4:** 新增 `submitLeaveRequestAction({ bookingId, reason, requestedSlotId? })`、`withdrawLeaveRequestAction({ requestId })`：zod 驗證（原因 1～500 字）、呼叫 RPC、`toBookingAppError`、通知（線 D）、`revalidatePath('/my-bookings', 'layout')`。
- [ ] **驗證：** `npm run typecheck`、`npm run lint`。

### Task 19: 我的預約卡片與明細頁（需示意圖 M1、M2、M4）

**Files:** `src/app/(customer)/my-bookings/my-bookings-content.tsx`、`booking-change-actions.tsx`、`cancel-button.tsx`、`booking-display.ts`、`[bookingId]/page.tsx`

- [ ] **Step 1:** 查詢多讀：`availability_slots(formed_at)`、`services(min_attendance, max_capacity)`、該筆預約的請假申請（`leave_requests`，RLS 只會回自己的）、團班的有效人數、開班人數、成班時間用 `slot_formation_info(slot_id)` 取得（學員讀不到別人的預約，所以不能自己數；這支函式只回給在該時段有預約的學員、該租戶成員與平台管理員）。清單頁對團班預約逐筆呼叫，一對一不呼叫。
- [ ] **Step 2:** 按鈕規則全部走 `customerChangeOptions`：可自己取消／改期 → 照舊；`mustUseLeave` → 隱藏取消與改期，顯示「請假申請」與一句原因（已過取消期限／這堂課目前剛好達到開班人數，取消需要教練同意）；待確認不顯示「改期」。
- [ ] **Step 3:** 團班顯示成班資訊（`formationText`）。
- [ ] **Step 4:** 請假申請狀態：審核中顯示「請假申請審核中」與「撤回」；已處理顯示結果。明細頁用 `leave-request-panel`（任務 20）。
- [ ] **Step 5:** 取消對話框拿掉「不退回」警告分支。
- [ ] **Step 6:** 既有待確認轉換不在卡片上另外做提示：學員會收到一筆站內通知（資料轉換的 SQL 寫入），預約歷程也有一筆「系統改版調整：預約改為已確認」（任務 10）。
- [ ] **Step 7:** 判斷依據讀不到（請假申請查詢失敗、人數查不到）時，顯示「目前無法操作，請稍後再試」，不顯示任何動作按鈕。
- [ ] **測試：** `tests/unit/my-booking-display.test.ts` 補上述分支。

### Task 20: 請假申請對話框與區塊（需示意圖 M3）

**Files:** `src/components/bookings/leave-request-dialog.tsx`、`leave-request-panel.tsx`（新）

**Interfaces（線 C 依賴，先寫死）:**

```ts
// leave-request-panel.tsx — 學員端與教練端明細頁共用的顯示區塊
export type LeaveRequestView = {
  id: string
  status: 'pending' | 'approved_reschedule' | 'approved_refund' | 'rejected' | 'withdrawn' | 'void'
  reason: string
  requestedSlot: { id: string; startAt: string; endAt: string } | null
  handledAt: string | null
  handleNote: string | null
  handledBySystem: boolean
  createdAt: string
}
export function LeaveRequestPanel(props: {
  viewer: 'customer' | 'tenant'
  requests: LeaveRequestView[]          // 新到舊
  actions?: React.ReactNode             // 學員：撤回；教練：處理按鈕
}): JSX.Element
```

- [ ] **Step 1:** 對話框：原因必填（上限 500 字）；「想改去的時段」選填；固定提示「教練在開課前沒處理，就視為不同意。」；左側按鈕叫「返回」（沿用第 1 階段決議）。選時段的呈現方式依示意圖 M3 的定案。
- [ ] **Step 2:** 可選時段的來源用 `public_bookable_slots`（同教練、同服務、排除原時段）。
- [ ] **測試：** `tests/unit/components/bookings/leave-request-dialog.test.tsx`：未填原因不能送出、去空白、不附時段可送出、附時段帶出 id；`leave-request-panel.test.tsx`：六種狀態的文字、系統處理的說法、學員視角不出現 Owner／助教。

### Task 21: 公開頁與預約確認頁（到期提示需示意圖 M5；其餘純文字）

**Files:** `src/app/[tenantSlug]/slot-picker.tsx`、`src/components/booking/reschedule-banner.tsx`、`src/app/book/[slotId]/page.tsx`、`book-form.tsx`

- [ ] **Step 1（文字）:** 確認頁提示「確認資訊後送出預約申請，等教練確認」→「確認資訊後送出，預約立即成立」；改期提示「新預約狀態為待確認」→「原預約會取消，新預約立即成立」；取消政策改為「開始前 N 小時以上可自己取消或改期，堂數退回；之後要送請假申請，由教練決定」。送出按鈕若寫「送出預約申請」一併改。
- [ ] **Step 2（到期）:** 確認頁的堂數選單：到期日早於上課時間的那筆顯示為不可選並註明「到期日早於上課時間」；全部都不可選時顯示說明與「去購買堂數」，不顯示送出鈕。
- [ ] **Step 3（改期模式）:** 進入改期模式時，若原預約不能自己改期（`customerChangeOptions`），顯示說明並導回明細頁，不讓學員白選時段。
- [ ] **驗證：** `npm run typecheck`；實測 H5、H13。

### Task 22: 購課紀錄頁顯示補堂（純清單多一種列；版面沿用現有列，示意圖 M6 一併確認）

**Files:** `src/app/[tenantSlug]/purchases/page.tsx`

- [ ] **Step 1:** 查詢多讀 `origin`、`source_booking_id`；`origin = 'makeup'` 的列顯示「補堂 1 堂・到期日」，並連到來源預約的明細頁。

---

# 第 3 段 — 線 C：教練端

### Task 23: 教練端 Server Action

**Files:** `src/app/(tenant)/bookings/actions.ts`、`src/app/(tenant)/calendar/actions.ts`

- [ ] **Step 1:** 新增 `lateCancelBookingAction({ bookingId, reason })`（`requireTenantOwner`）、`rescheduleBookingByTenantAction({ bookingId, newSlotId, reason })`、`resolveLeaveRequestAction({ requestId, decision, note? })`、`closeSlotAction({ slotId, reason? })`。全部：zod、RPC、`toBookingAppError`、通知（線 D）、`revalidatePath('/bookings')`／`/calendar`／明細頁、`revalidateTag(publicSlotsTag)`。
- [ ] **Step 2:** `deleteSlotAction` 失敗時不再把資料庫原始訊息丟給畫面：外鍵擋下（時段曾有預約）顯示「這個時段有過預約紀錄，無法刪除；可以改用關閉時段」。這是既有問題（W17 盤點 D9），屬於本檔案，順手修。

### Task 24: 預約管理清單（需示意圖 M7）

**Files:** `src/app/(tenant)/bookings/page.tsx`、`booking-actions.tsx`、`booking-display.ts`

- [ ] **Step 1:** 查詢多讀：`availability_slots(formed_at)`、`services(min_attendance)`、`cancel_deadline_at`、各筆預約是否有審核中的請假申請。
- [ ] **Step 2:** 篩選多一個「請假申請」（有審核中申請的預約）；卡片加「請假申請」標記。
- [ ] **Step 3:** 按鈕規則抽成純函式 `tenantBookingActions(session, booking, now)`（放 `booking-display.ts`）：開課前才有「取消」；取消期限後到開課前且身分是 Owner 才有「學員臨時取消」；已確認且開課前有「代改期」；有審核中申請時顯示「處理請假」連到明細頁。助教看別人時段的預約全部不顯示。
- [ ] **Step 4:** 團班顯示成班資訊。
- [ ] **測試：** `tests/unit/tenant-booking-actions.test.ts`：Owner／助教自己時段／助教別人時段 × 取消期限前／後／開課後 × 待確認／已確認。

### Task 25: 教練端明細頁的請假處理（需示意圖 M8）

**Files:** `src/app/(tenant)/bookings/[bookingId]/page.tsx`、`leave-resolve-actions.tsx`（新）

- [ ] **Step 1:** 用 `LeaveRequestPanel`（`viewer="tenant"`）顯示申請；審核中時提供三個動作：同意改期（學員沒附時段、或該時段現在已不可用時停用並說明原因）、同意退回、不同意；處理說明在選「不同意」時必填，另兩種選填。
- [ ] **Step 2:** 同意改期失敗（時段剛被訂滿等）時留在原畫面顯示訊息，申請維持審核中。
- [ ] **Step 3:** 按鈕組改用任務 24 的 `tenantBookingActions`。

### Task 26: 學員臨時取消對話框（需示意圖 M9）

**Files:** `src/components/bookings/late-cancel-dialog.tsx`（新，以 `cancel-reason-dialog.tsx` 為底）

- [ ] **Step 1:** 必填原因；固定說明三件事：不退回這 1 堂、這個名額不會再開放給別人、學員會收到通知。確認鈕「登記臨時取消」，左側「返回」。
- [ ] **測試：** 未填不能送出；說明文字存在；不含禁用詞。

### Task 27: 代改期畫面（需示意圖 M10）

**Files:** `src/app/(tenant)/bookings/[bookingId]/reschedule/page.tsx`、`reschedule-form.tsx`（新）

- [ ] **Step 1:** 顯示學員、原時段；列出同一個服務、尚未開課、未額滿的時段（整個租戶，標出負責成員）；必填原因；送出後回明細頁。
- [ ] **Step 2:** 進入頁面時伺服器端先判斷可否代改（身分、狀態、是否已開課），不可則顯示原因，不顯示表單。
- [ ] **Step 3:** 時段清單用教練自己的權限讀 `availability_slots`（成員讀得到全租戶），名額用 `slot_taken_count`。

### Task 28: 行事曆時段視窗（需示意圖 M11）

**Files:** `src/app/(tenant)/calendar/slot-popover.tsx`、`page.tsx`、`calendar-panel.tsx`（只傳資料）

- [ ] **Step 1:** `page.tsx`：每個時段帶出**學員名單**（每筆未取消預約的 id、學員名稱、狀態），取代現在只留最後一位的 `bookingsBySlot`；人數改用「已佔名額」（含學員臨時取消）；帶出 `formed_at` 與開班人數。
- [ ] **Step 2:** 時段視窗：列出名單，每列有「明細」與（可代改時）「代改期」；團班顯示成班資訊；新增「關閉時段」（Owner 或自己的時段、開課前）：有預約時要填原因並說明「會取消 N 筆預約、退回、通知學員」；沒有預約時直接確認。
- [ ] **Step 3:** 既有「刪除時段」保留給沒有任何預約紀錄的時段。時段狀態標籤（可預約／待確認／已預約）**不改**（第 5 階段）。

### Task 29: 儀表板（需示意圖 M12）

**Files:** `src/app/(tenant)/dashboard/dashboard-content.tsx`

- [ ] **Step 1:** 待辦區新增「待處理的請假申請」（助教只列自己時段的），每筆連到預約明細頁；查詢失敗顯示讀取失敗，不顯示 0。
- [ ] **Step 2:** 今日課程的人數改用已佔名額。
- [ ] **Step 3:** 「待確認」統計與清單保留（第 3 階段會再用到），不改文字。

### Task 30: 學員資料顯示補堂（版面沿用現有列，示意圖 M6 一併確認）

**Files:** `src/app/(tenant)/customers/page.tsx`、`customer-row.tsx`

- [ ] **Step 1:** 購買清單多讀 `origin`；補堂顯示為「補堂 1 堂・到期日」。

---

# 第 3 段 — 線 D：通知、排程、歷程

### Task 31: 通知文案

**Files:** `src/lib/notify-booking.ts`、`src/lib/notify-leave.ts`（新）、`tests/unit/notify-booking-copy.test.ts`、`tests/unit/notify-leave-copy.test.ts`（新）

文案一律由純函式產生並有單元測試；學員收到的一律稱「教練」或租戶名稱。每一則都帶連到該筆預約明細頁的站內路徑。**站內通知不用另外寫**：任務 4B 之後，只要經過 `pushToUser`，就會同時留下站內紀錄。

| 事件 | 給誰 | 標題／內文要點 |
|---|---|---|
| 預約成立（取代「新預約申請」） | 該時段教練 | 「新預約」：{學員} 預約了 {服務}（{時間}），已成立 |
| 成班 | 這堂課所有學員＋該時段教練 | 「已成班，確定開課」：{服務}（{時間}）已達開班人數 |
| 學員改期／教練代改期 | 教練／學員 | 代改期給學員：「教練幫你把預約改到 {新時間}」＋原因 |
| 學員臨時取消（教練代登） | 學員 | 「預約已取消（不退回）」：教練登記你臨時取消 {時間} 的課，這 1 堂不退回。原因：…。如有疑問請聯絡教練。 |
| 關閉時段 | 每位被取消的學員 | 沿用教練取消的文案（含原因、已退回 1 堂） |
| 請假申請送出 | 該時段教練（助教的時段另通知 Owner？**不另通知**，規格只要求拒絕與教練取消通知 Owner） | 「請假申請」：{學員} 對 {時間} 的課送出請假申請，請在開課前處理 |
| 請假第二次提醒 | 該時段教練 | 「請假申請尚未處理」：開課前沒處理就視為不同意 |
| 同意改期／同意退回／不同意 | 學員 | 各一則，含處理說明 |
| 系統自動不同意 | 學員 | 「請假申請未獲同意」：教練在開課前沒有處理 |
| 退回時發了補堂 | 學員 | 在原通知加一句：「原本的堂數已過期，改發補堂 1 堂，請在 {到期日} 前使用」 |
| 人數不足自動取消 | 不變 | — |

- [ ] **Step 1:** `notifyGroupAutoConfirm` 改名為 `notifySlotFormed(slotId)`，對象加上教練。
- [ ] **Step 2:** `buildCancelNotice` 補 `late_cancel`、`leave` 兩個類別；取消紀錄讀不到時不發（現況已如此）。
- [ ] **Step 3:** 助教做教練取消、關閉時段時通知 Owner（沿用現有 `toOwners`）。
- [ ] **測試：** 每則文案：含必要資訊、不含禁用詞、學員版不出現 Owner／助教、原因過長會截斷。

### Task 32: 排程

**Files:** `src/app/api/cron/auto-cancel-group-class/route.ts`、`src/app/api/cron/checkin-reminder/route.ts`

- [ ] **Step 1:** 自動取消 route 改成只呼叫 `auto_cancel_unformed_slots()`，依回傳列發通知；移除 route 內的人數判斷與 48 小時掃描。RPC 失敗回 500 並記錄。
- [ ] **Step 2:** 簽到提醒 route（每分鐘執行）最後加兩段：`expire_leave_requests()` → 通知學員；`leave_requests_due_reminder()` → 通知教練。各自失敗只記錄、不影響其他段，回傳的 JSON 加上對應的筆數與失敗旗標。**不新增 pg_cron 工作。**
- [ ] **驗證：** `npm run typecheck`；實測 H16。

### Task 33: 歷程列表

**Files:** `src/lib/activity-log.ts`、`src/components/bookings/booking-timeline.tsx`、`tests/unit/components/bookings/booking-timeline.test.tsx`

- [ ] **Step 1:** 確認依 `booking_id` 查詢會帶出 `leave_request.*` 與 `purchase.makeup_issued`（兩者都有寫 `booking_id`）；`slot.formed`／`slot.closed` 沒有 `booking_id`，不出現在單筆預約的歷程（成班資訊由畫面另外顯示）。
- [ ] **Step 2:** 補測試：新事件的顯示、處理說明顯示、學員視角。

---

# 第 4 段

### Task 34: e2e — `tests/e2e/booking-flow-v2-p2.spec.ts`

需要 e2e 席位。案例：
1. 兩位學員先後預約同一個團班時段：第二位在公開頁看得到、人數正確；第二位預約後雙方看到已成班。
2. 學員預約一對一 → 直接顯示已確認。
3. 過取消期限的預約：卡片沒有取消與改期，有「請假申請」；送出（附時段）→ 教練端清單有標記 → 同意改期 → 學員看到新預約。
4. 請假申請：送出 → 撤回 → 再送 → 教練不同意 → 學員看到結果、不能再送。
5. Owner 登記學員臨時取消 → 學員端顯示不退回；公開頁該時段仍不開放。
6. 助教帳號：看不到「學員臨時取消」；別人時段的預約沒有任何按鈕。
7. 教練從行事曆時段視窗挑一位學員代改期。
8. 關閉有 2 筆預約的時段 → 兩位學員的預約都顯示教練取消、已退回。
9. 堂數到期日早於上課時間 → 確認頁不能送出。

`tests/e2e/booking-flow-v2-p1.spec.ts` 裡依賴「待確認」「逾期取消不退回」的案例同步改寫。

### Task 35: 合併、全量驗證、對照表、文件回寫

- [ ] **Step 1:** 四條線合併進整合分支；`npm run typecheck`、`npm run lint`、`npm test`、`npm run build`（讀過警告）。
- [ ] **Step 2:** 整合全套跑一次、e2e 全套跑一次（先登記）；回報附「跑了哪些、沒跑哪些、結果」。
- [ ] **Step 3:** 用產生檔比對 `types.ts`，差異以產生檔為準。
- [ ] **Step 4:** 「規則 × 入口對照表」逐格打勾，附測試名稱或實測項目。
- [ ] **Step 5:** 回寫文件：`README.md`、`docs/usage-guide.md`、`docs/user-guides/**` 裡「等教練確認」「逾期取消不退回」的描述；規格 §18 註記 P2 完成內容與落差。
- [ ] **Step 6:** 與本計畫對照，主動回報落差（以實際做出來的為準）。

---

## 上線順序（terry 執行）

**PR-1（團班時段可見性）**

| 步驟 | 動作 | 對線上的影響 |
|---|---|---|
| 1 | 執行 QR-D 的兩個檔（`20261126110000_..._functions`、`20261126110100_..._policy`）與驗證 SQL | 舊版程式照常運作 |
| 2 | 合併並部署 PR-1 | 團班人數正確、確認頁可進入 |

**PR-2（站內通知）**

| 步驟 | 動作 | 對線上的影響 |
|---|---|---|
| 1 | 執行 `20261126120000` 與驗證 SQL | 無（只多 3 個空欄位） |
| 2 | 合併並部署 PR-2 | 學員端出現鈴鐺；從這一刻起的通知才有站內紀錄，之前的通知不會回補 |

**PR-2b（站內通知 B：推播偏好整合）**

| 步驟 | 動作 | 對線上的影響 |
|---|---|---|
| 1 | 跑 `20261126130000` 上方的預覽查詢 A、B，記下受影響人數 | 無 |
| 2 | **公告提醒教練：先前在推播偏好關掉的項目、設定過的勿擾時段，從這次更新起會開始生效**（terry 第六輪決議） | — |
| 3 | 執行 `20261126130000` 與驗證 SQL | 當下無影響（舊版程式只讀舊開關） |
| 4 | 立刻合併並部署 PR-2b | 兩端設定頁換成同一套；推播依整合後的設定 |

**PR-3（P2 其餘）**

| 步驟 | 動作 | 對線上的影響 |
|---|---|---|
| 1 | 執行 `20261127100000`（資料表） | 無 |
| 2 | 離峰時段：先跑「現在就符合自動取消條件的時段」預覽查詢（SQL 審閱清單第 3 個檔）→ 執行 `20261127100100`（含現存時段補成班時間）、`20261127100200` | **從這一刻到新版部署完成之間**：舊版的預約仍可成立（直接變已確認，畫面可能仍寫等教練確認）；學員逾期取消會失敗並顯示通用錯誤 |
| 3 | 立刻合併並部署 PR-3 | 恢復正常 |
| 4 | 跑 `20261127100300` 的預覽查詢 → 確認 → 執行 | 現存待確認的團班預約變成已確認；每位學員收到一筆站內通知（不推播） |
| 5 | 整合測試、e2e、實機確認清單 | — |

回滾順序：程式退版 → `100200` → `100100`（重新執行第 1 階段的函式檔）→ `100000`。`100300` 的轉換見該檔的還原說明。

---

## 測試計畫總表

| 類型 | 檔案 | 案例數 | 何時跑 |
|---|---|---|---|
| 單元（新，站內通知） | `push-in-app`、`notification-bell`、`notification-list` | 約 15 | 隨時 |
| 整合／e2e（新，站內通知） | `in-app-notifications.test.ts`（5）、`in-app-notifications.spec.ts`（3） | 8 | 同下 |
| 單元（新） | `leave-request`、`tenant-booking-actions`、`notify-leave-copy`、`leave-request-dialog`、`leave-request-panel`、`late-cancel-dialog` | 約 45 | 隨時（`npm test`） |
| 單元（改） | `booking-terms`、`booking-rpc-errors`、`cancel-deadline`、`my-booking-display`、`notify-booking-copy`、`booking-timeline`、`forbidden-terms`（不改，必須仍全過） | — | 隨時 |
| 整合（新） | `group-slot-visibility`（6）、`bfv2-p2-booking-formation`（8）、`-cancel-reschedule`（13）、`-late-cancel-close-slot`（11）、`-leave-request`（21）、`-expiry-makeup`（8）、`-auto-cancel`（6） | 73 | terry 執行 migration 並同意後；一次一人 |
| 整合（改） | 任務 11 列的 8 檔 | — | 同上 |
| e2e（新） | `booking-flow-v2-p2.spec.ts` | 9 | 登記席位後 |
| e2e（改） | `booking-flow-v2-p1.spec.ts` | — | 同上 |

**登入頻率：** 新增 8 個整合測試檔（含站內通知 1 檔，登入 3 次）。每檔宣告的登入身分上限：`group-slot-visibility` 2、`booking-formation` 3、`cancel-reschedule` 4、`late-cancel-close-slot` 5、`leave-request` 5、`expiry-makeup` 2、`auto-cancel` 1，合計 25 次。加上既有的次數，全套一定超過單一 5 分鐘視窗的上限 → **線 A 的回報要附全套實際登入次數**；若超過，任務 35 的全套改分兩批跑（中間隔 5 分鐘），做法寫進 `package.json` 的說明或測試 README，不靠人記。

## 需要 terry 實機點過的項目

| # | 項目 | 預期 |
|---|---|---|
| H1 | 兩個學員帳號先後預約同一個團班時段 | 第二位在公開頁看得到該時段與「1/N」；確認頁進得去 |
| H2 | 預約一堂一對一 | 立刻是已確認；教練收到「新預約」而不是「新預約申請」 |
| H3 | 團班達開班人數 | 學員與教練都收到成班通知；卡片、明細、時段視窗顯示已成班；未達時顯示「尚未成班（1/2）」 |
| H4 | 未成班的團班到了取消期限 | 5 分鐘內整堂取消、退回、收到通知 |
| H5 | 預約確認頁文字 | 沒有「等教練確認」「逾期取消不退回」 |
| H6 | 已過取消期限的預約 | 沒有取消與改期，只有「請假申請」與說明 |
| H7 | 團班剛好達開班人數時，其中一位想取消 | 被擋，改顯示「請假申請」與說明 |
| H8 | 已開課的預約（教練端） | 沒有「取消」 |
| H9 | Owner 登記學員臨時取消 | 學員收到通知（含「如有疑問請聯絡教練」）；明細顯示不退回；公開頁該時段不開放；助教帳號沒有這個按鈕 |
| H10 | 教練代改期（三個入口各一次） | 學員收到通知；新預約已確認；歷程串得起來 |
| H11 | 請假申請完整走一次：送出（附時段）→ 同意改期；送出 → 同意退回；送出 → 不同意；送出 → 撤回 → 再送 | 每一步雙方畫面與通知正確；被不同意後不能再送 |
| H12 | 關閉一個有預約的時段 | 要填原因；學員都收到通知、已退回；時段不再開放 |
| H13 | 用快到期的堂數預約到期日之後的課 | 確認頁擋下並說明 |
| H14 | 補堂（需用 SQL 造一筆已過期購買的舊預約再取消） | 購課紀錄與教練的學員資料都顯示「補堂 1 堂・到期日」 |
| H15 | 助教帳號 | 別人時段的預約沒有任何操作；儀表板只列自己時段的請假申請 |
| H16 | 排程：請假申請放到開課 | 自動變成不同意、學員收到通知；`net._http_response` 最近幾筆 200 |
| H17 | 手機寬度看 M1～M15 | 與同意的示意圖一致 |
| H18 | 站內通知：用**沒有允許推播**的學員帳號，請教練取消他的一筆預約 | 頁首鈴鐺出現數字；點鈴鐺跳出小視窗（手機上不超出畫面）；「看全部通知」進清單看得到標題、原因；點進去到預約明細；數字歸零 |
| H19 | 資料轉換後，被轉換的學員登入 | 鈴鐺有未讀；通知寫「系統改版調整…已改為已確認」；手機沒有收到推播 |
| H20 | 教練帳號允許推播 → 勾選表關掉「預約取消」→ 學員取消一筆預約 | 教練**沒有**收到推播，但站內通知清單有這一則；把勾選打開再試一次 → 收到推播 |
| H21 | 教練把勿擾時段設成涵蓋現在 → 學員預約一堂 | 教練沒有收到推播，站內清單有；清掉勿擾時段再試 → 收到推播 |
| H22 | 學員端設定頁：關掉「預約取消」、設勿擾時段、改每日提醒時間 → 重新整理 | 設定都留著；請教練取消一筆預約 → 學員沒有收到推播、站內清單有 |
| H23 | 轉換前有關掉舊開關的學員（轉換前先記下一位） | 轉換並部署後，設定頁上對應的事件都是關的，沒有被打開 |
| H24 | 每日提醒：關掉的人，連續兩天 | 兩天都沒有推播；站內清單兩則都在，但鈴鐺上這一種只算 1 則未讀 |
| H25 | 學員送出購買申請 | Owner 與助教的鈴鐺數字都 +1；點進去到購買申請頁；有開推播的人收到推播 |

---

## 風險與未決事項

### ★ R1　SQL 草稿沒有執行過

4 個 P2 migration 加 1 個可見性 migration 都是照第 1 階段實際上線的函式改寫的，但**沒有在任何資料庫執行或語法檢查過**（這一輪規定不執行 SQL）。第 1 階段就有兩個問題是整合測試才抓到的。建議：terry 審閱後，先由實作代理做一次逐行靜態檢查（任務 5～8 的 Step），執行時一個檔一個檔來，每個檔跑完立刻跑它的驗證查詢。

### ★ R2　名額與成班的算法一次全換

預約、取消、改期、確認、自動取消、公開頁、行事曆、儀表板的人數全部改用同一套算法。任何一處漏改都會出現「畫面說有名額、送出卻被擋」。對策：任務 35 用全庫搜尋 `neq('status', 'cancelled')` 與 `status <> 'cancelled'` 列出所有還在自己算人數的地方，逐一確認。

### ★ R3　上線空窗

`100100` 執行後到新版部署前，學員逾期取消會看到通用錯誤。比第 1 階段的空窗小（預約、確認、改期、簽到都還能用），但仍建議離峰連續做。

### R10　站內通知讓第 2 階段變大

多 6 個任務、1 個 SQL 檔、2～3 張示意圖。已切成可單獨上線的一組，不卡住其他功能；風險在 `pushToUser` 是所有通知共用的函式，改壞會影響既有的每一種通知——任務 4B 的單元測試要涵蓋既有行為（去重、推播成功與失敗的狀態值）不變。

### R14　購買申請通知的對象會在第 3 階段改變

現在核准購買申請 Owner 與助教都能做，所以兩者都通知。第 3 階段把核准收緊成只有 Owner 時，通知對象要一起改（已集中成 `purchaseReviewerUserIds` 一處），第 3 階段的計畫要列這一項。

### R13　推播偏好整合的上線順序

轉換 SQL 要在站內通知 B 部署前一刻執行，跑完立刻部署。舊版程式只讀舊開關、轉換不動舊開關，所以**先跑 SQL 不會影響線上**；風險只在「SQL 跑完到部署之間」學員在舊畫面改的設定不會帶到新的一份——時間越短越好。退版也安全：舊開關的值沒被動過。舊欄位留著是刻意的，等確定不需要退版後再另外提一個清欄位的 SQL。

### R12　推播偏好修正會改變現有教練收到的推播

勾選表與勿擾時段一接上，教練以前勾過、但一直沒有作用的設定會**突然生效**——例如某位教練早就把「新預約」的推播關掉、卻一直照常收到，修好之後就真的收不到了。這是修正的本意，但對使用者來說是行為改變。上線前建議查一次有多少教練存過「關掉」的勾選或設過勿擾時段（唯讀查詢，寫在轉換 SQL 檔上方的預覽查詢 A），由 terry 決定要不要先告知。

### R11　站內紀錄會變多

以前沒開推播的人不寫紀錄，之後每一則都寫。每日提醒、每週摘要這類也會進清單。清單只取最新 100 筆，未讀數有專用索引，短期沒有效能問題；要不要定期清舊紀錄、哪些類型不該進站內清單，上線後看實際狀況再提。

### R4　學員端需要「有效人數」但讀不到別人的預約

已在第 2 個 migration 加 `slot_formation_info`：只回數字與成班時間，而且只回給在該時段有預約的學員、該租戶成員與平台管理員。教練端的清單、明細、時段視窗也用它，三處數字才會一致。

### R5　待確認預約在 P2～P3 之間幾乎不存在

教練拒絕、確認兩個動作在 P2 沒有新資料可操作（只剩轉換時已過上課時間的舊資料）。函式與畫面都保留給第 3 階段；整合測試用 fixture 造資料維持覆蓋。

### R6　補堂可以接續

補堂被拿去預約、之後又在補堂過期後退回，會再發一筆補堂（照 §9.3 字面）。課後退回都要教練動手，不會自動無限延長；列出供 terry 知悉。

### R7　測試登入次數

見「測試計畫總表」。#25 未合併前線 A 不開工。

### R8　`platform_settings` 多了一個內部記號

`bfv2_p2_converted_at` 用來保證資料轉換只做一次。這張表登入者都讀得到（只有時間，沒有敏感內容）。

### R9　舊排程的掃描範圍

現行自動取消只掃 48 小時內的時段；取消期限設超過 48 小時的服務會晚取消。P2 改由資料庫函式挑時段後自然解決，上線後第一次執行可能一次取消多個早該取消的時段——上線前請 terry 用 `100300` 檔的預覽概念另跑一次「現在就符合自動取消條件的時段」清單（查詢寫在 SQL 審閱清單）。
