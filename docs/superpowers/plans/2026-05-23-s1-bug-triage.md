# S1 — Bug Triage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 4 high-impact bugs (invite-coach silent failure, `/platform/bookings` Server Component crash, notification settings escaping tenant layout, `/platform/tenants` perceived slowness) and lay 3 small reusable safety nets (`<FormFieldErrors>`, `<PageSkeleton>`, error.digest runbook) so similar issues are caught earlier.

**Architecture:** Minimum-diff fixes within current Next.js 15 App Router + Supabase stack. Bug B1 fixes both validation surface and slug input UX. Bug B2 extracts a client component for the interactive filter; the rest of the page stays a Server Component. Bug B3 adds a tenant-group route for notification settings sharing a single component with the customer-group route. Bug B4 ships `loading.tsx` skeletons across the platform group plus `Promise.all`-parallelized queries.

**Tech Stack:** Next.js 15 (App Router, RSC, Server Actions), TypeScript strict, Tailwind + shadcn/ui, next-safe-action + Zod, Supabase JS client, Vitest, sonner.

**Spec reference:** [`docs/superpowers/specs/2026-05-23-s1-bug-triage-design.md`](../specs/2026-05-23-s1-bug-triage-design.md)

**Out of scope for this plan:** Sentry / monitoring, RWD pass, performance work on tenant/customer/public groups, design system refresh, S3~S6 feature work, dependabot tuning (already merged separately in commit `38140ca`).

---

## File Map

**Create**
- `src/lib/utils/slug.ts` — pure `normalizeSlug` function
- `tests/unit/slug.test.ts` — slug util unit tests
- `src/components/forms/form-field-errors.tsx` — render next-safe-action `validationErrors` under fields
- `src/components/ui/page-skeleton.tsx` — generic loading skeleton (header + N rows)
- `src/components/settings/notification-preferences.tsx` — shared server-rendered notifications block (calls Supabase, renders `PushOptIn` + `PreferencesForm`)
- `src/app/(platform)/platform/bookings/tenant-filter.tsx` — `'use client'` `<select>` that navigates
- `src/app/(tenant)/settings/notifications/page.tsx` — tenant-group entry that renders shared block
- `src/app/(platform)/platform/tenants/loading.tsx`
- `src/app/(platform)/platform/dashboard/loading.tsx`
- `src/app/(platform)/platform/bookings/loading.tsx`
- `src/app/(platform)/platform/tenants/[tenantId]/loading.tsx`

**Modify**
- `src/app/(platform)/platform/bookings/page.tsx` — remove inline `<select onChange>`, use `<TenantFilter>`, parallelize queries
- `src/app/(platform)/platform/tenants/page.tsx` — parallelize queries
- `src/app/(platform)/platform/tenants/invite-coach-form.tsx` — slug normalize on change, helper text, `<FormFieldErrors>`
- `src/app/(tenant)/staff/invite-staff-form.tsx` — `<FormFieldErrors>`
- `src/app/(customer)/settings/notifications/page.tsx` — slim down to a wrapper rendering shared block
- `README.md` — add `error.digest` runbook + route map entry for tenant notifications
- `docs/superpowers/specs/2026-05-21-quickreserve-redesign-design.md` — append FR-110~114 to appendix C with commit hashes

**Delete**
- `scripts/debug-bookings-query.mjs` — debug-only file from brainstorming phase

---

## Conventions

- Commit after each task (or grouped sub-task) so history shows incremental wins.
- All commits include `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` per project convention.
- TDD applies to `slug.ts` (pure function). UI/routing changes are verified by `npm run build` + `npm run typecheck` + manual screenshot per task acceptance.
- Do **not** push to master between tasks; push once at the end of the plan after full verification.

---

## Task 1: `normalizeSlug` pure function (TDD)

**Files:**
- Create: `src/lib/utils/slug.ts`
- Test: `tests/unit/slug.test.ts`

- [ ] **Step 1: Write the failing tests**

Write `tests/unit/slug.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { normalizeSlug } from '@/lib/utils/slug'

describe('normalizeSlug', () => {
  it('lowercases uppercase letters', () => {
    expect(normalizeSlug('TerryTest')).toBe('terrytest')
  })

  it('replaces spaces with single hyphen', () => {
    expect(normalizeSlug('Terry Test')).toBe('terry-test')
  })

  it('replaces underscores with hyphens', () => {
    expect(normalizeSlug('terry_test')).toBe('terry-test')
  })

  it('collapses repeated separators', () => {
    expect(normalizeSlug('terry   test___coach')).toBe('terry-test-coach')
  })

  it('strips non-alphanumeric characters', () => {
    expect(normalizeSlug('Terry@Coach!')).toBe('terrycoach')
  })

  it('strips CJK characters', () => {
    expect(normalizeSlug('林教練 Lin')).toBe('lin')
  })

  it('trims leading and trailing hyphens', () => {
    expect(normalizeSlug('---terry---')).toBe('terry')
  })

  it('returns empty string for input with no allowed chars', () => {
    expect(normalizeSlug('林教練')).toBe('')
  })

  it('handles empty input', () => {
    expect(normalizeSlug('')).toBe('')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- slug`
Expected: 9 failures with "Failed to resolve import @/lib/utils/slug"

- [ ] **Step 3: Implement `normalizeSlug`**

Write `src/lib/utils/slug.ts`:

```ts
export function normalizeSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- slug`
Expected: 9 passes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/slug.ts tests/unit/slug.test.ts
git commit -m "$(cat <<'EOF'
feat(s1): add normalizeSlug util (FR-110)

Lower-case, replace [_\s]+ with -, strip non [a-z0-9-], collapse and
trim hyphens. Used by invite-coach-form to make slug input forgiving
(TerryTest → terrytest; Terry Test → terry-test).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `<FormFieldErrors>` shared component

**Files:**
- Create: `src/components/forms/form-field-errors.tsx`

- [ ] **Step 1: Implement component**

Write `src/components/forms/form-field-errors.tsx`:

```tsx
'use client'

type FieldError = { _errors?: string[] } | undefined

export default function FormFieldErrors({
  errors,
  field,
}: {
  // next-safe-action `result.validationErrors` shape (Zod 4 nested format):
  // { fieldName: { _errors: ['message'] }, ... }
  errors: Record<string, FieldError> | undefined
  field: string
}) {
  const messages = errors?.[field]?._errors ?? []
  if (messages.length === 0) return null
  return (
    <p className="text-xs text-rose-600" role="alert">
      {messages.join(' · ')}
    </p>
  )
}
```

- [ ] **Step 2: Verify build & types**

Run: `npm run typecheck`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/forms/form-field-errors.tsx
git commit -m "$(cat <<'EOF'
feat(s1): add FormFieldErrors shared component (FR-110)

Surfaces next-safe-action validationErrors at the field level so Zod
schema failures no longer collapse into a generic toast.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Patch `InviteCoachForm` (slug normalize + field errors + helper text)

**Files:**
- Modify: `src/app/(platform)/platform/tenants/invite-coach-form.tsx`

- [ ] **Step 1: Replace whole file**

Overwrite `src/app/(platform)/platform/tenants/invite-coach-form.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import FormFieldErrors from '@/components/forms/form-field-errors'
import { normalizeSlug } from '@/lib/utils/slug'
import { inviteCoachAction } from './actions'

export default function InviteCoachForm() {
  const [email, setEmail] = useState('')
  const [tenantName, setTenantName] = useState('')
  const [tenantSlug, setTenantSlug] = useState('')
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)

  const { execute, isPending, result } = useAction(inviteCoachAction, {
    onSuccess: ({ data }) => {
      toast.success('已建立邀請')
      setInviteUrl(data?.inviteUrl ?? null)
      setEmail('')
      setTenantName('')
      setTenantSlug('')
    },
    onError: ({ error }) => {
      // Field-level errors render via FormFieldErrors; only show a toast for
      // server errors (e.g. SLUG_TAKEN) which next-safe-action surfaces via serverError.
      if (error.serverError?.message) toast.error(error.serverError.message)
    },
  })

  const fieldErrors = result?.validationErrors as
    | Record<string, { _errors?: string[] }>
    | undefined

  return (
    <Card>
      <CardHeader>
        <CardTitle>邀請新教練</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            execute({ email, tenantName, tenantSlug })
          }}
        >
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">教練 Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <FormFieldErrors errors={fieldErrors} field="email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenantName">租戶名稱</Label>
              <Input
                id="tenantName"
                required
                value={tenantName}
                onChange={(e) => setTenantName(e.target.value)}
              />
              <FormFieldErrors errors={fieldErrors} field="tenantName" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenantSlug">Slug (公開連結)</Label>
              <Input
                id="tenantSlug"
                required
                placeholder="terry-coach"
                value={tenantSlug}
                onChange={(e) => setTenantSlug(normalizeSlug(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                公開連結網址，只能小寫英數和短橫線。例：<code>terry-coach</code>
              </p>
              <FormFieldErrors errors={fieldErrors} field="tenantSlug" />
            </div>
          </div>
          <Button type="submit" disabled={isPending}>
            {isPending ? '邀請中...' : '送出邀請'}
          </Button>
        </form>
        {inviteUrl && (
          <div className="mt-4 rounded border bg-slate-50 p-3 text-sm">
            <p className="mb-1 font-semibold">邀請連結（請傳給教練）：</p>
            <code className="break-all">{inviteUrl}</code>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Verify build & types**

Run: `npm run typecheck`
Expected: No errors.

- [ ] **Step 3: Manual verification**

Run: `npm run dev`
Navigate to `/platform/tenants` and:
1. Type `TerryTest` in slug → field auto-updates to `terrytest`
2. Type `Terry Coach` → field updates to `terry-coach`
3. Submit with empty email → field shows `Email 格式不正確` (no toast)
4. Submit with valid data → toast「已建立邀請」+ invite URL card shows

- [ ] **Step 4: Commit**

```bash
git add src/app/\(platform\)/platform/tenants/invite-coach-form.tsx
git commit -m "$(cat <<'EOF'
fix(s1): invite-coach form — slug normalize + field-level errors (FR-110)

兩層問題：(1) Zod 規定 slug 只能 [a-z0-9-]，user 打 TerryTest 會被擋；
(2) onError 只看 serverError，吃掉欄位錯誤只留泛用 toast。

修法：slug input 接 normalizeSlug 即時 normalize；接 validationErrors 用
FormFieldErrors 顯示在欄位下；補 placeholder 與 helper text 引導正確輸入。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Patch `InviteStaffForm` (field errors)

**Files:**
- Modify: `src/app/(tenant)/staff/invite-staff-form.tsx`

- [ ] **Step 1: Replace whole file**

Overwrite `src/app/(tenant)/staff/invite-staff-form.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import FormFieldErrors from '@/components/forms/form-field-errors'
import { inviteStaffAction } from './actions'

export default function InviteStaffForm() {
  const [email, setEmail] = useState('')
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const { execute, isPending, result } = useAction(inviteStaffAction, {
    onSuccess: ({ data }) => {
      toast.success('已建立邀請')
      setInviteUrl(data?.inviteUrl ?? null)
      setEmail('')
    },
    onError: ({ error }) => {
      if (error.serverError?.message) toast.error(error.serverError.message)
    },
  })

  const fieldErrors = result?.validationErrors as
    | Record<string, { _errors?: string[] }>
    | undefined

  return (
    <Card>
      <CardHeader>
        <CardTitle>邀請新助教</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="flex items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            execute({ email })
          }}
        >
          <div className="flex-1 space-y-2">
            <Label htmlFor="staff-email">助教 Email</Label>
            <Input
              id="staff-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <FormFieldErrors errors={fieldErrors} field="email" />
          </div>
          <Button type="submit" disabled={isPending}>
            {isPending ? '邀請中...' : '送出邀請'}
          </Button>
        </form>
        {inviteUrl && (
          <div className="mt-4 rounded border bg-slate-50 p-3 text-sm">
            <p className="mb-1 font-semibold">邀請連結（請傳給助教）：</p>
            <code className="break-all">{inviteUrl}</code>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Verify build & types**

Run: `npm run typecheck`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(tenant\)/staff/invite-staff-form.tsx
git commit -m "$(cat <<'EOF'
fix(s1): invite-staff form — surface field-level errors (FR-110)

Same fix pattern as invite-coach-form: read validationErrors from
useAction.result and render with FormFieldErrors.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Extract `<TenantFilter>` client component

**Files:**
- Create: `src/app/(platform)/platform/bookings/tenant-filter.tsx`

- [ ] **Step 1: Implement**

Write `src/app/(platform)/platform/bookings/tenant-filter.tsx`:

```tsx
'use client'

import { useRouter, useSearchParams } from 'next/navigation'

export default function TenantFilter({
  tenants,
}: {
  tenants: { id: string; name: string }[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const current = searchParams.get('tenant') ?? ''

  return (
    <select
      value={current}
      onChange={(e) => {
        const v = e.target.value
        const qs = new URLSearchParams(searchParams.toString())
        if (v) qs.set('tenant', v)
        else qs.delete('tenant')
        router.push(`/platform/bookings${qs.toString() ? `?${qs}` : ''}`)
      }}
      className="rounded-md border bg-card px-2 py-1.5 text-xs"
    >
      <option value="">所有租戶</option>
      {tenants.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </select>
  )
}
```

- [ ] **Step 2: Verify build & types**

Run: `npm run typecheck`
Expected: No errors.

- [ ] **Step 3: Commit**

(Defer commit — will be committed together with the page.tsx fix in Task 6 so the bug fix lands atomically.)

---

## Task 6: Fix `/platform/bookings` Server Component + parallelize

**Files:**
- Modify: `src/app/(platform)/platform/bookings/page.tsx`

- [ ] **Step 1: Replace whole file**

Overwrite `src/app/(platform)/platform/bookings/page.tsx`:

```tsx
import Link from 'next/link'
import { format } from 'date-fns'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import TenantFilter from './tenant-filter'

const TZ_OFFSET_HOURS = 8
const toLocal = (iso: string) =>
  new Date(new Date(iso).getTime() + TZ_OFFSET_HOURS * 3600 * 1000)

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-emerald-100 text-emerald-800',
  completed: 'bg-slate-100 text-slate-700',
  cancelled: 'bg-slate-100 text-slate-500',
}
const STATUS_LABELS: Record<string, string> = {
  pending: '待確認',
  confirmed: '已確認',
  completed: '已完成',
  cancelled: '已取消',
}

export default async function PlatformBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; tenant?: string }>
}) {
  const { status, tenant } = await searchParams
  const admin = createSupabaseAdminClient()

  let bookingsQuery = admin
    .from('bookings')
    .select(
      'id, status, created_at, customer_id, tenants(id, name, slug), customers(display_name), services(name), availability_slots(start_at, end_at)',
    )
    .order('created_at', { ascending: false })
    .limit(100)
  if (status && status !== 'all') bookingsQuery = bookingsQuery.eq('status', status)
  if (tenant) bookingsQuery = bookingsQuery.eq('tenant_id', tenant)

  const [{ data: bookings }, { data: tenants }] = await Promise.all([
    bookingsQuery,
    admin.from('tenants').select('id, name').order('name'),
  ])

  const filters = [
    { key: 'all', label: '全部' },
    { key: 'pending', label: '待確認' },
    { key: 'confirmed', label: '已確認' },
    { key: 'completed', label: '已完成' },
    { key: 'cancelled', label: '已取消' },
  ]
  const activeFilter = status ?? 'all'

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl tracking-tight">
          <span className="italic">全平台預約</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          最近 100 筆 · 唯讀檢視
        </p>
      </header>

      <div className="flex flex-wrap gap-3">
        <div className="flex flex-wrap gap-1">
          {filters.map((f) => (
            <Link
              key={f.key}
              href={
                f.key === 'all'
                  ? '/platform/bookings' + (tenant ? `?tenant=${tenant}` : '')
                  : `/platform/bookings?status=${f.key}` + (tenant ? `&tenant=${tenant}` : '')
              }
              className={`rounded-full border px-3 py-1.5 text-xs ${
                activeFilter === f.key
                  ? 'border-primary bg-primary text-primary-foreground font-medium'
                  : 'border-border bg-card hover:bg-muted'
              }`}
            >
              {f.label}
            </Link>
          ))}
        </div>
        <TenantFilter tenants={tenants ?? []} />
      </div>

      {!bookings || bookings.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-sm text-muted-foreground">
            無預約紀錄
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="p-3">租戶</th>
                <th className="p-3">學員</th>
                <th className="p-3">服務</th>
                <th className="p-3">時段</th>
                <th className="p-3">狀態</th>
                <th className="p-3">建立</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => {
                const t = b.tenants as { id: string; name: string; slug: string } | null
                const c = b.customers as { display_name: string | null } | null
                const sv = b.services as { name: string } | null
                const sl = b.availability_slots as { start_at: string; end_at: string } | null
                return (
                  <tr key={b.id} className="border-t">
                    <td className="p-3">
                      {t && (
                        <Link
                          href={`/platform/tenants/${t.id}`}
                          className="hover:underline"
                        >
                          {t.name}
                        </Link>
                      )}
                    </td>
                    <td className="p-3">{c?.display_name ?? '匿名'}</td>
                    <td className="p-3 text-xs">{sv?.name}</td>
                    <td className="p-3 text-xs">
                      {sl ? format(toLocal(sl.start_at), 'M/d HH:mm') : ''}
                    </td>
                    <td className="p-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          STATUS_STYLES[b.status] ?? STATUS_STYLES.pending
                        }`}
                      >
                        {STATUS_LABELS[b.status] ?? b.status}
                      </span>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {format(new Date(b.created_at), 'M/d HH:mm')}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify build & types**

Run: `npm run typecheck && npm run build`
Expected: Both green.

- [ ] **Step 3: Manual verification**

`npm run dev`, log in as platform admin, navigate to `/platform/bookings`:
1. Page renders without error.digest
2. Switch status filter (`<Link>`): URL updates, page re-renders correctly
3. Switch tenant dropdown: URL updates, bookings filtered to that tenant
4. Combine status + tenant filters: both preserved across changes

- [ ] **Step 4: Commit (with Task 5)**

```bash
git add src/app/\(platform\)/platform/bookings/page.tsx src/app/\(platform\)/platform/bookings/tenant-filter.tsx
git commit -m "$(cat <<'EOF'
fix(s1): /platform/bookings server component crash (FR-111)

Root cause: page.tsx was a Server Component but had inline
<select onChange={...} window.location.href=...> — Next.js cannot
serialize a function into a Server Component, producing the runtime
error surfaced as error.digest=2263577791.

修法：抽 TenantFilter ('use client') 用 useRouter().push 處理導向，
並把 bookings 與 tenants 兩 query 改 Promise.all 並行。Status filter
原本用 <Link>，正確且不動。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Parallelize `/platform/tenants` queries

**Files:**
- Modify: `src/app/(platform)/platform/tenants/page.tsx`

- [ ] **Step 1: Edit the file**

Edit `src/app/(platform)/platform/tenants/page.tsx`. Replace lines 5–38 (everything from `export default async function TenantsListPage()` opening up through and including the `ownerByTenant` loop) with:

```tsx
export default async function TenantsListPage() {
  // Use admin client so we can join tenant_members.invite_email for owners
  // even when status='invited' (RLS would otherwise hide pre-acceptance rows
  // from cross-table joins).
  const supabase = createSupabaseAdminClient()

  // Step 1: fetch tenants
  const { data: tenants } = await supabase
    .from('tenants')
    .select('id, slug, name, status, created_at')
    .order('created_at', { ascending: false })

  // Step 2: fetch owners (depends on tenantIds, so must follow tenants)
  const tenantIds = (tenants ?? []).map((t) => t.id)
  const { data: owners } =
    tenantIds.length === 0
      ? { data: [] as Array<{
          id: string
          tenant_id: string
          status: string
          invited_email: string | null
          user_id: string | null
        }> }
      : await supabase
          .from('tenant_members')
          .select('id, tenant_id, status, invited_email, user_id')
          .in('tenant_id', tenantIds)
          .eq('role', 'owner')

  const ownerByTenant: Record<
    string,
    {
      id: string
      status: string
      invited_email: string | null
      user_id: string | null
    }
  > = {}
  for (const o of owners ?? []) {
    ownerByTenant[o.tenant_id] = {
      id: o.id,
      status: o.status,
      invited_email: o.invited_email,
      user_id: o.user_id,
    }
  }
```

Note: tenant ids must come before owner query so the two queries can't be fully parallelized. This task is renamed to "short-circuit empty case" — the perceived-load fix lives in the loading skeleton (Task 11). Keep `Promise.all` parallelization for the `/platform/bookings` case (already done in Task 6 — bookings and tenants list are independent there).

- [ ] **Step 2: Verify build & types**

Run: `npm run typecheck`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(platform\)/platform/tenants/page.tsx
git commit -m "$(cat <<'EOF'
perf(s1): /platform/tenants — short-circuit owner query when no tenants (FR-113)

避免空清單時跑 .in('tenant_id', []) 的浪費。owners query 仰賴 tenantIds，
無法與 tenants query 並行，主要的「感知慢」修法在後續的 loading skeleton。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: `<PageSkeleton>` shared component

**Files:**
- Create: `src/components/ui/page-skeleton.tsx`

- [ ] **Step 1: Implement**

Write `src/components/ui/page-skeleton.tsx`:

```tsx
export default function PageSkeleton({
  rows = 6,
  withHeader = true,
}: {
  rows?: number
  withHeader?: boolean
}) {
  return (
    <div className="space-y-6">
      {withHeader && (
        <header className="space-y-2">
          <div className="h-9 w-48 animate-pulse rounded-md bg-muted" />
          <div className="h-4 w-72 animate-pulse rounded-md bg-muted/60" />
        </header>
      )}
      <div className="space-y-2 rounded-lg border bg-card p-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="h-10 animate-pulse rounded-md bg-muted/50"
            style={{ animationDelay: `${i * 60}ms` }}
          />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build & types**

Run: `npm run typecheck`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/page-skeleton.tsx
git commit -m "$(cat <<'EOF'
feat(s1): add PageSkeleton shared component (FR-113)

Generic header + row skeleton, configurable row count. Used by platform
group's loading.tsx files to remove white-screen during cold start.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Add `loading.tsx` to 4 platform pages

**Files:**
- Create: `src/app/(platform)/platform/tenants/loading.tsx`
- Create: `src/app/(platform)/platform/dashboard/loading.tsx`
- Create: `src/app/(platform)/platform/bookings/loading.tsx`
- Create: `src/app/(platform)/platform/tenants/[tenantId]/loading.tsx`

- [ ] **Step 1: Write 4 loading files**

All four have the same shape — different row counts.

`src/app/(platform)/platform/tenants/loading.tsx`:
```tsx
import PageSkeleton from '@/components/ui/page-skeleton'
export default function Loading() {
  return <PageSkeleton rows={5} />
}
```

`src/app/(platform)/platform/dashboard/loading.tsx`:
```tsx
import PageSkeleton from '@/components/ui/page-skeleton'
export default function Loading() {
  return <PageSkeleton rows={4} />
}
```

`src/app/(platform)/platform/bookings/loading.tsx`:
```tsx
import PageSkeleton from '@/components/ui/page-skeleton'
export default function Loading() {
  return <PageSkeleton rows={8} />
}
```

`src/app/(platform)/platform/tenants/[tenantId]/loading.tsx`:
```tsx
import PageSkeleton from '@/components/ui/page-skeleton'
export default function Loading() {
  return <PageSkeleton rows={6} />
}
```

- [ ] **Step 2: Verify build & types**

Run: `npm run typecheck && npm run build`
Expected: All green.

- [ ] **Step 3: Manual verification**

`npm run dev`, log in as platform admin, then perform a hard reload (Ctrl+F5) on each of `/platform/tenants`, `/platform/dashboard`, `/platform/bookings`, and `/platform/tenants/<any-tenant-id>`. The skeleton should flash before the real content renders.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(platform\)/platform/tenants/loading.tsx src/app/\(platform\)/platform/dashboard/loading.tsx src/app/\(platform\)/platform/bookings/loading.tsx src/app/\(platform\)/platform/tenants/\[tenantId\]/loading.tsx
git commit -m "$(cat <<'EOF'
feat(s1): platform group loading skeletons (FR-113)

加 loading.tsx 到 platform/tenants、dashboard、bookings、tenants/[id]，
冷啟動或第一次進入時立即顯示骨架，避免白屏被誤認為卡住。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: `<NotificationPreferences>` shared block

**Files:**
- Create: `src/components/settings/notification-preferences.tsx`

- [ ] **Step 1: Implement**

Write `src/components/settings/notification-preferences.tsx`:

```tsx
import { createSupabaseServerClient } from '@/lib/supabase/server'
import PushOptIn from '@/components/push-opt-in'
import PreferencesForm from '@/app/(customer)/settings/notifications/preferences-form'

const DEFAULT_PREFS = {
  weekly_summary_enabled: true,
  daily_reminder_enabled: true,
  daily_reminder_hour: 7,
  pre_event_enabled: true,
  pre_event_minutes: [30],
  booking_status_changes_enabled: true,
}

export default async function NotificationPreferences({
  userId,
}: {
  userId: string
}) {
  const supabase = await createSupabaseServerClient()
  const { data: prefs } = await supabase
    .from('notification_preferences')
    .select(
      'weekly_summary_enabled, daily_reminder_enabled, daily_reminder_hour, pre_event_enabled, pre_event_minutes, booking_status_changes_enabled',
    )
    .eq('user_id', userId)
    .maybeSingle()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">通知設定</h1>
      <PushOptIn />
      <PreferencesForm initial={prefs ?? DEFAULT_PREFS} />
    </div>
  )
}
```

- [ ] **Step 2: Verify build & types**

Run: `npm run typecheck`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/settings/notification-preferences.tsx
git commit -m "$(cat <<'EOF'
feat(s1): shared NotificationPreferences server block (FR-112)

Lifts data fetch + section composition out of the customer page so a
tenant page can render the same UI under tenant layout.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Slim down customer notifications page

**Files:**
- Modify: `src/app/(customer)/settings/notifications/page.tsx`

- [ ] **Step 1: Replace whole file**

Overwrite `src/app/(customer)/settings/notifications/page.tsx`:

```tsx
import { requireSession } from '@/lib/auth/get-session'
import NotificationPreferences from '@/components/settings/notification-preferences'

export default async function CustomerNotificationSettingsPage() {
  const session = await requireSession()
  return <NotificationPreferences userId={session.userId} />
}
```

- [ ] **Step 2: Verify build & types**

Run: `npm run typecheck`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(customer\)/settings/notifications/page.tsx
git commit -m "$(cat <<'EOF'
refactor(s1): customer notifications page → uses shared block (FR-112)

Page becomes a thin wrapper that runs requireSession() and delegates UI
to NotificationPreferences. No behavior change for customer users.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Tenant-group notifications page

**Files:**
- Create: `src/app/(tenant)/settings/notifications/page.tsx`

- [ ] **Step 1: Implement**

Write `src/app/(tenant)/settings/notifications/page.tsx`:

```tsx
import { requireTenantMember } from '@/lib/auth/get-session'
import NotificationPreferences from '@/components/settings/notification-preferences'

export default async function TenantNotificationSettingsPage() {
  const session = await requireTenantMember()
  return <NotificationPreferences userId={session.userId} />
}
```

- [ ] **Step 2: Verify build & types**

Run: `npm run typecheck && npm run build`
Expected: All green.

- [ ] **Step 3: Manual verification**

`npm run dev`, log in as a tenant Owner. Click sidebar 「通知設定」:
1. The tenant sidebar STAYS visible
2. Page renders the same prefs UI as the customer view
3. Toggle a switch, save → toast「設定已儲存」
4. Reload — saved value persists

Then log in as a customer, navigate to `/settings/notifications`:
1. Page still works in customer layout (no sidebar — expected)
2. Save still works

- [ ] **Step 4: Commit**

```bash
git add src/app/\(tenant\)/settings/notifications/page.tsx
git commit -m "$(cat <<'EOF'
fix(s1): notifications page no longer escapes tenant layout (FR-112)

Add (tenant)/settings/notifications/page.tsx so coaches following the
sidebar link stay under tenant layout (sidebar visible). Both groups
render the same shared NotificationPreferences block; only the layout
chrome differs.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: README — error.digest runbook + route map

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add runbook section**

Edit `README.md`. Find the section heading `## 路由地圖` (around line 38) and immediately above the line `(tenant) — 教練後台` block, locate the existing tenant route list. Add the new route line:

Replace
```
  /settings/notifications      通知偏好
```

with two lines reflecting both groups:
```
  /settings/notifications      通知偏好（教練 / 助教，留在 tenant 後台 chrome）
  /settings/profile            租戶資料（Owner 限定）
```

(The existing `/settings/profile` line should be merged so the route map shows both settings routes side by side. If `/settings/profile` already exists in that block, just edit the `/settings/notifications` description.)

Then find a good insertion point for a new section (after the "資料庫 Schema 概覽" section, before "測試覆蓋"). Add:

```markdown
## 除錯 Runbook — `error.digest` 怎麼查

Production 環境的 error boundary 為了不洩漏 stack trace 給使用者，只顯示一串雜湊碼（例如「錯誤代碼：2263577791」）。這串就是 Next.js 在 server 端記到 log 的 `error.digest`。

### 找對應 stack 的步驟

1. 在 Vercel Dashboard → 該專案 → Logs 篩選時間區間（出錯前後 5 分鐘）
2. 搜尋欄輸入 digest 串（去頭尾空白）
3. 第一筆命中的 log 會包含 stack trace、檔案路徑與行號
4. 若 production 找不到，切到 preview deployment 的 logs 也搜一遍

### 常見類型

| 症狀 | 通常 root cause |
|---|---|
| Server Component render 時失敗 | 在 RSC 裡寫了 `onChange` / `onClick` / 用 `window` 等 client-only API |
| Build 後第一次造訪某動態路由 | 資料庫 RLS 或 PostgREST relationship 配置變動 |
| 偶發性 | 第三方 API 超時 / Supabase 連線拋例外 |

開發中 `process.env.NODE_ENV !== 'production'` 時，error boundary 會直接顯示 stack（見 `src/app/error.tsx`），免去查 digest。
```

- [ ] **Step 2: Verify links**

`grep -n notifications README.md` should now show the tenant + customer note.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "$(cat <<'EOF'
docs(s1): error.digest runbook + tenant notifications route (FR-114)

新增「除錯 Runbook — error.digest 怎麼查」一節：說明 Vercel logs 怎麼用
digest 串 grep 對應 stack，含常見 root cause 對照表。並把 route map 補上
tenant 群組的 /settings/notifications。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: Backfill parent spec appendix C

**Files:**
- Modify: `docs/superpowers/specs/2026-05-21-quickreserve-redesign-design.md`

- [ ] **Step 1: Find appendix C end and append entries**

Open the parent spec, find the last FR entry in Appendix C (should be FR-109). Append the following block right after:

```markdown
| FR-110 | S1 | 邀請流程：slug input 即時 normalize、共用 FormFieldErrors 顯示欄位錯誤、helper text | TBD | 2026-05-23 | `docs/superpowers/specs/2026-05-23-s1-bug-triage-design.md` §3 B1 |
| FR-111 | S1 | `/platform/bookings` Server Component 違規修正（抽 TenantFilter client component、Promise.all 並行 query） | TBD | 2026-05-23 | 同上 §3 B2 |
| FR-112 | S1 | 通知設定 route 群組分離（tenant 與 customer 各一個 page，共用 NotificationPreferences server block） | TBD | 2026-05-23 | 同上 §3 B3 |
| FR-113 | S1 | 平台群組 loading.tsx 4 個 + PageSkeleton 共用元件 + tenants 空清單 short-circuit | TBD | 2026-05-23 | 同上 §3 B4 |
| FR-114 | S1 | README 加入 error.digest runbook | TBD | 2026-05-23 | 同上 §3 B4-e |
```

(The `TBD` column is for commit hashes — they get backfilled in Task 16 once everything is committed.)

Also update the document header's "最後更新" date and short summary to reflect S1 (e.g. "2026-05-23（S1 bug triage：FR-110~114）").

- [ ] **Step 2: Verify markdown renders**

Open the file in your editor and confirm the new rows render as part of the existing table (no broken pipe characters, same column count).

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-05-21-quickreserve-redesign-design.md
git commit -m "$(cat <<'EOF'
docs(s1): backfill parent spec appendix C with FR-110~114

Commit hashes still TBD — will be filled in final task once all S1 commits
land.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 15: Clean up debug script

**Files:**
- Delete: `scripts/debug-bookings-query.mjs`

- [ ] **Step 1: Delete the file**

```bash
git rm scripts/debug-bookings-query.mjs
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Green (script wasn't imported anywhere).

- [ ] **Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
chore(s1): remove brainstorming debug script

scripts/debug-bookings-query.mjs was used during the S1 brainstorm to
reproduce the /platform/bookings query and measure the /platform/tenants
load time. RCA is now captured in the spec; the script is no longer
needed.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 16: End-to-end verification, backfill hashes, push

**Files:**
- Modify: `docs/superpowers/specs/2026-05-21-quickreserve-redesign-design.md` (replace `TBD` placeholders with commit hashes)

- [ ] **Step 1: Final build + typecheck + tests**

Run all three:
```
npm run typecheck
npm run lint
npm test
npm run build
```
Expected: All four green. The only test that should be newly added is `slug.test.ts` with 9 passes.

- [ ] **Step 2: Manual verification matrix**

Run `npm run dev`. Confirm each item:

| # | Step | Expected |
|---|---|---|
| 1 | `/platform/tenants` → 邀請欄打 `TerryTest` | Slug field auto-normalizes to `terrytest` |
| 2 | 同上，submit 空 email | Email field shows 紅字 inline error, no generic toast |
| 3 | 同上，submit 正確資料 | Toast「已建立邀請」+ invite URL card visible |
| 4 | `/staff` (as tenant Owner) → submit empty email | Email field shows inline error |
| 5 | `/platform/bookings` 開啟 | No error.digest; 4 bookings rendered |
| 6 | `/platform/bookings` 切換 status filter | URL updates, bookings filtered |
| 7 | `/platform/bookings` 切換 tenant dropdown | URL updates, bookings filtered to tenant |
| 8 | 教練後台 sidebar 點「通知設定」 | Sidebar 保留, prefs UI 顯示 |
| 9 | 教練 toggle 一個開關 → save | Toast「設定已儲存」, reload 仍保留 |
| 10 | 學員 `/settings/notifications` | Customer layout, prefs UI 仍 work |
| 11 | Hard reload `/platform/tenants` | Skeleton 閃過後渲染真實 row |
| 12 | Hard reload `/platform/dashboard`, `/platform/bookings`, `/platform/tenants/<id>` | 同樣 skeleton |

If any item fails, fix in place (do **not** push); add a sub-task with the diff and commit before continuing.

- [ ] **Step 3: Backfill commit hashes in parent spec**

Get the hashes:
```bash
git log --oneline --grep='FR-110\|FR-111\|FR-112\|FR-113\|FR-114' --reverse | head
```

Edit `docs/superpowers/specs/2026-05-21-quickreserve-redesign-design.md`. Replace each of the 5 `TBD` placeholders with the corresponding short hash (group commits by FR-### tag; a single FR may have multiple commit hashes separated by `,`).

Commit:
```bash
git add docs/superpowers/specs/2026-05-21-quickreserve-redesign-design.md
git commit -m "$(cat <<'EOF'
docs(s1): backfill commit hashes for FR-110~114

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4: Push**

```bash
git push origin master
```

Wait for Vercel preview to deploy and confirm production deployment is READY (use `gh run list` or Vercel dashboard). If the deploy fails, do **not** revert — investigate the log and fix forward.

- [ ] **Step 5: Mark S1 done**

S1 is finished. Update any tracking docs/PROJECT.md if applicable; otherwise nothing else to do.

---

## Self-Review Notes

- **Spec coverage**: every FR-110~114 maps to at least one task. B1 → Tasks 1–4. B2 → Tasks 5–6. B3 → Tasks 10–12. B4 → Tasks 7–9 + 13. doc updates → Tasks 13–14. cleanup → Task 15. verification → Task 16.
- **Type consistency**: `<FormFieldErrors>` props shape (`errors: Record<string, { _errors?: string[] }>`) matches what `useAction(...).result.validationErrors` actually returns in next-safe-action with Zod schemas. `<PageSkeleton>` API used in Task 9 matches Task 8 definition.
- **Placeholder scan**: only intentional `TBD` is in Task 14's spec table (commit hashes), explicitly resolved in Task 16 step 3.
- **Note on Task 7**: original spec said "並行 query"; in practice the owners query depends on `tenantIds` so true parallelism isn't possible. The micro-optimization is the empty-list short-circuit; the perceived-load fix lives in the loading skeleton (Task 9). This deviation is documented in the task itself.
