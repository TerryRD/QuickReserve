# QuickReserve 使用手冊

按角色閱讀，逐步操作。所有手冊都用一致的測試帳號讓你照流程跑過一次。

| 角色 | 在系統中能做什麼 | 手冊 |
|------|-----------------|------|
| 🛠️ 平台管理員（你） | 邀請教練、暫停/啟用租戶、看全平台統計 | [`01-platform-admin.md`](01-platform-admin.md) |
| 🏓 教練 Owner | 自己的服務、行事曆、預約、助教管理 | [`02-coach-owner.md`](02-coach-owner.md) |
| 👨‍🏫 助教 Staff | 自己的時段與預約 | [`03-staff.md`](03-staff.md) |
| 👤 學員（客戶） | 找教練 → 看可用時段 → 預約 → 管理我的預約 | [`04-customer.md`](04-customer.md) |

---

## 🧪 測試帳號（已預先建立）

> 所有密碼都是 **`Test1234!`**（含驚嘆號）

| 角色 | 帳號 | 用途 |
|------|------|------|
| 平台管理員 | `terry@gmail.com` | 你自己（密碼是你之前設的） |
| 王教練（Owner） | `demo-coach-wang@example.com` | 桌球教練 · 已有時段 + 1 個待確認預約 |
| 陳教練（Owner） | `demo-coach-chen@example.com` | 高爾夫教練 · 已有時段 + 1 個待確認預約 |
| 林教練（Owner） | `demo-coach-lin@example.com` | 網球教練 · 有 1 位助教 |
| 阿明（Staff） | `demo-staff-ming@example.com` | 林教練的助教 |
| 小明（學員） | `demo-student-ming@example.com` | 有 1 個 pending + 1 個 confirmed 預約 |
| 小華（學員） | `demo-student-hua@example.com` | 有 1 個 confirmed 預約 |
| 小美（學員） | `demo-student-mei@example.com` | 有 1 個 pending 預約 |

公開預約頁網址：
- `quick-reserve-mu.vercel.app/demo-wang-coach`
- `quick-reserve-mu.vercel.app/demo-chen-coach`
- `quick-reserve-mu.vercel.app/demo-lin-coach`

---

## 🚀 30 秒快速試用

最短的「親身感受」路徑：

1. **登入學員**：`/login` → `demo-student-ming@example.com` / `Test1234!`
2. 你會自動進「我的預約」，會看到 1 個待確認 + 1 個已確認的預約
3. 開新分頁：`/demo-wang-coach` → 點選一個時段 → 看到預約確認頁
4. 登出，改用 **王教練** 登入 → 進「預約管理」就會看到剛剛小明送出的預約 → 點「確認」
5. 切回小明的分頁刷新「我的預約」→ 變「已確認」

更完整的流程請看各角色的手冊。

---

## 🔄 重新產測試資料

若資料被你弄亂想重來：

```powershell
cd C:\VisualDev\QuickReserve
node scripts/seed-test-data.mjs
```

這個 script 會：
1. **刪掉** 所有 `demo-` 開頭的租戶 + 使用者
2. 重新建立上述全部測試資料 + 預設預約

> ⚠️ 不會影響你的 `terry@gmail.com` 平台管理員帳號。
