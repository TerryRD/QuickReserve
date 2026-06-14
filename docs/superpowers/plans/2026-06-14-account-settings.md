# 個人帳號設定（Account Settings）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓登入者在三種角色介面（教練側欄／學員 header／平台後台）看到自己的姓名，並新增共用 `/account` 頁可自助修改姓名、email、密碼。

**Architecture:** 姓名存於 Supabase Auth `user_metadata.full_name`（零新表、零 migration）；`getSession()` 多帶 `displayName`。`/account` 為 route group 外的共用頁，三個 server actions 各自處理姓名／密碼／email；改密碼與改 email 前以臨時 client 驗證目前密碼，email 變更走 service-role admin API 即時生效。customer 改名時同步寫入 `customers.display_name`。

**Tech Stack:** Next.js App Router、next-safe-action、zod、Supabase Auth（`@supabase/ssr`）、vitest、Tailwind、sonner、lucide-react。

**測試前置：** 整合測試需本機 Supabase 在跑且 `.env`（`NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY`）已設定，跑法 `npm run test:integration`。單元測試走 `npm test`。

**架構限制（重要）：** server actions 內部呼叫 `requireSession()` → `next/headers` 的 `cookies()`，在 vitest node 環境無法執行。因此本計畫對「可測的 primitive」（純函式、`verifyCurrentPassword`、admin email 變更、customers RLS 自我更新）寫自動化測試；三個 action 的包裝層以執行 app 手動驗證（Task 8 列出手動驗證清單）。

---

## File Structure

| 檔案 | 動作 | 責任 |
|------|------|------|
| `src/lib/auth/display-name.ts` | 新增 | `resolveDisplayName()` 純函式：姓名顯示 fallback 邏輯 |
| `tests/unit/display-name.test.ts` | 新增 | `resolveDisplayName` 單元測試 |
| `src/lib/auth/get-session.ts` | 修改 | `Session` 加 `displayName`，由 `user.user_metadata.full_name` 取得 |
| `src/lib/auth/verify-password.ts` | 新增 | `verifyCurrentPassword()`：臨時 client 驗證目前密碼，不污染 session |
| `tests/integration/account-verify-password.test.ts` | 新增 | `verifyCurrentPassword` 整合測試 |
| `src/app/account/actions.ts` | 新增 | `updateDisplayNameAction` / `updatePasswordAction` / `updateEmailAction` |
| `tests/integration/account-primitives.test.ts` | 新增 | 驗證 actions 依賴的 DB primitive：customers 自我更新、admin email 變更、email 撞號 |
| `src/components/shell/account-chip.tsx` | 新增 | 共用「目前登入者」晶片（姓名+email），連到 `/account` |
| `src/app/account/account-form.tsx` | 新增 | client 表單：三區塊（姓名／Email／密碼） |
| `src/app/account/layout.tsx` | 新增 | `/account` 極簡置中版面 + 返回連結 |
| `src/app/account/page.tsx` | 新增 | server component，`requireSession()` 後渲染表單 |
| `src/app/(tenant)/layout.tsx` | 修改 | 側欄底部加 AccountChip |
| `src/app/(tenant)/mobile-sidebar.tsx` | 修改 | 收 `displayName`/`email` props，加 AccountChip |
| `src/app/(customer)/layout.tsx` | 修改 | header 改顯示姓名為主、連 `/account` |
| `src/app/(platform)/layout.tsx` | 修改 | 側欄底部加 AccountChip |
| `README.md` | 修改 | 補帳號設定功能說明 |

`AppError(code, message)` 的 `code` 為自由字串、無集中列舉，新碼直接 `new AppError('CODE', …)`，**不需改 `src/lib/errors.ts`**。

---

## Task 1: `resolveDisplayName` 純函式 + 單元測試

**Files:**
- Create: `src/lib/auth/display-name.ts`
- Test: `tests/unit/display-name.test.ts`

- [ ] **Step 1: 寫失敗測試**

`tests/unit/display-name.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { resolveDisplayName } from '@/lib/auth/display-name'

describe('resolveDisplayName', () => {
  it('uses full display name when present', () => {
    expect(resolveDisplayName({ displayName: '王小明', email: 'a@b.com' })).toBe('王小明')
  })
  it('trims whitespace-only display name and falls back to email local part', () => {
    expect(resolveDisplayName({ displayName: '   ', email: 'coach@example.com' })).toBe('coach')
  })
  it('falls back to email local part when no display name', () => {
    expect(resolveDisplayName({ displayName: null, email: 'coach@example.com' })).toBe('coach')
  })
  it('uses raw email when it has no @ somehow', () => {
    expect(resolveDisplayName({ displayName: null, email: 'weird' })).toBe('weird')
  })
  it('returns 使用者 when nothing is available', () => {
    expect(resolveDisplayName({ displayName: null, email: null })).toBe('使用者')
  })
})
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npm test -- tests/unit/display-name.test.ts`
Expected: FAIL（`Cannot find module '@/lib/auth/display-name'`）

- [ ] **Step 3: 寫最小實作**

`src/lib/auth/display-name.ts`:
```ts
/**
 * 決定畫面上要顯示的登入者名稱。
 * 順序：使用者填的姓名 → email 的 @ 前段 → email 原文 → '使用者'（永不為空）。
 */
export function resolveDisplayName(input: {
  displayName?: string | null
  email?: string | null
}): string {
  const name = input.displayName?.trim()
  if (name) return name
  const email = input.email?.trim()
  if (email && email.includes('@')) return email.split('@')[0]
  if (email) return email
  return '使用者'
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npm test -- tests/unit/display-name.test.ts`
Expected: PASS（5 passed）

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/display-name.ts tests/unit/display-name.test.ts
git commit -m "feat(account): add resolveDisplayName helper for header display"
```

---

## Task 2: `Session` 加 `displayName`

**Files:**
- Modify: `src/lib/auth/get-session.ts:11-17`（型別）、`:53-59`（回傳）

- [ ] **Step 1: 修改 Session 型別**

`src/lib/auth/get-session.ts`，把 `Session` 改為：
```ts
export type Session = {
  userId: string
  email: string | null
  displayName: string | null
  role: AppUserRole
  tenantId: string | null
  memberId: string | null
}
```

- [ ] **Step 2: 在 getSession 回傳帶入 displayName**

同檔 `getSession()` 的 `return`（原 `:53-59`）改為：
```ts
  return {
    userId: user.id,
    email: user.email ?? null,
    displayName:
      (typeof user.user_metadata?.full_name === 'string'
        ? user.user_metadata.full_name.trim()
        : '') || null,
    role,
    tenantId,
    memberId,
  }
```

- [ ] **Step 3: 型別檢查**

Run: `npm run typecheck`
Expected: PASS（無錯誤；`requireSession`/`requireTenantMember` 等回傳型別自動帶上新欄位）

- [ ] **Step 4: Commit**

```bash
git add src/lib/auth/get-session.ts
git commit -m "feat(account): expose displayName on Session from user_metadata"
```

---

## Task 3: `verifyCurrentPassword` 助手 + 整合測試

**Files:**
- Create: `src/lib/auth/verify-password.ts`
- Test: `tests/integration/account-verify-password.test.ts`

- [ ] **Step 1: 寫失敗測試**

`tests/integration/account-verify-password.test.ts`:
```ts
// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import { verifyCurrentPassword } from '@/lib/auth/verify-password'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const admin = createClient<Database>(SUPABASE_URL, SERVICE_KEY)

const email = `acct-verify-${Date.now()}@example.com`
const password = 'TestPass123!'
let userId: string | undefined

describe('verifyCurrentPassword', () => {
  beforeAll(async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (error || !data?.user) throw new Error(`create user failed: ${error?.message}`)
    userId = data.user.id
  })

  afterAll(async () => {
    if (userId) await admin.auth.admin.deleteUser(userId)
  })

  it('returns true for the correct password', async () => {
    expect(await verifyCurrentPassword(email, password)).toBe(true)
  })

  it('returns false for a wrong password', async () => {
    expect(await verifyCurrentPassword(email, 'WrongPass999!')).toBe(false)
  })
})
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npm run test:integration -- tests/integration/account-verify-password.test.ts`
Expected: FAIL（`Cannot find module '@/lib/auth/verify-password'`）

- [ ] **Step 3: 寫最小實作**

`src/lib/auth/verify-password.ts`:
```ts
import { createServerClient } from '@supabase/ssr'
import type { Database } from '@/lib/supabase/types'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * 驗證 email + 密碼是否正確，用於敏感操作（改密碼 / 改 email）前的再驗身。
 * 使用不寫 cookie、不持久化的臨時 client，避免污染呼叫者目前的登入 session。
 */
export async function verifyCurrentPassword(email: string, password: string): Promise<boolean> {
  const client = createServerClient<Database>(url, anonKey, {
    cookies: { getAll: () => [], setAll: () => {} },
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error } = await client.auth.signInWithPassword({ email, password })
  return !error
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npm run test:integration -- tests/integration/account-verify-password.test.ts`
Expected: PASS（2 passed）

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/verify-password.ts tests/integration/account-verify-password.test.ts
git commit -m "feat(account): add verifyCurrentPassword for sensitive-op reauth"
```

---

## Task 4: DB primitive 整合測試（customers 自我更新 + admin email 變更）

> 先用測試把 actions 依賴的資料層行為釘住；action 包裝層在 Task 5–6 實作、Task 8 手動驗證。

**Files:**
- Test: `tests/integration/account-primitives.test.ts`

- [ ] **Step 1: 寫測試**

`tests/integration/account-primitives.test.ts`:
```ts
// @vitest-environment node
import WebSocket from 'ws'
if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket
}
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const admin = createClient<Database>(SUPABASE_URL, SERVICE_KEY)

const ts = Date.now()
const custEmail = `acct-cust-${ts}@example.com`
const password = 'TestPass123!'
const otherEmail = `acct-other-${ts}@example.com`
let custId: string | undefined
let otherId: string | undefined

describe('account settings DB primitives', () => {
  beforeAll(async () => {
    const { data: c, error: cErr } = await admin.auth.admin.createUser({
      email: custEmail,
      password,
      email_confirm: true,
    })
    if (cErr || !c?.user) throw new Error(`create cust failed: ${cErr?.message}`)
    custId = c.user.id
    // 對應 customers 列（一般情境由 booking RPC 建立，這裡直接建）
    const { error: insErr } = await admin
      .from('customers')
      .insert({ id: custId, display_name: '舊名字' })
    if (insErr) throw new Error(`insert customer failed: ${insErr.message}`)

    const { data: o, error: oErr } = await admin.auth.admin.createUser({
      email: otherEmail,
      password,
      email_confirm: true,
    })
    if (oErr || !o?.user) throw new Error(`create other failed: ${oErr?.message}`)
    otherId = o.user.id
  })

  afterAll(async () => {
    if (custId) await admin.auth.admin.deleteUser(custId)
    if (otherId) await admin.auth.admin.deleteUser(otherId)
  })

  it('customer can update own customers.display_name under RLS', async () => {
    const client = createClient<Database>(SUPABASE_URL, ANON_KEY)
    const { error: signErr } = await client.auth.signInWithPassword({
      email: custEmail,
      password,
    })
    expect(signErr).toBeNull()
    const { error } = await client.from('customers').update({ display_name: '新名字' }).eq('id', custId!)
    expect(error).toBeNull()
    const { data } = await admin.from('customers').select('display_name').eq('id', custId!).single()
    expect(data?.display_name).toBe('新名字')
  })

  it('admin updateUserById changes email instantly with email_confirm', async () => {
    const newEmail = `acct-cust-changed-${ts}@example.com`
    const { error } = await admin.auth.admin.updateUserById(custId!, {
      email: newEmail,
      email_confirm: true,
    })
    expect(error).toBeNull()
    const { data } = await admin.auth.admin.getUserById(custId!)
    expect(data.user?.email).toBe(newEmail)
  })

  it('admin updateUserById rejects an email already in use', async () => {
    const { error } = await admin.auth.admin.updateUserById(custId!, {
      email: otherEmail,
      email_confirm: true,
    })
    expect(error).not.toBeNull()
  })
})
```

- [ ] **Step 2: 跑測試確認通過**

Run: `npm run test:integration -- tests/integration/account-primitives.test.ts`
Expected: PASS（3 passed）。確認資料層行為符合 action 設計（customer RLS 自我更新可行、admin email 即時變更可行、撞號會回錯）。

- [ ] **Step 3: Commit**

```bash
git add tests/integration/account-primitives.test.ts
git commit -m "test(account): pin DB primitives for account settings actions"
```

---

## Task 5: Server actions — 姓名 + 密碼

**Files:**
- Create: `src/app/account/actions.ts`

- [ ] **Step 1: 建立 actions 檔，實作改姓名與改密碼**

`src/app/account/actions.ts`:
```ts
'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { actionClient } from '@/lib/safe-action'
import { requireSession } from '@/lib/auth/get-session'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server'
import { verifyCurrentPassword } from '@/lib/auth/verify-password'
import { AppError } from '@/lib/errors'

const DisplayNameSchema = z.object({
  fullName: z.string().trim().min(1, '請填姓名').max(60),
})

export const updateDisplayNameAction = actionClient
  .inputSchema(DisplayNameSchema)
  .action(async ({ parsedInput }) => {
    const session = await requireSession()
    const supabase = await createSupabaseServerClient()

    const { error } = await supabase.auth.updateUser({
      data: { full_name: parsedInput.fullName },
    })
    if (error) throw new AppError('PROFILE_UPDATE_FAILED', error.message)

    // customer 的姓名另存在 customers.display_name（教練端清單顯示來源），保持同步
    if (session.role === 'customer') {
      const { error: cErr } = await supabase
        .from('customers')
        .update({ display_name: parsedInput.fullName })
        .eq('id', session.userId)
      if (cErr) throw new AppError('PROFILE_UPDATE_FAILED', cErr.message)
    }

    revalidatePath('/account')
    return { ok: true, fullName: parsedInput.fullName }
  })

const PasswordSchema = z
  .object({
    currentPassword: z.string().min(1, '請輸入目前密碼'),
    newPassword: z.string().min(6, '新密碼至少 6 個字'),
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ['newPassword'],
    message: '新密碼不可與目前密碼相同',
  })

export const updatePasswordAction = actionClient
  .inputSchema(PasswordSchema)
  .action(async ({ parsedInput }) => {
    const session = await requireSession()
    if (!session.email) throw new AppError('PASSWORD_UPDATE_FAILED', '帳號缺少 email')

    const ok = await verifyCurrentPassword(session.email, parsedInput.currentPassword)
    if (!ok) throw new AppError('INVALID_CURRENT_PASSWORD', '目前密碼不正確')

    const supabase = await createSupabaseServerClient()
    const { error } = await supabase.auth.updateUser({ password: parsedInput.newPassword })
    if (error) throw new AppError('PASSWORD_UPDATE_FAILED', error.message)

    return { ok: true }
  })
```

- [ ] **Step 2: 型別檢查**

Run: `npm run typecheck`
Expected: PASS（`createSupabaseAdminClient` 雖已 import 但於 Task 6 使用；若 lint 報未使用，Task 6 會用到——本步驟暫以 typecheck 為準，typecheck 不會因未使用 import 失敗）

> 註：若專案 lint 對未使用 import 報錯，先不要 import `createSupabaseAdminClient`，等 Task 6 加上 `updateEmailAction` 時再一起 import。執行者請視 `npm run lint` 結果調整 import 行。

- [ ] **Step 3: Commit**

```bash
git add src/app/account/actions.ts
git commit -m "feat(account): add updateDisplayName and updatePassword actions"
```

---

## Task 6: Server action — Email 即時變更

**Files:**
- Modify: `src/app/account/actions.ts`（append）

- [ ] **Step 1: 追加 updateEmailAction**

在 `src/app/account/actions.ts` 末端加上：
```ts
const EmailSchema = z.object({
  currentPassword: z.string().min(1, '請輸入目前密碼'),
  newEmail: z.string().trim().email('email 格式不正確'),
})

export const updateEmailAction = actionClient
  .inputSchema(EmailSchema)
  .action(async ({ parsedInput }) => {
    const session = await requireSession()
    if (!session.email) throw new AppError('EMAIL_UPDATE_FAILED', '帳號缺少 email')
    if (parsedInput.newEmail.toLowerCase() === session.email.toLowerCase()) {
      throw new AppError('EMAIL_UPDATE_FAILED', '新 email 與目前相同')
    }

    const ok = await verifyCurrentPassword(session.email, parsedInput.currentPassword)
    if (!ok) throw new AppError('INVALID_CURRENT_PASSWORD', '目前密碼不正確')

    // 無可靠寄信管道 → 用 service-role admin API 即時變更、不寄確認信
    const admin = createSupabaseAdminClient()
    const { error } = await admin.auth.admin.updateUserById(session.userId, {
      email: parsedInput.newEmail,
      email_confirm: true,
    })
    if (error) {
      const msg = error.message.toLowerCase()
      if (msg.includes('already') || msg.includes('exists') || msg.includes('registered')) {
        throw new AppError('EMAIL_TAKEN', '此 email 已被使用')
      }
      throw new AppError('EMAIL_UPDATE_FAILED', error.message)
    }

    revalidatePath('/account')
    return { ok: true, newEmail: parsedInput.newEmail }
  })
```

- [ ] **Step 2: 型別檢查 + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS（`createSupabaseAdminClient` 此時已被使用）

- [ ] **Step 3: Commit**

```bash
git add src/app/account/actions.ts
git commit -m "feat(account): add updateEmail action (admin instant change)"
```

---

## Task 7: `/account` 頁面、版面、表單

**Files:**
- Create: `src/app/account/layout.tsx`
- Create: `src/app/account/account-form.tsx`
- Create: `src/app/account/page.tsx`

- [ ] **Step 1: 建立 layout**

`src/app/account/layout.tsx`:
```tsx
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-5 py-8 sm:py-12">
        <Link
          href="/"
          className="font-mono inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          返回
        </Link>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 建立 client 表單**

`src/app/account/account-form.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  updateDisplayNameAction,
  updatePasswordAction,
  updateEmailAction,
} from './actions'

const inputClass = 'font-cjk h-11 rounded-xl border-2 border-border bg-background px-4 text-sm'

function Section({
  title,
  eng,
  hint,
  children,
}: {
  title: string
  eng: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        {eng}
      </div>
      <h2 className="font-display font-cjk mt-1 text-xl font-black uppercase">{title}</h2>
      {hint && <p className="font-cjk mt-1 text-sm text-muted-foreground">{hint}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  )
}

export default function AccountForm({
  initialName,
  email,
}: {
  initialName: string
  email: string
}) {
  // --- 姓名 ---
  const [fullName, setFullName] = useState(initialName)
  const nameAction = useAction(updateDisplayNameAction, {
    onSuccess: () => toast.success('姓名已更新'),
    onError: ({ error }) => toast.error(error.serverError?.message ?? '更新失敗'),
  })

  // --- 密碼 ---
  const [curPw, setCurPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const pwAction = useAction(updatePasswordAction, {
    onSuccess: () => {
      toast.success('密碼已更新')
      setCurPw('')
      setNewPw('')
    },
    onError: ({ error }) => toast.error(error.serverError?.message ?? '更新失敗'),
  })

  // --- Email ---
  const [emailPw, setEmailPw] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const emailAction = useAction(updateEmailAction, {
    onSuccess: ({ data }) => {
      toast.success(`Email 已改為 ${data?.newEmail ?? ''}，下次請用新 email 登入`)
      setEmailPw('')
      setNewEmail('')
    },
    onError: ({ error }) => toast.error(error.serverError?.message ?? '更新失敗'),
  })

  return (
    <div className="space-y-6">
      <div>
        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          ACCOUNT · 個人帳號
        </div>
        <h1 className="font-display font-cjk mt-1 text-3xl font-black uppercase">帳號設定</h1>
        <p className="font-cjk mt-1 text-sm text-muted-foreground">
          目前登入：<span className="font-medium text-foreground">{email}</span>
        </p>
      </div>

      <Section title="姓名" eng="NAME" hint="顯示在側欄/頂部，代表目前登入的你。">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            nameAction.execute({ fullName })
          }}
          className="space-y-3"
        >
          <Label htmlFor="fullName" className="font-mono text-[11px] uppercase tracking-wider">
            姓名
          </Label>
          <Input
            id="fullName"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={inputClass}
          />
          <Button type="submit" size="pill" disabled={nameAction.isPending || !fullName.trim()}>
            {nameAction.isPending ? '儲存中…' : '儲存姓名'}
          </Button>
        </form>
      </Section>

      <Section title="變更密碼" eng="PASSWORD" hint="需先輸入目前密碼以驗證身分。">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            pwAction.execute({ currentPassword: curPw, newPassword: newPw })
          }}
          className="space-y-3"
        >
          <Label htmlFor="curPw" className="font-mono text-[11px] uppercase tracking-wider">
            目前密碼
          </Label>
          <Input
            id="curPw"
            type="password"
            autoComplete="current-password"
            value={curPw}
            onChange={(e) => setCurPw(e.target.value)}
            className={inputClass}
          />
          <Label htmlFor="newPw" className="font-mono text-[11px] uppercase tracking-wider">
            新密碼（至少 6 字）
          </Label>
          <Input
            id="newPw"
            type="password"
            autoComplete="new-password"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            className={inputClass}
          />
          <Button
            type="submit"
            size="pill"
            disabled={pwAction.isPending || !curPw || newPw.length < 6}
          >
            {pwAction.isPending ? '更新中…' : '更新密碼'}
          </Button>
        </form>
      </Section>

      <Section
        title="變更 Email"
        eng="EMAIL"
        hint="email 是登入帳號。變更後即時生效，請改用新 email 登入。需先輸入目前密碼。"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            emailAction.execute({ currentPassword: emailPw, newEmail })
          }}
          className="space-y-3"
        >
          <Label htmlFor="emailPw" className="font-mono text-[11px] uppercase tracking-wider">
            目前密碼
          </Label>
          <Input
            id="emailPw"
            type="password"
            autoComplete="current-password"
            value={emailPw}
            onChange={(e) => setEmailPw(e.target.value)}
            className={inputClass}
          />
          <Label htmlFor="newEmail" className="font-mono text-[11px] uppercase tracking-wider">
            新 Email
          </Label>
          <Input
            id="newEmail"
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className={inputClass}
          />
          <Button
            type="submit"
            size="pill"
            disabled={emailAction.isPending || !emailPw || !newEmail.trim()}
          >
            {emailAction.isPending ? '更新中…' : '更新 Email'}
          </Button>
        </form>
      </Section>
    </div>
  )
}
```

- [ ] **Step 3: 建立 page**

`src/app/account/page.tsx`:
```tsx
import { requireSession } from '@/lib/auth/get-session'
import AccountForm from './account-form'

export default async function AccountPage() {
  const session = await requireSession()
  return (
    <AccountForm initialName={session.displayName ?? ''} email={session.email ?? ''} />
  )
}
```

- [ ] **Step 4: 型別檢查 + build**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 5: 手動驗證頁面渲染**

啟動 `npm run dev`，登入後開 `/account`，確認三個區塊都顯示、`目前登入：<你的 email>` 正確。

- [ ] **Step 6: Commit**

```bash
git add src/app/account/layout.tsx src/app/account/account-form.tsx src/app/account/page.tsx
git commit -m "feat(account): add /account settings page with name/email/password forms"
```

---

## Task 8: 把「目前登入者」接進三個 shell

**Files:**
- Create: `src/components/shell/account-chip.tsx`
- Modify: `src/app/(tenant)/layout.tsx`、`src/app/(tenant)/mobile-sidebar.tsx`、`src/app/(customer)/layout.tsx`、`src/app/(platform)/layout.tsx`

- [ ] **Step 1: 建立共用 AccountChip**

`src/components/shell/account-chip.tsx`:
```tsx
import Link from 'next/link'
import { resolveDisplayName } from '@/lib/auth/display-name'

/**
 * 顯示目前登入者（姓名 + email），整塊連到 /account。
 * tone='sidebar' 用於深色側欄；tone='light' 用於淺色 header。
 */
export function AccountChip({
  displayName,
  email,
  roleLabel,
  tone = 'sidebar',
}: {
  displayName: string | null
  email: string | null
  roleLabel?: string
  tone?: 'sidebar' | 'light'
}) {
  const name = resolveDisplayName({ displayName, email })
  const initial = name.slice(0, 1).toUpperCase()

  if (tone === 'light') {
    return (
      <Link
        href="/account"
        className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-slate-100"
      >
        <div className="grid size-7 shrink-0 place-items-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">
          {initial}
        </div>
        <div className="min-w-0 leading-tight">
          <div className="truncate text-sm font-medium text-slate-800">{name}</div>
          {email && <div className="truncate text-[11px] text-slate-400">{email}</div>}
        </div>
      </Link>
    )
  }

  return (
    <Link
      href="/account"
      className="flex items-center gap-3 rounded-xl border border-sidebar-border bg-sidebar-accent p-3 transition-colors hover:brightness-110"
    >
      <div className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
        <span className="font-display text-base">{initial}</span>
      </div>
      <div className="min-w-0 flex-1 leading-tight">
        <div className="font-cjk truncate text-sm font-semibold">{name}</div>
        {email && <div className="truncate text-[11px] opacity-70">{email}</div>}
        {roleLabel && (
          <div className="font-mono mt-0.5 text-[9px] uppercase tracking-wider opacity-60">
            {roleLabel}
          </div>
        )}
      </div>
    </Link>
  )
}
```

- [ ] **Step 2: 接進 tenant 桌面側欄**

`src/app/(tenant)/layout.tsx`：
1. 頂部 import 加：`import { AccountChip } from '@/components/shell/account-chip'`
2. 把底部區塊（原 `:83-104`，含公開頁連結／ThemeToggle／登出的外層 `<div className="space-y-2 border-t border-sidebar-border p-3">`）的**第一個子元素前**插入 AccountChip：
```tsx
        <div className="space-y-2 border-t border-sidebar-border p-3">
          <AccountChip
            displayName={session.displayName}
            email={session.email}
            roleLabel={roleLabel}
          />
          <Link
            href={`/${tenant.slug}`}
            target="_blank"
            ...（保留原本的公開頁連結／ThemeToggle／登出 form 不動）
```

- [ ] **Step 3: 把 displayName/email 傳進 MobileSidebar**

同檔 `<MobileSidebar ... />`（原 `:40-45`）加上兩個 props：
```tsx
      <MobileSidebar
        tenantName={tenant.name}
        tenantSlug={tenant.slug}
        roleLabel={roleLabel}
        isOwner={isOwner}
        displayName={session.displayName}
        email={session.email}
      />
```

- [ ] **Step 4: MobileSidebar 接收 props 並渲染 AccountChip**

`src/app/(tenant)/mobile-sidebar.tsx`：
1. import 加：`import { AccountChip } from '@/components/shell/account-chip'`
2. props 型別與解構加入 `displayName: string | null` 與 `email: string | null`
3. 在底部 `<div className="border-t border-sidebar-border p-3">`（原 `:53`）內、公開頁連結**之前**插入：
```tsx
            <div className="pb-2">
              <AccountChip displayName={displayName} email={email} roleLabel={roleLabel} />
            </div>
```
（`onNavigate`/`close` 不需傳給 chip；點連結會整頁導航到 /account）

- [ ] **Step 5: customer header 改顯示姓名**

`src/app/(customer)/layout.tsx`：
1. import 加：`import { AccountChip } from '@/components/shell/account-chip'`
2. 把原本的 `<span className="hidden text-xs text-slate-500 sm:inline">{session.email}</span>`（原 `:19`）換成：
```tsx
            <AccountChip displayName={session.displayName} email={session.email} tone="light" />
```

- [ ] **Step 6: platform 側欄加 AccountChip**

`src/app/(platform)/layout.tsx`：
1. import 加：`import { AccountChip } from '@/components/shell/account-chip'`
2. `requirePlatformAdmin()` 回傳即 session，改為 `const session = await requirePlatformAdmin()`
3. 底部 `<div className="space-y-2 border-t border-sidebar-border p-3">`（原 `:42`）內、ThemeToggle **之前**插入：
```tsx
          <AccountChip displayName={session.displayName} email={session.email} roleLabel="Platform Admin" />
```

- [ ] **Step 7: 型別檢查 + build**

Run: `npm run typecheck && npm run build`
Expected: PASS

- [ ] **Step 8: 手動驗證三角色 + 三個 action**

啟動 `npm run dev`，逐一驗證：
- 教練(owner/staff) 桌面側欄底部、行動側欄、學員 header、平台後台側欄都看到「姓名 + email」晶片，點擊進入 `/account`。
- `/account` 改姓名 → 側欄/頂部姓名隨之更新（customer 另檢查教練端學員清單名字也變）。
- 改密碼：錯誤目前密碼被擋（toast「目前密碼不正確」）；正確 → 成功 → 登出後用新密碼可登入。
- 改 email：錯誤目前密碼被擋；正確 → 成功 → 登出後用新 email 登入；輸入別人已用的 email → toast「此 email 已被使用」。

- [ ] **Step 9: Commit**

```bash
git add src/components/shell/account-chip.tsx \
  "src/app/(tenant)/layout.tsx" "src/app/(tenant)/mobile-sidebar.tsx" \
  "src/app/(customer)/layout.tsx" "src/app/(platform)/layout.tsx"
git commit -m "feat(account): show logged-in user chip across tenant/customer/platform shells"
```

---

## Task 9: 文件更新

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 在 README 補功能說明**

於 README 適當章節（功能列表 / 帳號相關）加入：
```markdown
### 個人帳號設定（/account）
- 所有登入者（教練/助教、學員、平台管理員）可在 `/account` 自助修改：
  - **姓名**：顯示於各介面側欄/頂部；存於 Supabase Auth `user_metadata.full_name`，學員另同步 `customers.display_name`。
  - **密碼**：需先驗證目前密碼。
  - **Email**：登入帳號，需先驗證目前密碼；目前以管理員 API 即時變更（不寄確認信）。
- 待辦：待 email 寄信管道上線後，email 變更改走標準確認信流程。
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs(account): document /account self-service settings"
```

---

## Self-Review 結果

- **Spec coverage：** 顯示姓名（Task 1/2/8）、姓名儲存於 user_metadata + customer 同步（Task 5）、改密碼驗身（Task 3/5）、email 即時變更驗身（Task 3/6）、三角色 header（Task 8）、測試（Task 1/3/4）、待辦記錄（Task 9 + spec）皆有對應任務。
- **架構限制誠實標明：** server action 無法在 vitest 直測，故測 primitive + 手動驗證 action 包裝（Task 4/8）。
- **型別一致：** `resolveDisplayName({displayName,email})` 簽名於 Task 1 定義、Task 8 使用一致；`Session.displayName`（Task 2）於 Task 5/6/7/8 使用一致；action 名稱 `updateDisplayNameAction`/`updatePasswordAction`/`updateEmailAction` 跨 Task 5/6/7 一致。
- **lint 注意：** Task 5 提醒 `createSupabaseAdminClient` 於 Task 6 才實際使用，依 `npm run lint` 結果決定 import 時機。
