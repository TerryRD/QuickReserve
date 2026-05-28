# RLS Rewrite — Combine Multiple PERMISSIVE Policies · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite RLS policies on 7 tables to close 130 Supabase advisor lints (120 `multiple_permissive_policies` + 10 `auth_rls_initplan`) while preserving permission semantics exactly. Verified by a new 28-case integration test matrix that runs both before and after the migration.

**Architecture:** Test-first / baseline-driven. Build the 28-case test file first against the current (broken-but-correct) RLS state — all green = current semantics captured. Then ship one atomic migration that drops + recreates policies in combined OR form, re-run the same tests, and confirm advisor lints drop to 0. Rollback file kept beside the spec (not in `migrations/`) so emergency revert is one `psql` call.

**Tech Stack:** PostgreSQL RLS + Supabase Auth, Vitest (`@vitest-environment node`) + `@supabase/supabase-js` admin/anon/auth clients, `npx supabase db push` for migration apply, Management API `/v1/projects/<ref>/advisors/{security|performance}` for verification.

**Spec:** `docs/superpowers/specs/2026-05-28-rls-rewrite-combine-permissive-design.md` (commit `3724d67`)

---

## File Structure

| File | Purpose | Phase |
|---|---|---|
| `tests/integration/rls-rewrite-matrix.test.ts` | NEW · 28-case matrix (4 roles × 7 tables × actions) with `beforeAll` fixture | 1 |
| `docs/superpowers/specs/2026-05-28-rls-rewrite-rollback.sql` | NEW · escape hatch — drops new combined policies + recreates the 7 original migration files' policy state | 2 |
| `supabase/migrations/<TS>_rls_rewrite_combine_permissive.sql` | NEW · single migration touching 7 tables | 2 |
| `docs/superpowers/specs/2026-05-28-supabase-advisors-snapshot.md` | MODIFY · mark the 120+10 lints as resolved | 3 |
| `TOMORROW.md` | MODIFY · remove RLS rewrite from backlog list | 3 |

---

## Phase 1 — Test Matrix (baseline against current RLS)

### Task 1: Test fixture + availability_templates cases (4 tests)

**Files:**
- Create: `tests/integration/rls-rewrite-matrix.test.ts`

- [ ] **Step 1: Create the test file with fixture + harness + first table block**

```ts
// @vitest-environment node
import WebSocket from 'ws'
if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket
}

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const admin = createClient<Database>(SUPABASE_URL, SERVICE_KEY)

const STAMP = Date.now()
const PASSWORD = 'RlsTest123!'

const f: {
  tenantId?: string
  suspendedTenantId?: string
  ownerUserId?: string
  ownerMemberId?: string
  staffUserId?: string
  staffMemberId?: string
  customerUserId?: string
  otherCustomerUserId?: string
  serviceId?: string
  activePackageId?: string
  inactivePackageId?: string
  suspendedTenantPackageId?: string
  purchaseId?: string
  templateId?: string
  templateWindowId?: string
  templateAssignmentId?: string
  unavailableEventId?: string
  tenantPhotoId?: string
  suspendedTenantPhotoId?: string
  ownerEmail: string
  staffEmail: string
  customerEmail: string
  otherCustomerEmail: string
} = {
  ownerEmail: `rls-rewrite-owner-${STAMP}@example.com`,
  staffEmail: `rls-rewrite-staff-${STAMP}@example.com`,
  customerEmail: `rls-rewrite-customer-${STAMP}@example.com`,
  otherCustomerEmail: `rls-rewrite-other-${STAMP}@example.com`,
}

async function signIn(email: string): Promise<SupabaseClient<Database>> {
  const client = createClient<Database>(SUPABASE_URL, ANON_KEY)
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD })
  if (error) throw new Error(`sign-in failed for ${email}: ${error.message}`)
  return client
}

let ownerClient: SupabaseClient<Database>
let staffClient: SupabaseClient<Database>
let customerClient: SupabaseClient<Database>
const anonClient = createClient<Database>(SUPABASE_URL, ANON_KEY)

beforeAll(async () => {
  // -------- Users --------
  const { data: owner } = await admin.auth.admin.createUser({
    email: f.ownerEmail, password: PASSWORD, email_confirm: true,
  })
  f.ownerUserId = owner!.user!.id

  const { data: staff } = await admin.auth.admin.createUser({
    email: f.staffEmail, password: PASSWORD, email_confirm: true,
  })
  f.staffUserId = staff!.user!.id

  const { data: cust } = await admin.auth.admin.createUser({
    email: f.customerEmail, password: PASSWORD, email_confirm: true,
  })
  f.customerUserId = cust!.user!.id

  const { data: otherCust } = await admin.auth.admin.createUser({
    email: f.otherCustomerEmail, password: PASSWORD, email_confirm: true,
  })
  f.otherCustomerUserId = otherCust!.user!.id

  // -------- Tenants --------
  const { data: tenant } = await admin.from('tenants').insert({
    slug: `rls-rewrite-tenant-${STAMP}`,
    name: 'RLS Rewrite Tenant',
    status: 'active',
  }).select('id').single()
  f.tenantId = tenant!.id

  const { data: suspended } = await admin.from('tenants').insert({
    slug: `rls-rewrite-suspended-${STAMP}`,
    name: 'RLS Rewrite Suspended Tenant',
    status: 'suspended',
  }).select('id').single()
  f.suspendedTenantId = suspended!.id

  // -------- Members --------
  const { data: ownerMember } = await admin.from('tenant_members').insert({
    tenant_id: f.tenantId, user_id: f.ownerUserId, role: 'owner', status: 'active',
  }).select('id').single()
  f.ownerMemberId = ownerMember!.id

  const { data: staffMember } = await admin.from('tenant_members').insert({
    tenant_id: f.tenantId, user_id: f.staffUserId, role: 'staff', status: 'active',
  }).select('id').single()
  f.staffMemberId = staffMember!.id

  // -------- Customers --------
  await admin.from('customers').insert([
    { id: f.customerUserId!, display_name: 'Customer A' },
    { id: f.otherCustomerUserId!, display_name: 'Customer B' },
  ])
  await admin.from('tenant_customers').insert({
    tenant_id: f.tenantId, customer_id: f.customerUserId!,
  })

  // -------- Service + Packages --------
  const { data: service } = await admin.from('services').insert({
    tenant_id: f.tenantId, name: 'RLS Service', duration_minutes: 60, price: 1000, is_active: true,
  }).select('id').single()
  f.serviceId = service!.id

  const { data: activePkg } = await admin.from('service_packages').insert({
    tenant_id: f.tenantId, service_id: f.serviceId, name: 'Active Pkg',
    class_count: 10, price: 9000, expires_in_days: 180, is_active: true,
  }).select('id').single()
  f.activePackageId = activePkg!.id

  const { data: inactivePkg } = await admin.from('service_packages').insert({
    tenant_id: f.tenantId, service_id: f.serviceId, name: 'Inactive Pkg',
    class_count: 5, price: 4500, expires_in_days: 180, is_active: false,
  }).select('id').single()
  f.inactivePackageId = inactivePkg!.id

  // Service + package in suspended tenant (for negative public-read tests)
  const { data: suspendedService } = await admin.from('services').insert({
    tenant_id: f.suspendedTenantId, name: 'Suspended Service',
    duration_minutes: 60, price: 1000, is_active: true,
  }).select('id').single()
  const { data: suspendedPkg } = await admin.from('service_packages').insert({
    tenant_id: f.suspendedTenantId, service_id: suspendedService!.id,
    name: 'Suspended Pkg', class_count: 10, price: 9000, expires_in_days: 180, is_active: true,
  }).select('id').single()
  f.suspendedTenantPackageId = suspendedPkg!.id

  // -------- Purchase (pending_review) --------
  const { data: purchase } = await admin.from('customer_purchases').insert({
    tenant_id: f.tenantId, customer_id: f.customerUserId!, service_id: f.serviceId,
    package_id: f.activePackageId, classes_total: 10, classes_used: 0,
    approval_status: 'pending_review', payment_self_reported: 'awaiting_payment',
  }).select('id').single()
  f.purchaseId = purchase!.id

  // -------- Availability template (belongs to owner's member) --------
  const { data: template } = await admin.from('availability_templates').insert({
    member_id: f.ownerMemberId, name: 'Owner Template', is_active: true,
  }).select('id').single()
  f.templateId = template!.id

  const { data: window } = await admin.from('availability_template_windows').insert({
    template_id: f.templateId, weekday: 1, start_time: '09:00', end_time: '12:00',
  }).select('id').single()
  f.templateWindowId = window!.id

  const { data: assignment } = await admin.from('availability_template_assignments').insert({
    template_id: f.templateId, member_id: f.ownerMemberId,
    start_date: '2026-01-01', end_date: '2026-12-31',
  }).select('id').single()
  f.templateAssignmentId = assignment!.id

  // -------- Unavailable event (belongs to staff's member) --------
  const { data: event } = await admin.from('unavailable_events').insert({
    member_id: f.staffMemberId,
    start_at: '2026-12-25T00:00:00Z', end_at: '2026-12-25T23:59:59Z',
    reason: 'Holiday',
  }).select('id').single()
  f.unavailableEventId = event!.id

  // -------- Tenant photos --------
  const { data: photo } = await admin.from('tenant_photos').insert({
    tenant_id: f.tenantId, storage_path: `${f.tenantId}/photo-a.jpg`,
    caption: 'Active Photo', display_order: 0,
  }).select('id').single()
  f.tenantPhotoId = photo!.id

  const { data: suspendedPhoto } = await admin.from('tenant_photos').insert({
    tenant_id: f.suspendedTenantId, storage_path: `${f.suspendedTenantId}/photo-b.jpg`,
    caption: 'Suspended Photo', display_order: 0,
  }).select('id').single()
  f.suspendedTenantPhotoId = suspendedPhoto!.id

  // -------- Sign in clients --------
  ownerClient = await signIn(f.ownerEmail)
  staffClient = await signIn(f.staffEmail)
  customerClient = await signIn(f.customerEmail)
}, 60_000)

afterAll(async () => {
  // Cleanup in FK-respecting order
  if (f.purchaseId) await admin.from('customer_purchases').delete().eq('tenant_id', f.tenantId!)
  if (f.unavailableEventId) await admin.from('unavailable_events').delete().eq('id', f.unavailableEventId)
  if (f.templateAssignmentId) await admin.from('availability_template_assignments').delete().eq('id', f.templateAssignmentId)
  if (f.templateWindowId) await admin.from('availability_template_windows').delete().eq('id', f.templateWindowId)
  if (f.templateId) await admin.from('availability_templates').delete().eq('id', f.templateId)
  if (f.tenantPhotoId) await admin.from('tenant_photos').delete().in('tenant_id', [f.tenantId!, f.suspendedTenantId!])
  if (f.activePackageId) await admin.from('service_packages').delete().in('tenant_id', [f.tenantId!, f.suspendedTenantId!])
  if (f.serviceId) await admin.from('services').delete().in('tenant_id', [f.tenantId!, f.suspendedTenantId!])
  await admin.from('tenant_customers').delete().eq('tenant_id', f.tenantId!)
  await admin.from('tenant_members').delete().eq('tenant_id', f.tenantId!)
  if (f.tenantId) await admin.from('tenants').delete().in('id', [f.tenantId!, f.suspendedTenantId!])
  await admin.from('customers').delete().in('id', [f.customerUserId!, f.otherCustomerUserId!])
  for (const uid of [f.ownerUserId, f.staffUserId, f.customerUserId, f.otherCustomerUserId]) {
    if (uid) await admin.auth.admin.deleteUser(uid).catch(() => {})
  }
})

describe('availability_templates', () => {
  it('owner SELECTs own tenant template (1 row)', async () => {
    const { data } = await ownerClient.from('availability_templates').select('id').eq('id', f.templateId!)
    expect(data).toHaveLength(1)
  })

  it('staff SELECTs templates of own member_id (0 rows — template belongs to owner)', async () => {
    const { data } = await staffClient.from('availability_templates').select('id').eq('id', f.templateId!)
    expect(data).toHaveLength(0)
  })

  it('customer SELECTs templates (0 rows — RLS blocks)', async () => {
    const { data } = await customerClient.from('availability_templates').select('id').eq('id', f.templateId!)
    expect(data).toHaveLength(0)
  })

  it('anon SELECTs templates (0 rows — no session)', async () => {
    const { data } = await anonClient.from('availability_templates').select('id').eq('id', f.templateId!)
    expect(data).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run against current (pre-migration) schema**

```bash
npm run test:integration -- tests/integration/rls-rewrite-matrix.test.ts
```

Expected: 4 pass. If any fails, the current RLS semantics are different from what the spec assumed — investigate before proceeding.

- [ ] **Step 3: Do NOT commit yet — more tests coming in Task 2-4.** Leave the file uncommitted.

---

### Task 2: availability_template_windows + assignments + unavailable_events tests (8 cases)

**Files:**
- Modify: `tests/integration/rls-rewrite-matrix.test.ts` — append three new `describe` blocks

- [ ] **Step 1: Append blocks**

```ts
describe('availability_template_windows', () => {
  it('owner SELECTs window of own tenant template', async () => {
    const { data } = await ownerClient.from('availability_template_windows').select('id').eq('id', f.templateWindowId!)
    expect(data).toHaveLength(1)
  })

  it('customer SELECTs window (0 rows)', async () => {
    const { data } = await customerClient.from('availability_template_windows').select('id').eq('id', f.templateWindowId!)
    expect(data).toHaveLength(0)
  })
})

describe('availability_template_assignments', () => {
  it('owner SELECTs assignment of own tenant', async () => {
    const { data } = await ownerClient.from('availability_template_assignments').select('id').eq('id', f.templateAssignmentId!)
    expect(data).toHaveLength(1)
  })

  it('customer SELECTs assignment (0 rows)', async () => {
    const { data } = await customerClient.from('availability_template_assignments').select('id').eq('id', f.templateAssignmentId!)
    expect(data).toHaveLength(0)
  })
})

describe('unavailable_events', () => {
  it('owner SELECTs event of own tenant (1 row, owner sees all in tenant)', async () => {
    const { data } = await ownerClient.from('unavailable_events').select('id').eq('id', f.unavailableEventId!)
    expect(data).toHaveLength(1)
  })

  it('staff SELECTs own member event (1 row)', async () => {
    const { data } = await staffClient.from('unavailable_events').select('id').eq('id', f.unavailableEventId!)
    expect(data).toHaveLength(1)
  })

  it('customer SELECTs event (0 rows)', async () => {
    const { data } = await customerClient.from('unavailable_events').select('id').eq('id', f.unavailableEventId!)
    expect(data).toHaveLength(0)
  })

  it('anon SELECTs event (0 rows)', async () => {
    const { data } = await anonClient.from('unavailable_events').select('id').eq('id', f.unavailableEventId!)
    expect(data).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run**

```bash
npm run test:integration -- tests/integration/rls-rewrite-matrix.test.ts
```

Expected: 4 + 8 = 12 pass.

- [ ] **Step 3: No commit yet — Task 3 + 4 add more.**

---

### Task 3: service_packages + tenant_photos tests (9 cases)

**Files:**
- Modify: `tests/integration/rls-rewrite-matrix.test.ts` — append

- [ ] **Step 1: Append**

```ts
describe('service_packages', () => {
  it('anon SELECTs active package of active tenant (1 row)', async () => {
    const { data } = await anonClient.from('service_packages').select('id').eq('id', f.activePackageId!)
    expect(data).toHaveLength(1)
  })

  it('anon SELECTs inactive package (0 rows — is_active=false blocks)', async () => {
    const { data } = await anonClient.from('service_packages').select('id').eq('id', f.inactivePackageId!)
    expect(data).toHaveLength(0)
  })

  it('anon SELECTs active package of suspended tenant (0 rows)', async () => {
    const { data } = await anonClient.from('service_packages').select('id').eq('id', f.suspendedTenantPackageId!)
    expect(data).toHaveLength(0)
  })

  it('owner INSERTs new package (success)', async () => {
    const { data, error } = await ownerClient.from('service_packages').insert({
      tenant_id: f.tenantId!, service_id: f.serviceId!, name: 'Owner Insert',
      class_count: 5, price: 4500, expires_in_days: 180, is_active: true,
    }).select('id').single()
    expect(error).toBeNull()
    expect(data?.id).toBeTruthy()
    // Cleanup
    if (data?.id) await admin.from('service_packages').delete().eq('id', data.id)
  })

  it('customer INSERTs package (blocked)', async () => {
    const { error } = await customerClient.from('service_packages').insert({
      tenant_id: f.tenantId!, service_id: f.serviceId!, name: 'Customer Insert',
      class_count: 5, price: 4500, expires_in_days: 180, is_active: true,
    })
    expect(error).not.toBeNull()
  })
})

describe('tenant_photos', () => {
  it('anon SELECTs photo of active tenant (1 row)', async () => {
    const { data } = await anonClient.from('tenant_photos').select('id').eq('id', f.tenantPhotoId!)
    expect(data).toHaveLength(1)
  })

  it('anon SELECTs photo of suspended tenant (0 rows)', async () => {
    const { data } = await anonClient.from('tenant_photos').select('id').eq('id', f.suspendedTenantPhotoId!)
    expect(data).toHaveLength(0)
  })

  it('owner DELETEs own photo (success)', async () => {
    // Insert a deletable photo first
    const { data: newPhoto } = await admin.from('tenant_photos').insert({
      tenant_id: f.tenantId!, storage_path: `${f.tenantId}/del.jpg`,
      caption: 'Delete me', display_order: 99,
    }).select('id').single()
    const { error } = await ownerClient.from('tenant_photos').delete().eq('id', newPhoto!.id)
    expect(error).toBeNull()
  })

  it('customer DELETEs owner photo (blocked, photo still exists)', async () => {
    await customerClient.from('tenant_photos').delete().eq('id', f.tenantPhotoId!)
    // Verify still there
    const { data } = await admin.from('tenant_photos').select('id').eq('id', f.tenantPhotoId!)
    expect(data).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run**

```bash
npm run test:integration -- tests/integration/rls-rewrite-matrix.test.ts
```

Expected: 4 + 8 + 9 = 21 pass.

- [ ] **Step 3: No commit yet — Task 4 adds the last 7.**

---

### Task 4: customer_purchases tests — corner cases (7 cases)

**Files:**
- Modify: `tests/integration/rls-rewrite-matrix.test.ts` — append

- [ ] **Step 1: Append**

```ts
describe('customer_purchases', () => {
  it('customer SELECTs own purchase (1 row)', async () => {
    const { data } = await customerClient.from('customer_purchases').select('id').eq('id', f.purchaseId!)
    expect(data).toHaveLength(1)
  })

  it('other customer SELECTs the purchase (0 rows)', async () => {
    // Sign in as the second customer
    const otherClient = await signIn(f.otherCustomerEmail)
    const { data } = await otherClient.from('customer_purchases').select('id').eq('id', f.purchaseId!)
    expect(data).toHaveLength(0)
  })

  it('owner (tenant member) SELECTs purchase in own tenant (≥1 row)', async () => {
    const { data } = await ownerClient.from('customer_purchases').select('id').eq('tenant_id', f.tenantId!)
    expect((data?.length ?? 0)).toBeGreaterThanOrEqual(1)
  })

  it('customer INSERTs own pending_review purchase (success)', async () => {
    const { data, error } = await customerClient.from('customer_purchases').insert({
      tenant_id: f.tenantId!, customer_id: f.customerUserId!, service_id: f.serviceId!,
      package_id: f.activePackageId!, classes_total: 10, classes_used: 0,
      approval_status: 'pending_review', payment_self_reported: 'awaiting_payment',
    }).select('id').single()
    expect(error).toBeNull()
    if (data?.id) await admin.from('customer_purchases').delete().eq('id', data.id)
  })

  it('customer INSERTs own purchase with approval_status=confirmed (blocked by WITH CHECK)', async () => {
    const { error } = await customerClient.from('customer_purchases').insert({
      tenant_id: f.tenantId!, customer_id: f.customerUserId!, service_id: f.serviceId!,
      package_id: f.activePackageId!, classes_total: 10, classes_used: 0,
      approval_status: 'confirmed', payment_self_reported: 'awaiting_payment',
    })
    expect(error).not.toBeNull()
  })

  it('customer INSERTs purchase with classes_used > 0 (blocked)', async () => {
    const { error } = await customerClient.from('customer_purchases').insert({
      tenant_id: f.tenantId!, customer_id: f.customerUserId!, service_id: f.serviceId!,
      package_id: f.activePackageId!, classes_total: 10, classes_used: 5,
      approval_status: 'pending_review', payment_self_reported: 'awaiting_payment',
    })
    expect(error).not.toBeNull()
  })

  it('customer UPDATEs own purchase (blocked — only members can update)', async () => {
    const { error } = await customerClient.from('customer_purchases')
      .update({ payment_self_reported: 'claimed_paid' })
      .eq('id', f.purchaseId!)
    // Postgres RLS doesn't error on UPDATE 0 rows; verify row didn't change
    const { data: after } = await admin.from('customer_purchases').select('payment_self_reported').eq('id', f.purchaseId!).single()
    expect(after?.payment_self_reported).toBe('awaiting_payment') // unchanged
  })
})
```

- [ ] **Step 2: Run all 28 tests**

```bash
npm run test:integration -- tests/integration/rls-rewrite-matrix.test.ts
```

Expected: 28 pass (baseline confirmed).

- [ ] **Step 3: Commit the test file (baseline locked in)**

```bash
git add tests/integration/rls-rewrite-matrix.test.ts
git commit -m "$(cat <<'EOF'
test(rls): add 28-case RLS matrix baseline before policy rewrite

Captures current RLS semantics for 7 tables (availability_templates / windows / assignments / unavailable_events / customer_purchases / service_packages / tenant_photos) across 4 roles (owner / staff / customer / anon). All 28 cases pass against current multi-permissive RLS — establishes regression baseline before the combine-permissive migration ships.

Hardest paths covered:
- customer_purchases INSERT with approval_status=confirmed is blocked by WITH CHECK
- customer_purchases INSERT with classes_used>0 is blocked
- customer_purchases UPDATE by customer is no-op (verified by re-reading row after attempt)
- service_packages anon SELECT excludes inactive packages AND suspended tenants

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2 — Migration

### Task 5: Write rollback file (current-state snapshot)

**Files:**
- Create: `docs/superpowers/specs/2026-05-28-rls-rewrite-rollback.sql`

Spec lives beside the design doc rather than in `migrations/` so it doesn't auto-apply but is one `psql` call away in an emergency.

- [ ] **Step 1: Create the rollback file**

```sql
-- ROLLBACK for migration <TS>_rls_rewrite_combine_permissive.sql
-- Restores the original 7-table policy state (5/3/5/5/6/6/6 = 36 policies total).
-- NOT in supabase/migrations/ because it should never auto-apply. To use:
--
--   SUPABASE_ACCESS_TOKEN=<token> npx supabase db execute \
--     --file docs/superpowers/specs/2026-05-28-rls-rewrite-rollback.sql
--
-- Or paste into Dashboard → SQL Editor.

begin;

-- ============ availability_templates ============
drop policy if exists templates_select on public.availability_templates;
drop policy if exists templates_insert on public.availability_templates;
drop policy if exists templates_update on public.availability_templates;
drop policy if exists templates_delete on public.availability_templates;

create policy templates_select_member on public.availability_templates for select
  using (member_id in (select id from public.tenant_members where user_id = auth.uid() and status = 'active'));
create policy templates_select_owner on public.availability_templates for select
  using (member_id in (select id from public.tenant_members where tenant_id in (select current_user_owner_tenant_ids())));
create policy templates_select_admin on public.availability_templates for select
  using (is_platform_admin());
create policy templates_modify_member on public.availability_templates for all
  using (member_id in (select id from public.tenant_members where user_id = auth.uid() and status = 'active'))
  with check (member_id in (select id from public.tenant_members where user_id = auth.uid() and status = 'active'));
create policy templates_modify_owner on public.availability_templates for all
  using (member_id in (select id from public.tenant_members where tenant_id in (select current_user_owner_tenant_ids())))
  with check (member_id in (select id from public.tenant_members where tenant_id in (select current_user_owner_tenant_ids())));

-- ============ availability_template_windows ============
drop policy if exists template_windows_select on public.availability_template_windows;
drop policy if exists template_windows_insert on public.availability_template_windows;
drop policy if exists template_windows_update on public.availability_template_windows;
drop policy if exists template_windows_delete on public.availability_template_windows;

create policy template_windows_select on public.availability_template_windows for select
  using (template_id in (select id from public.availability_templates));
create policy template_windows_modify_member on public.availability_template_windows for all
  using (template_id in (
    select id from public.availability_templates
    where member_id in (select id from public.tenant_members where user_id = auth.uid() and status = 'active')
  ))
  with check (template_id in (
    select id from public.availability_templates
    where member_id in (select id from public.tenant_members where user_id = auth.uid() and status = 'active')
  ));
create policy template_windows_modify_owner on public.availability_template_windows for all
  using (template_id in (
    select id from public.availability_templates
    where member_id in (select id from public.tenant_members where tenant_id in (select current_user_owner_tenant_ids()))
  ))
  with check (template_id in (
    select id from public.availability_templates
    where member_id in (select id from public.tenant_members where tenant_id in (select current_user_owner_tenant_ids()))
  ));

-- ============ availability_template_assignments ============
drop policy if exists assignments_select on public.availability_template_assignments;
drop policy if exists assignments_insert on public.availability_template_assignments;
drop policy if exists assignments_update on public.availability_template_assignments;
drop policy if exists assignments_delete on public.availability_template_assignments;

create policy assignments_select_member on public.availability_template_assignments for select
  using (member_id in (select id from public.tenant_members where user_id = auth.uid() and status = 'active'));
create policy assignments_select_owner on public.availability_template_assignments for select
  using (member_id in (select id from public.tenant_members where tenant_id in (select current_user_owner_tenant_ids())));
create policy assignments_select_admin on public.availability_template_assignments for select
  using (is_platform_admin());
create policy assignments_modify_member on public.availability_template_assignments for all
  using (member_id in (select id from public.tenant_members where user_id = auth.uid() and status = 'active'))
  with check (member_id in (select id from public.tenant_members where user_id = auth.uid() and status = 'active'));
create policy assignments_modify_owner on public.availability_template_assignments for all
  using (member_id in (select id from public.tenant_members where tenant_id in (select current_user_owner_tenant_ids())))
  with check (member_id in (select id from public.tenant_members where tenant_id in (select current_user_owner_tenant_ids())));

-- ============ unavailable_events ============
drop policy if exists events_select on public.unavailable_events;
drop policy if exists events_insert on public.unavailable_events;
drop policy if exists events_update on public.unavailable_events;
drop policy if exists events_delete on public.unavailable_events;

create policy events_select_member on public.unavailable_events for select
  using (member_id in (select id from public.tenant_members where user_id = auth.uid() and status = 'active'));
create policy events_select_owner on public.unavailable_events for select
  using (member_id in (select id from public.tenant_members where tenant_id in (select current_user_owner_tenant_ids())));
create policy events_select_admin on public.unavailable_events for select
  using (is_platform_admin());
create policy events_modify_member on public.unavailable_events for all
  using (member_id in (select id from public.tenant_members where user_id = auth.uid() and status = 'active'))
  with check (member_id in (select id from public.tenant_members where user_id = auth.uid() and status = 'active'));
create policy events_modify_owner on public.unavailable_events for all
  using (member_id in (select id from public.tenant_members where tenant_id in (select current_user_owner_tenant_ids())))
  with check (member_id in (select id from public.tenant_members where tenant_id in (select current_user_owner_tenant_ids())));

-- ============ customer_purchases ============
drop policy if exists customer_purchases_select on public.customer_purchases;
drop policy if exists customer_purchases_insert on public.customer_purchases;

create policy customer_purchases_select_customer on public.customer_purchases for select
  using (customer_id = auth.uid());
create policy customer_purchases_select_member on public.customer_purchases for select
  using (tenant_id in (select current_user_tenant_ids()));
create policy customer_purchases_select_admin on public.customer_purchases for select
  using (is_platform_admin());
create policy customer_purchases_insert_customer on public.customer_purchases for insert
  with check (
    customer_id = auth.uid()
    and approval_status = 'pending_review'
    and classes_used = 0
    and approved_at is null
    and approved_by is null
  );
create policy customer_purchases_insert_member on public.customer_purchases for insert
  with check (tenant_id in (select current_user_tenant_ids()));
-- customer_purchases_update_member unchanged, no need to restore

-- ============ service_packages ============
drop policy if exists service_packages_select on public.service_packages;

create policy service_packages_select_member on public.service_packages for select
  using (tenant_id in (select current_user_tenant_ids()));
create policy service_packages_select_public on public.service_packages for select
  using (
    is_active = true
    and tenant_id in (select id from public.tenants where status = 'active')
  );
create policy service_packages_select_admin on public.service_packages for select
  using (is_platform_admin());
-- insert/update/delete unchanged

-- ============ tenant_photos ============
drop policy if exists tenant_photos_select on public.tenant_photos;

create policy tenant_photos_select_public on public.tenant_photos for select
  using (tenant_id in (select id from public.tenants where status = 'active'));
create policy tenant_photos_select_member on public.tenant_photos for select
  using (tenant_id in (select current_user_tenant_ids()));
create policy tenant_photos_select_admin on public.tenant_photos for select
  using (is_platform_admin());
-- insert/update/delete unchanged

commit;
```

- [ ] **Step 2: Stage but don't commit yet — combined with migration commit in Task 7**

---

### Task 6: Write the migration

**Files:**
- Create: `supabase/migrations/<TS>_rls_rewrite_combine_permissive.sql`

- [ ] **Step 1: Generate timestamp**

```bash
node -e "console.log(new Date().toISOString().replace(/[-:T]/g,'').slice(0,14))"
```

Use as filename prefix (e.g. `20260528063000`). Must be later than `20260528054940` (the most recent existing migration).

- [ ] **Step 2: Create migration file**

```sql
-- Combine multiple PERMISSIVE policies + wrap auth.uid() in subselect.
-- Closes Supabase advisor lints 0003 (auth_rls_initplan, 10 instances) and
-- 0006 (multiple_permissive_policies, 120 instances) for 7 tables. Permission
-- semantics unchanged — verified by tests/integration/rls-rewrite-matrix.test.ts.
--
-- Rollback file: docs/superpowers/specs/2026-05-28-rls-rewrite-rollback.sql

begin;

-- ============ availability_templates ============
drop policy if exists templates_select_member on public.availability_templates;
drop policy if exists templates_select_owner  on public.availability_templates;
drop policy if exists templates_select_admin  on public.availability_templates;
drop policy if exists templates_modify_member on public.availability_templates;
drop policy if exists templates_modify_owner  on public.availability_templates;

create policy templates_select on public.availability_templates for select to authenticated
  using (
    is_platform_admin()
    OR member_id in (
      select id from public.tenant_members
      where user_id = (select auth.uid()) and status = 'active'
    )
    OR member_id in (
      select id from public.tenant_members
      where tenant_id in (select current_user_owner_tenant_ids())
    )
  );

create policy templates_insert on public.availability_templates for insert to authenticated
  with check (
    is_platform_admin()
    OR member_id in (
      select id from public.tenant_members
      where user_id = (select auth.uid()) and status = 'active'
    )
    OR member_id in (
      select id from public.tenant_members
      where tenant_id in (select current_user_owner_tenant_ids())
    )
  );

create policy templates_update on public.availability_templates for update to authenticated
  using (
    is_platform_admin()
    OR member_id in (
      select id from public.tenant_members
      where user_id = (select auth.uid()) and status = 'active'
    )
    OR member_id in (
      select id from public.tenant_members
      where tenant_id in (select current_user_owner_tenant_ids())
    )
  )
  with check (
    is_platform_admin()
    OR member_id in (
      select id from public.tenant_members
      where user_id = (select auth.uid()) and status = 'active'
    )
    OR member_id in (
      select id from public.tenant_members
      where tenant_id in (select current_user_owner_tenant_ids())
    )
  );

create policy templates_delete on public.availability_templates for delete to authenticated
  using (
    is_platform_admin()
    OR member_id in (
      select id from public.tenant_members
      where user_id = (select auth.uid()) and status = 'active'
    )
    OR member_id in (
      select id from public.tenant_members
      where tenant_id in (select current_user_owner_tenant_ids())
    )
  );

-- ============ availability_template_windows (predicate via parent template's member_id) ============
drop policy if exists template_windows_select        on public.availability_template_windows;
drop policy if exists template_windows_modify_member on public.availability_template_windows;
drop policy if exists template_windows_modify_owner  on public.availability_template_windows;

create policy template_windows_select on public.availability_template_windows for select to authenticated
  using (
    is_platform_admin()
    OR template_id in (
      select id from public.availability_templates
      where member_id in (
        select id from public.tenant_members
        where user_id = (select auth.uid()) and status = 'active'
      )
    )
    OR template_id in (
      select id from public.availability_templates
      where member_id in (
        select id from public.tenant_members
        where tenant_id in (select current_user_owner_tenant_ids())
      )
    )
  );

create policy template_windows_insert on public.availability_template_windows for insert to authenticated
  with check (
    is_platform_admin()
    OR template_id in (
      select id from public.availability_templates
      where member_id in (
        select id from public.tenant_members
        where user_id = (select auth.uid()) and status = 'active'
      )
    )
    OR template_id in (
      select id from public.availability_templates
      where member_id in (
        select id from public.tenant_members
        where tenant_id in (select current_user_owner_tenant_ids())
      )
    )
  );

create policy template_windows_update on public.availability_template_windows for update to authenticated
  using (
    is_platform_admin()
    OR template_id in (
      select id from public.availability_templates
      where member_id in (
        select id from public.tenant_members
        where user_id = (select auth.uid()) and status = 'active'
      )
    )
    OR template_id in (
      select id from public.availability_templates
      where member_id in (
        select id from public.tenant_members
        where tenant_id in (select current_user_owner_tenant_ids())
      )
    )
  )
  with check (
    is_platform_admin()
    OR template_id in (
      select id from public.availability_templates
      where member_id in (
        select id from public.tenant_members
        where user_id = (select auth.uid()) and status = 'active'
      )
    )
    OR template_id in (
      select id from public.availability_templates
      where member_id in (
        select id from public.tenant_members
        where tenant_id in (select current_user_owner_tenant_ids())
      )
    )
  );

create policy template_windows_delete on public.availability_template_windows for delete to authenticated
  using (
    is_platform_admin()
    OR template_id in (
      select id from public.availability_templates
      where member_id in (
        select id from public.tenant_members
        where user_id = (select auth.uid()) and status = 'active'
      )
    )
    OR template_id in (
      select id from public.availability_templates
      where member_id in (
        select id from public.tenant_members
        where tenant_id in (select current_user_owner_tenant_ids())
      )
    )
  );

-- ============ availability_template_assignments ============
drop policy if exists assignments_select_member on public.availability_template_assignments;
drop policy if exists assignments_select_owner  on public.availability_template_assignments;
drop policy if exists assignments_select_admin  on public.availability_template_assignments;
drop policy if exists assignments_modify_member on public.availability_template_assignments;
drop policy if exists assignments_modify_owner  on public.availability_template_assignments;

create policy assignments_select on public.availability_template_assignments for select to authenticated
  using (
    is_platform_admin()
    OR member_id in (
      select id from public.tenant_members
      where user_id = (select auth.uid()) and status = 'active'
    )
    OR member_id in (
      select id from public.tenant_members
      where tenant_id in (select current_user_owner_tenant_ids())
    )
  );

create policy assignments_insert on public.availability_template_assignments for insert to authenticated
  with check (
    is_platform_admin()
    OR member_id in (
      select id from public.tenant_members
      where user_id = (select auth.uid()) and status = 'active'
    )
    OR member_id in (
      select id from public.tenant_members
      where tenant_id in (select current_user_owner_tenant_ids())
    )
  );

create policy assignments_update on public.availability_template_assignments for update to authenticated
  using (
    is_platform_admin()
    OR member_id in (
      select id from public.tenant_members
      where user_id = (select auth.uid()) and status = 'active'
    )
    OR member_id in (
      select id from public.tenant_members
      where tenant_id in (select current_user_owner_tenant_ids())
    )
  )
  with check (
    is_platform_admin()
    OR member_id in (
      select id from public.tenant_members
      where user_id = (select auth.uid()) and status = 'active'
    )
    OR member_id in (
      select id from public.tenant_members
      where tenant_id in (select current_user_owner_tenant_ids())
    )
  );

create policy assignments_delete on public.availability_template_assignments for delete to authenticated
  using (
    is_platform_admin()
    OR member_id in (
      select id from public.tenant_members
      where user_id = (select auth.uid()) and status = 'active'
    )
    OR member_id in (
      select id from public.tenant_members
      where tenant_id in (select current_user_owner_tenant_ids())
    )
  );

-- ============ unavailable_events ============
drop policy if exists events_select_member on public.unavailable_events;
drop policy if exists events_select_owner  on public.unavailable_events;
drop policy if exists events_select_admin  on public.unavailable_events;
drop policy if exists events_modify_member on public.unavailable_events;
drop policy if exists events_modify_owner  on public.unavailable_events;

create policy events_select on public.unavailable_events for select to authenticated
  using (
    is_platform_admin()
    OR member_id in (
      select id from public.tenant_members
      where user_id = (select auth.uid()) and status = 'active'
    )
    OR member_id in (
      select id from public.tenant_members
      where tenant_id in (select current_user_owner_tenant_ids())
    )
  );

create policy events_insert on public.unavailable_events for insert to authenticated
  with check (
    is_platform_admin()
    OR member_id in (
      select id from public.tenant_members
      where user_id = (select auth.uid()) and status = 'active'
    )
    OR member_id in (
      select id from public.tenant_members
      where tenant_id in (select current_user_owner_tenant_ids())
    )
  );

create policy events_update on public.unavailable_events for update to authenticated
  using (
    is_platform_admin()
    OR member_id in (
      select id from public.tenant_members
      where user_id = (select auth.uid()) and status = 'active'
    )
    OR member_id in (
      select id from public.tenant_members
      where tenant_id in (select current_user_owner_tenant_ids())
    )
  )
  with check (
    is_platform_admin()
    OR member_id in (
      select id from public.tenant_members
      where user_id = (select auth.uid()) and status = 'active'
    )
    OR member_id in (
      select id from public.tenant_members
      where tenant_id in (select current_user_owner_tenant_ids())
    )
  );

create policy events_delete on public.unavailable_events for delete to authenticated
  using (
    is_platform_admin()
    OR member_id in (
      select id from public.tenant_members
      where user_id = (select auth.uid()) and status = 'active'
    )
    OR member_id in (
      select id from public.tenant_members
      where tenant_id in (select current_user_owner_tenant_ids())
    )
  );

-- ============ customer_purchases ============
drop policy if exists customer_purchases_select_customer on public.customer_purchases;
drop policy if exists customer_purchases_select_member   on public.customer_purchases;
drop policy if exists customer_purchases_select_admin    on public.customer_purchases;
drop policy if exists customer_purchases_insert_customer on public.customer_purchases;
drop policy if exists customer_purchases_insert_member   on public.customer_purchases;

create policy customer_purchases_select on public.customer_purchases for select to authenticated
  using (
    is_platform_admin()
    OR customer_id = (select auth.uid())
    OR tenant_id in (select current_user_tenant_ids())
  );

create policy customer_purchases_insert on public.customer_purchases for insert to authenticated
  with check (
    tenant_id in (select current_user_tenant_ids())
    OR (
      customer_id = (select auth.uid())
      AND approval_status = 'pending_review'
      AND classes_used = 0
      AND approved_at is null
      AND approved_by is null
    )
  );

-- customer_purchases_update_member unchanged

-- ============ service_packages ============
drop policy if exists service_packages_select_member on public.service_packages;
drop policy if exists service_packages_select_public on public.service_packages;
drop policy if exists service_packages_select_admin  on public.service_packages;

create policy service_packages_select on public.service_packages for select
  using (
    is_platform_admin()
    OR tenant_id in (select current_user_tenant_ids())
    OR (
      is_active = true
      and tenant_id in (select id from public.tenants where status = 'active')
    )
  );

-- service_packages insert/update/delete unchanged (owner-only, single policy each)

-- ============ tenant_photos ============
drop policy if exists tenant_photos_select_public on public.tenant_photos;
drop policy if exists tenant_photos_select_member on public.tenant_photos;
drop policy if exists tenant_photos_select_admin  on public.tenant_photos;

create policy tenant_photos_select on public.tenant_photos for select
  using (
    is_platform_admin()
    OR tenant_id in (select current_user_tenant_ids())
    OR tenant_id in (select id from public.tenants where status = 'active')
  );

-- tenant_photos insert/update/delete unchanged (owner-only)

commit;
```

- [ ] **Step 3: Stage but don't commit — Task 7 applies + commits together**

---

### Task 7: Apply migration + re-run tests + verify advisor + commit

**Files:**
- Apply: the new migration via `supabase db push`
- Verify: existing test file (no changes)
- Commit: both new files (migration + rollback)

- [ ] **Step 1: Apply migration**

```bash
SUPABASE_ACCESS_TOKEN=<your-token> npx supabase db push
```

Expected: "Finished supabase db push." with no errors.

If it errors: read the message, fix the SQL in the migration file, re-run. If the migration partially applied (some DROPs succeeded but a CREATE failed), the `begin; ... commit;` wrapping should have rolled it back atomically — verify by running `\d+ <table>` to confirm policies match pre-migration state. If not, run the rollback file.

- [ ] **Step 2: Re-run the integration test matrix**

```bash
npm run test:integration -- tests/integration/rls-rewrite-matrix.test.ts
```

Expected: **28/28 pass.** Any failure means a permission regression — STOP and run rollback:

```bash
SUPABASE_ACCESS_TOKEN=<token> psql "$(cat supabase/.temp/pooler-url)" \
  -f docs/superpowers/specs/2026-05-28-rls-rewrite-rollback.sql
```

Then debug the migration SQL before retrying.

- [ ] **Step 3: Re-run existing integration tests (no regression elsewhere)**

```bash
npm run test:integration
```

Expected: all 5 existing test files + the new one = 6 files green.

- [ ] **Step 4: Re-pull Supabase advisor and confirm lints dropped**

```bash
TOK='<your-token>' REF='buiefmgwzxpuxfshixas'
node -e "
fetch('https://api.supabase.com/v1/projects/$REF/advisors/performance', {
  headers: { Authorization: 'Bearer $TOK' }
})
  .then(r => r.json())
  .then(d => {
    const counts = {}
    for (const l of (d.lints || [])) counts[l.name] = (counts[l.name] || 0) + 1
    console.log(JSON.stringify(counts, null, 2))
  })
"
```

Expected output should NOT include `multiple_permissive_policies` or `auth_rls_initplan` keys. May still include `unindexed_foreign_keys` (now 5 fewer than before P1 fixes) and `unused_index` (15, the 5 P1 added + 10 pre-existing).

- [ ] **Step 5: Run unit tests + e2e against local production URL**

```bash
npm run test
E2E_BASE_URL=https://quick-reserve-mu.vercel.app npm run test:e2e
```

Expected: 105 unit + 28 e2e (3 skipped) all green.

- [ ] **Step 6: Commit migration + rollback together**

```bash
git add supabase/migrations/<TS>_rls_rewrite_combine_permissive.sql \
        docs/superpowers/specs/2026-05-28-rls-rewrite-rollback.sql
git commit -m "$(cat <<'EOF'
feat(rls): combine multiple PERMISSIVE policies + wrap auth.uid() in subselect

Closes 130 Supabase advisor lints across 7 tables (120 multiple_permissive_policies + 10 auth_rls_initplan). Permission semantics verified unchanged by tests/integration/rls-rewrite-matrix.test.ts — all 28 cases pass both before and after migration.

Per-table policy count changes:
- availability_templates: 5 → 4 (select/insert/update/delete, each member OR owner OR admin)
- availability_template_windows: 3 → 4 (nested predicate via parent template's member_id)
- availability_template_assignments: 5 → 4
- unavailable_events: 5 → 4
- customer_purchases: 6 → 3 (select + insert merged; UPDATE unchanged. INSERT WITH CHECK has OR-branched customer-lock for self-request)
- service_packages: 6 → 4 (3 SELECT merged; insert/update/delete unchanged)
- tenant_photos: 6 → 4 (3 SELECT merged; insert/update/delete unchanged)

Rollback file at docs/superpowers/specs/2026-05-28-rls-rewrite-rollback.sql restores the original 7-migration policy state — paste into Dashboard SQL Editor if anything goes sideways post-deploy.

Advisor re-pull confirms multiple_permissive_policies=0 and auth_rls_initplan=0.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 3 — Ship & Document

### Task 8: Push + verify GitHub Actions e2e + update docs

**Files:**
- Modify: `docs/superpowers/specs/2026-05-28-supabase-advisors-snapshot.md`
- Modify: `TOMORROW.md`

- [ ] **Step 1: Push**

```bash
git push origin master
```

This triggers the e2e workflow.

- [ ] **Step 2: Watch the GitHub Actions e2e run**

```bash
sleep 180  # let Vercel deploy (no-op for app code) + GH Actions start
gh run list --workflow=e2e.yml --limit=1
# Should show "completed success" when ready
```

If anything fails: `gh run view <id> --log-failed | tail -50` — diagnose, fix, repeat.

- [ ] **Step 3: Modify advisor snapshot to mark lints resolved**

Open `docs/superpowers/specs/2026-05-28-supabase-advisors-snapshot.md` and add at the top of the "Performance (15 INFO + 130 WARN = 145)" section (just below the heading):

```markdown
> **Update 2026-05-28:** `multiple_permissive_policies` (120 lints) and `auth_rls_initplan` (10 lints) RESOLVED by migration `<TS>_rls_rewrite_combine_permissive.sql` (commit `<sha>`). See `docs/superpowers/plans/2026-05-28-rls-rewrite-combine-permissive.md` for the rewrite plan and `2026-05-28-rls-rewrite-rollback.sql` for the escape hatch. Remaining perf lints: 5 unindexed_foreign_keys (fixed in commit `b613dcd`, advisor will catch up on next pull) + 15 unused_index (10 pre-existing + 5 from b613dcd, need ~1 week of usage data to confirm safe to drop).
```

Replace `<TS>` and `<sha>` with the actual values from Task 7's commit.

- [ ] **Step 4: Modify TOMORROW.md to remove RLS rewrite from backlog**

Find this block in `TOMORROW.md`:

```markdown
高優先 fix(從 advisor 來):
- 120 `multiple_permissive_policies` 重寫 — availability_* + customer_purchases + service_packages + tenant_photos 多條 PERMISSIVE 合 OR
- 10 `auth_rls_initplan` 修 — `auth.uid()` 包 `(select ...)` 給 Postgres cache
```

Replace with:

```markdown
高優先 fix(從 advisor 來):
- ✅ 120 `multiple_permissive_policies` 重寫(commit `<sha>`,2026-05-28)
- ✅ 10 `auth_rls_initplan` wrap auth.uid()(同 commit)
- 14 個 SECURITY DEFINER RPC 逐個 review caller-guard(book_with_purchase / reschedule_booking_purchase / cancel_booking_refund 等)
```

Replace `<sha>` with the migration commit SHA.

- [ ] **Step 5: Commit docs**

```bash
git add docs/superpowers/specs/2026-05-28-supabase-advisors-snapshot.md TOMORROW.md
git commit -m "$(cat <<'EOF'
docs: mark RLS combine-permissive lints resolved (advisor snapshot + TOMORROW)

Updates 2026-05-28-supabase-advisors-snapshot.md and TOMORROW.md to reflect that the 120+10 RLS perf lints are fixed by the new migration. Companion plan stays at docs/superpowers/plans/2026-05-28-rls-rewrite-combine-permissive.md.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push origin master
```

- [ ] **Step 6: Manual spot-check on production**

Open https://quick-reserve-mu.vercel.app/ and verify:
- `/coach-poyu` 公開頁:hero + services + slot picker + photos all visible
- Login as `demo-coach-wang@example.com` → `/calendar/availability` templates list renders
- Login as a customer → `/my-bookings` sees own bookings
- Login as owner → `/packages/pending` sees pending purchases

If any of these is empty when it shouldn't be: that's an RLS regression — run rollback.

---

## Done Criteria

- ✅ `tests/integration/rls-rewrite-matrix.test.ts` exists with 28 cases, all passing
- ✅ Migration applied successfully
- ✅ Advisor `multiple_permissive_policies` and `auth_rls_initplan` count: 0
- ✅ All other integration tests still pass (no regression elsewhere)
- ✅ All 105 unit tests + 28 Playwright e2e (3 skipped) pass
- ✅ GitHub Actions e2e workflow green for the push
- ✅ Rollback file committed beside the spec
- ✅ Advisor snapshot doc and TOMORROW.md updated
- ✅ Manual spot check confirms 4 surfaces work as expected

---

## Self-Review

### Spec coverage

- ✅ "1 個 migration file" → Task 6
- ✅ "Re-pull Supabase advisor: 120 → 0, 10 → 0" → Task 7 Step 4
- ✅ "Per-table policy count" → covered by the 7-table change blocks in Task 6
- ✅ "28-case test file" → split across Tasks 1-4
- ✅ "rollback file beside spec" → Task 5
- ✅ "Apply order 13 steps" → mapped to Tasks 5-8 (1-3 was test scaffolding, 4-7 spec's 1-3, etc.)
- ✅ "Manual spot check 4 surfaces" → Task 8 Step 6
- ✅ "Update advisor snapshot + TOMORROW.md" → Task 8 Steps 3-5

### Placeholder scan

- `<TS>` appears in Task 6 Step 1-2 and Task 8 Step 3 — these are explicit instructions to substitute with the generated timestamp / commit SHA. Acceptable.
- `<your-token>` in Task 7 Step 1, 4 — instruction to use the user's Supabase access token. Acceptable.
- `<sha>` in Task 8 Step 3, 4 — substitution after commit. Acceptable.
- No "TBD" / "TODO" / vague handwaving.

### Type consistency

- `f.<field>` fixture names consistent across all 4 test tasks
- Helper functions referenced (`is_platform_admin`, `current_user_tenant_ids`, `current_user_owner_tenant_ids`) match actual DB functions (verified in spec exploration)
- Policy names consistent between migration and rollback files (new policies dropped first, old policies re-created)

### Scope

8 tasks split across 3 phases. Each task is 5-30 minutes. Phase 1 is 4 tasks of test code; phase 2 is 3 tasks of SQL + apply; phase 3 is 1 task of ship + docs. Fits one subagent-driven session well.
