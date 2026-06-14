# 個人帳號設定（Account Settings）設計

日期：2026-06-14
狀態：設計已核可，待寫實作計畫

## 背景與問題

登入後的畫面沒有顯示「目前登入的人是誰」。租戶後台側欄（`src/app/(tenant)/layout.tsx`）只顯示租戶名稱與角色標籤（Owner/Staff），看不到登入者本人的姓名或 email；platform_admin 後台完全不顯示登入者；customer header 只顯示 email。

更根本的是資料層缺口：**個人（tenant_member，無論 owner 或 staff）在資料庫沒有任何姓名欄位**，只有 `user_id`、`role`、`email`。`platform_admins` 同樣只有 `user_id`。只有 `customers` 表有 `display_name`（教練在學員/預約清單看到的就是它）。

使用者要的是：在畫面顯示登入者「姓名」，並讓使用者**自助修改個人資訊**——姓名、email（會影響登入）、密碼。

## 需求摘要（已與使用者確認）

- **範圍**：三種角色都做（tenant owner/staff、customer、platform_admin）。
- **Email 變更**：本次採「管理員 API 即時變更」（不寄確認信、即時生效），因為目前沒有可靠寄信管道（專案先前定調「Email 通道不做」，且 Supabase 未設定 SMTP、`double_confirm_changes = true`）。未來有寄信能力後改走標準確認信流程（列入待辦）。
- **敏感操作驗身**：改 email / 改密碼前，強制重輸「目前密碼」驗證。
- **姓名儲存**：採 A1 —— 存在 Supabase Auth `user_metadata.full_name`（零新表、零 migration，三角色一致；customer 另同步 `customers.display_name`）。
- **頁面位置**：採 B1 —— 單一共用 `/account` 頁，三角色共用同頁、同表單、同 actions。

## 架構總覽

新增共用 `/account` 頁，所有已登入使用者皆可進入。姓名、Email、密碼全部透過 Supabase Auth 一套 API 處理，**不新增資料表、不寫 migration**。

### 新增/修改檔案

| 檔案 | 動作 | 用途 |
|------|------|------|
| `src/app/account/page.tsx` | 新增 | server component；`requireSession()` 後渲染表單，帶入初始姓名/email |
| `src/app/account/layout.tsx` | 新增 | 極簡置中版面 + 返回連結（`/account` 在 route group 外，需自己的 layout） |
| `src/app/account/account-form.tsx` | 新增 | client；三個區塊：姓名 / Email / 密碼 |
| `src/app/account/actions.ts` | 新增 | 三個 server actions |
| `src/lib/auth/get-session.ts` | 修改 | `Session` 型別加 `displayName: string \| null`，由 `user.user_metadata.full_name` 取得 |
| `src/app/(tenant)/layout.tsx` | 修改 | 側欄使用者卡顯示姓名 + email，整塊連到 `/account` |
| `src/app/(tenant)/mobile-sidebar.tsx` | 修改 | 同上（行動版） |
| `src/app/(customer)/layout.tsx` | 修改 | header 顯示姓名為主、email 縮小，加 `/account` 連結 |
| `src/app/(platform)/layout.tsx` | 修改 | 補登入者姓名 + `/account` 連結 |

`AppError(code, message)` 的 `code` 為自由字串、無集中列舉，新錯誤碼直接於 action 內 `new AppError('CODE', …)` 使用，**不需修改 `src/lib/errors.ts`**。

## 資料流：姓名顯示

- `getSession()` 已呼叫 `auth.getUser()`，多讀 `user.user_metadata.full_name` 放進 `Session.displayName`。**零額外查詢**。
- Header 顯示解析順序：`displayName` → email 的 `@` 前段 → `'使用者'`（永遠不空白）。
- 三個 layout 的使用者區塊統一改為顯示「姓名（主）+ email（次）+ 角色標籤」，整塊點擊連到 `/account`。

## 三個 Server Actions

全部使用 `actionClient`（next-safe-action）+ zod，並先 `requireSession()`。每個 action 只作用在 `session.userId` 自己身上。

### a. `updateDisplayNameAction({ fullName })` — 不需驗身

1. `auth.updateUser({ data: { full_name: fullName } })`
2. 若 `session.role === 'customer'`：同時 `update public.customers set display_name = fullName where id = session.userId`，保持教練端顯示同步。
3. `revalidatePath('/account')`（layout 隨之重繪，header 姓名更新）。

驗證：`fullName` 去頭尾空白後長度 1–60。

### b. `updatePasswordAction({ currentPassword, newPassword })` — 需驗身

1. 以**臨時 client**（anon key、`persistSession:false`、`autoRefreshToken:false`、cookie 讀寫皆 noop）呼叫 `signInWithPassword({ email: session.email, password: currentPassword })` 驗證目前密碼。失敗 → `AppError('INVALID_CURRENT_PASSWORD', '目前密碼不正確')`。此臨時 client 不寫 cookie，**不會污染現有登入 session**。
2. 通過 → 用正式 session client `auth.updateUser({ password: newPassword })`，失敗 → `AppError('PASSWORD_UPDATE_FAILED', …)`。

驗證：`newPassword` 長度 ≥ 6（對齊 `config.toml` `minimum_password_length = 6`）；`newPassword !== currentPassword`。

### c. `updateEmailAction({ currentPassword, newEmail })` — 需驗身，方案1 即時變更

1. 同 b 步驟 1 驗證目前密碼。
2. `createSupabaseAdminClient().auth.admin.updateUserById(session.userId, { email: newEmail, email_confirm: true })` → 不寄信、即時生效。
3. 撞到既有 email → `AppError('EMAIL_TAKEN', '此 email 已被使用')`；其他失敗 → `AppError('EMAIL_UPDATE_FAILED', …)`。
4. 成功後前端提示「請下次以新 email 登入」。

驗證：`newEmail` 為合法 email 且 `!== session.email`。

## 錯誤處理

- 一律 `throw new AppError(code, message)`；`safe-action.ts` 已統一轉成 `{ code, message, details }` 回前端。
- 新增錯誤碼：`INVALID_CURRENT_PASSWORD`、`PASSWORD_UPDATE_FAILED`、`EMAIL_UPDATE_FAILED`、`EMAIL_TAKEN`、`PROFILE_UPDATE_FAILED`。
- 前端每個區塊各自顯示成功 / 失敗訊息，沿用既有 `profile-form.tsx` 的 `useAction` 模式。

## 安全性

- email / 密碼變更強制重輸目前密碼（已確認需求）。
- 目前密碼驗證使用臨時 client，不污染現有 session cookie。
- email 變更走 admin API，僅在 server action 內、`requireSession()` 之後執行，service role key 不外洩到前端。
- action 只能改自己（`session.userId`）；管理「他人帳號」不在本次範圍。
- 不放寬任何 RLS；不新增資料表。

## 測試

整合測試（`tests/integration/`）：

- 改名：`updateDisplayNameAction` 寫入 `user_metadata.full_name`；當角色為 customer 時同步寫入 `customers.display_name`。
- 密碼：錯誤的目前密碼被 `INVALID_CURRENT_PASSWORD` 擋下；正確時密碼成功變更（事後可用新密碼 signIn 驗證）。
- Email：錯誤目前密碼被擋；正確時 email 即時變更；撞既有 email 回 `EMAIL_TAKEN`。
- displayName 解析：`full_name` 存在時用之；不存在時 fallback 到 email 前段。

## 待辦（非本次範圍）

- 等 email 寄信管道上線後，將 email 變更從「管理員 API 即時變更（方案1）」改為「標準確認信流程（方案2）」：寄確認連結到新信箱，確認後才生效；視情況開啟 `double_confirm_changes`（新舊信箱雙確認）。
- 既有 customer 若只有 `customers.display_name`、尚無 `user_metadata.full_name`：header 已有 fallback，可不立即 backfill；首次在 `/account` 存檔即會同步。如需立即一致，可另做一次性 backfill（選配）。
