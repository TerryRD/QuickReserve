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
