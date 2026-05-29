# A-1: Interactive purchase selection on /book — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a customer with multiple active purchase packages choose which one to spend on a new booking; the RPC honors that choice, falling back to oldest-expiring when none is supplied (backwards compat).

**Architecture:** Bottom-up — migration first (changes the RPC signature), then integration test as the contract canary, then server action (thin pass-through), then UI (move enabled picker into BookForm to co-locate state with submit). Reschedule flow is untouched throughout.

**Tech Stack:** PostgreSQL PL/pgSQL (`SECURITY DEFINER` RPC), Supabase Postgres + Auth, Next.js 15 App Router, `next-safe-action` v8, React 19 `useState`, Vitest `@vitest-environment node` with `@supabase/supabase-js` admin + anon clients, `npx supabase db push` for migrations.

**Spec:** `docs/superpowers/specs/2026-05-29-interactive-purchase-selection-on-book-design.md` (commit `38010e5`)

---

## File map

| File | Type | Responsibility |
|---|---|---|
| `supabase/migrations/<TS>_book_with_purchase_optional_purchase_id.sql` | new | DROP 3-arg `book_with_purchase`, CREATE 4-arg with optional `p_purchase_id` + validation branch + `PURCHASE_INVALID` error |
| `tests/integration/book-with-purchase-selection.test.ts` | new | Vitest integration test: 3 cases proving user-supplied purchase is honored, invalid is rejected, cross-customer is rejected |
| `src/app/book/[slotId]/actions.ts` | edit | Extend schema with `purchaseId`, pass to RPC, map `PURCHASE_INVALID` → AppError |
| `src/app/book/[slotId]/book-form.tsx` | edit | Accept `purchases` + `defaultPurchaseId` props; own selection state; render enabled radio picker (moved from page.tsx) |
| `src/app/book/[slotId]/page.tsx` | edit | Remove inline `<section>` picker; pass new props to BookForm |
| `src/lib/supabase/types.ts` | regen | Run `npm run db:types` to pick up the new 4-arg signature |
| `TOMORROW.md` | edit | Mark A-1 done; backlog ordering survives |

---

## Task 1: Migration — `book_with_purchase` gains optional `p_purchase_id`

**Files:**
- Create: `supabase/migrations/20260529110000_book_with_purchase_optional_purchase_id.sql`

(Pick a fresh `20260529HHMMSS` timestamp after `20260529100100`. The two existing 2026-05-29 migrations end at `100100`; `110000` is safe and timestamp-ordered.)

- [ ] **Step 1: Write the migration SQL**

Create `supabase/migrations/20260529110000_book_with_purchase_optional_purchase_id.sql`:

```sql
-- A-1 (spec 2026-05-29-interactive-purchase-selection-on-book-design):
-- Allow caller to pick which purchase package to spend. The 3-arg form
-- silently consumed the oldest-expiring active purchase; the new 4-arg form
-- honours an explicit p_purchase_id when supplied (validated for ownership +
-- service + active + remaining classes) and falls back to oldest-expiring
-- when null. New error PURCHASE_INVALID (P0001) covers all 4 failure modes.
--
-- DROP the 3-arg signature first — adding a default-null arg creates a new
-- overload, leaving the old version coexisting and silently winning for any
-- caller that omits the new arg. Drop + recreate is the only way to retire
-- the old signature cleanly.

drop function if exists public.book_with_purchase(uuid, uuid, text);

create or replace function public.book_with_purchase(
  p_slot_id uuid,
  p_customer_id uuid,
  p_customer_notes text default null,
  p_purchase_id uuid default null
)
returns table (
  booking_id uuid,
  auto_confirmed boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot record;
  v_service record;
  v_purchase_id uuid;
  v_purchase_valid boolean;
  v_existing_count int;
  v_new_booking_id uuid;
  v_auto_confirmed boolean := false;
begin
  -- Guard: authenticated callers may only book for themselves.
  if auth.role() <> 'service_role' then
    if auth.uid() is null or p_customer_id <> auth.uid() then
      raise exception 'FORBIDDEN' using errcode = '42501';
    end if;
  end if;

  -- 1. Lock slot
  select id, tenant_id, service_id, status, start_at, end_at
    into v_slot
    from public.availability_slots
    where id = p_slot_id
    for update;
  if not found then
    raise exception 'SLOT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_slot.status not in ('available', 'pending') then
    raise exception 'SLOT_UNAVAILABLE' using errcode = 'P0001';
  end if;
  if v_slot.start_at <= now() then
    raise exception 'SLOT_PAST' using errcode = 'P0001';
  end if;

  -- 2. Load service capacity / min
  select id, max_capacity, min_attendance
    into v_service
    from public.services
    where id = v_slot.service_id;

  -- 3. Capacity check
  select count(*) into v_existing_count
    from public.bookings
    where slot_id = p_slot_id and status <> 'cancelled';
  if v_existing_count >= v_service.max_capacity then
    raise exception 'SLOT_FULL' using errcode = 'P0001';
  end if;

  -- 4. Choose purchase
  if p_purchase_id is not null then
    -- Validate caller-supplied selection: must belong to p_customer_id,
    -- match the slot's service, be confirmed, have remaining classes,
    -- and not be expired. Lock for update to prevent double-spend.
    select true into v_purchase_valid
      from public.customer_purchases
      where id = p_purchase_id
        and customer_id = p_customer_id
        and service_id = v_slot.service_id
        and approval_status = 'confirmed'
        and classes_used < classes_total
        and (expires_at is null or expires_at > now())
      for update;
    if v_purchase_valid is null then
      raise exception 'PURCHASE_INVALID' using errcode = 'P0001';
    end if;
    v_purchase_id := p_purchase_id;
  else
    -- Fall back to oldest-expiring active purchase (legacy behaviour)
    select id into v_purchase_id
      from public.customer_purchases
      where customer_id = p_customer_id
        and service_id = v_slot.service_id
        and approval_status = 'confirmed'
        and classes_used < classes_total
        and (expires_at is null or expires_at > now())
      order by
        case when expires_at is null then 1 else 0 end,
        expires_at asc nulls last,
        approved_at asc
      limit 1
      for update;
    if v_purchase_id is null then
      raise exception 'NO_BALANCE' using errcode = 'P0001';
    end if;
  end if;

  -- 5. Ensure tenant_customers bridge
  insert into public.tenant_customers (tenant_id, customer_id)
    values (v_slot.tenant_id, p_customer_id)
    on conflict (tenant_id, customer_id) do nothing;

  -- 6. Increment classes_used on chosen purchase
  update public.customer_purchases
    set classes_used = classes_used + 1
    where id = v_purchase_id;

  -- 7. Insert booking
  insert into public.bookings (
    tenant_id, slot_id, customer_id, service_id, status,
    customer_notes, purchase_id
  ) values (
    v_slot.tenant_id, p_slot_id, p_customer_id, v_slot.service_id, 'pending',
    p_customer_notes, v_purchase_id
  )
  returning id into v_new_booking_id;

  -- 8. Update slot status
  update public.availability_slots
    set status = 'pending', updated_at = now()
    where id = p_slot_id;

  -- 9. Auto-confirm if reached min_attendance
  if v_existing_count + 1 >= v_service.min_attendance then
    update public.bookings
      set status = 'confirmed'
      where slot_id = p_slot_id
        and status = 'pending';
    update public.availability_slots
      set status = 'booked'
      where id = p_slot_id;
    v_auto_confirmed := true;
  end if;

  booking_id := v_new_booking_id;
  auto_confirmed := v_auto_confirmed;
  return next;
end;
$$;

grant execute on function public.book_with_purchase(uuid, uuid, text, uuid) to authenticated;
```

- [ ] **Step 2: Apply the migration**

Run (the SUPABASE_ACCESS_TOKEN was provided in this session; export or prefix it):

```bash
SUPABASE_ACCESS_TOKEN=<token> npx supabase db push --linked
```

Expected: `Applying migration 20260529110000_book_with_purchase_optional_purchase_id.sql...` followed by `Finished supabase db push.`. If error mentions overload conflict, the DROP statement didn't run — verify the migration file starts with the `drop function if exists` line.

- [ ] **Step 3: Smoke test the new signature**

Sanity-check the migration produced the new 4-arg function. From a terminal with anon key + service key already in `.env.local`:

```bash
npx dotenv-cli -e .env.local -- node -e "const{createClient}=require('@supabase/supabase-js'); const a=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY); a.rpc('book_with_purchase',{p_slot_id:'00000000-0000-0000-0000-000000000000',p_customer_id:'00000000-0000-0000-0000-000000000000',p_customer_notes:null,p_purchase_id:null}).then(r=>console.log(JSON.stringify(r.error,null,2)))"
```

Expected: error code `P0002` with message `SLOT_NOT_FOUND`. That proves the 4-arg form is reachable and the body ran. If you get `PGRST116` / `could not find function` instead, the migration didn't reshape the signature — re-check the DROP.

- [ ] **Step 4: Commit the migration**

```bash
git add supabase/migrations/20260529110000_book_with_purchase_optional_purchase_id.sql
git commit -m "$(cat <<'EOF'
feat(rpc): book_with_purchase accepts optional p_purchase_id

Adds a 4th argument letting the caller name the purchase package to
consume; validates it belongs to the customer, matches the slot's
service, is confirmed, has remaining classes, and is not expired.
When null (default), falls back to the existing oldest-expiring choice
— so the previous 3-arg behaviour is preserved bit-for-bit.

DROP the 3-arg form first because adding a default-null arg creates
a new overload; otherwise the old signature would silently win for
3-arg callers and our app code would never reach the new validation.

New error PURCHASE_INVALID (errcode P0001) collapses wrong-customer,
wrong-service, used-up, and expired into one user-actionable code.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Integration test — purchase selection contract

**Files:**
- Create: `tests/integration/book-with-purchase-selection.test.ts`

This is the canary. It must run green against the migration applied in Task 1 before we touch any TypeScript. The pattern mirrors `tests/integration/atomic-booking.test.ts` (admin / service_role client bypasses the auth.uid() guard, exercising the purchase-validation branch directly).

- [ ] **Step 1: Write the test file**

Create `tests/integration/book-with-purchase-selection.test.ts`:

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
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const admin = createClient<Database>(SUPABASE_URL, SERVICE_KEY)

const ts = Date.now()
const ctx: {
  coachId?: string
  aliceId?: string
  bobId?: string
  tenantId?: string
  memberId?: string
  serviceId?: string
  slotAId?: string
  slotBId?: string
  alicePurchaseEarlierId?: string
  alicePurchaseLaterId?: string
  alicePurchaseUsedUpId?: string
  bobPurchaseId?: string
} = {}

describe('book_with_purchase: explicit p_purchase_id selection', () => {
  beforeAll(async () => {
    const { data: coach } = await admin.auth.admin.createUser({
      email: `coach-sel-${ts}@example.com`,
      password: 'TestPass123!',
      email_confirm: true,
    })
    ctx.coachId = coach!.user!.id
    const { data: alice } = await admin.auth.admin.createUser({
      email: `alice-sel-${ts}@example.com`,
      password: 'TestPass123!',
      email_confirm: true,
    })
    ctx.aliceId = alice!.user!.id
    const { data: bob } = await admin.auth.admin.createUser({
      email: `bob-sel-${ts}@example.com`,
      password: 'TestPass123!',
      email_confirm: true,
    })
    ctx.bobId = bob!.user!.id

    const { data: tenant } = await admin
      .from('tenants')
      .insert({ slug: `sel-${ts}`, name: 'Selection test' })
      .select()
      .single()
    ctx.tenantId = tenant!.id
    const { data: member } = await admin
      .from('tenant_members')
      .insert({ tenant_id: tenant!.id, user_id: coach!.user!.id, role: 'owner', status: 'active' })
      .select()
      .single()
    ctx.memberId = member!.id
    const { data: svc } = await admin
      .from('services')
      .insert({
        tenant_id: tenant!.id,
        name: '1-on-1 sel',
        duration_minutes: 60,
        max_capacity: 1,
        min_attendance: 1,
      })
      .select()
      .single()
    ctx.serviceId = svc!.id

    await admin.from('customers').upsert([
      { id: alice!.user!.id, display_name: 'Alice' },
      { id: bob!.user!.id, display_name: 'Bob' },
    ])

    // Alice gets THREE purchases:
    //   • earlier-expiring (would be the oldest-expiring auto-pick)
    //   • later-expiring (what we want the test to consume explicitly)
    //   • used-up (classes_used == classes_total, must reject)
    const now = new Date()
    const oneMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
    const twoMonths = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString()
    const { data: alicePurchases } = await admin
      .from('customer_purchases')
      .insert([
        {
          tenant_id: tenant!.id,
          customer_id: alice!.user!.id,
          service_id: svc!.id,
          classes_total: 5,
          classes_used: 0,
          approval_status: 'confirmed',
          approved_at: now.toISOString(),
          payment_self_reported: 'claimed_paid',
          expires_at: oneMonth,
        },
        {
          tenant_id: tenant!.id,
          customer_id: alice!.user!.id,
          service_id: svc!.id,
          classes_total: 5,
          classes_used: 0,
          approval_status: 'confirmed',
          approved_at: now.toISOString(),
          payment_self_reported: 'claimed_paid',
          expires_at: twoMonths,
        },
        {
          tenant_id: tenant!.id,
          customer_id: alice!.user!.id,
          service_id: svc!.id,
          classes_total: 1,
          classes_used: 1,
          approval_status: 'confirmed',
          approved_at: now.toISOString(),
          payment_self_reported: 'claimed_paid',
        },
      ])
      .select()
    const [earlier, later, usedUp] = alicePurchases ?? []
    if (!earlier || !later || !usedUp) throw new Error('failed to create alice purchases')
    ctx.alicePurchaseEarlierId = earlier.id
    ctx.alicePurchaseLaterId = later.id
    ctx.alicePurchaseUsedUpId = usedUp.id

    // Bob gets one purchase — used in the cross-customer rejection test
    const { data: bobPurchase } = await admin
      .from('customer_purchases')
      .insert({
        tenant_id: tenant!.id,
        customer_id: bob!.user!.id,
        service_id: svc!.id,
        classes_total: 5,
        classes_used: 0,
        approval_status: 'confirmed',
        approved_at: now.toISOString(),
        payment_self_reported: 'claimed_paid',
      })
      .select()
      .single()
    ctx.bobPurchaseId = bobPurchase!.id

    // Two slots so each mutating test has its own
    const baseHour = (offset: number) =>
      new Date(Date.now() + 1000 * 60 * 60 * 24 * 21 + offset * 1000 * 60 * 60).toISOString()
    const { data: slots } = await admin
      .from('availability_slots')
      .insert([
        {
          tenant_id: tenant!.id,
          member_id: member!.id,
          service_id: svc!.id,
          start_at: baseHour(0),
          end_at: baseHour(1),
        },
        {
          tenant_id: tenant!.id,
          member_id: member!.id,
          service_id: svc!.id,
          start_at: baseHour(2),
          end_at: baseHour(3),
        },
      ])
      .select()
    const [s0, s1] = slots ?? []
    if (!s0 || !s1) throw new Error('failed to create slots')
    ctx.slotAId = s0.id
    ctx.slotBId = s1.id
  }, 30_000)

  afterAll(async () => {
    if (ctx.tenantId) await admin.from('tenants').delete().eq('id', ctx.tenantId)
    if (ctx.coachId) await admin.auth.admin.deleteUser(ctx.coachId)
    if (ctx.aliceId) await admin.auth.admin.deleteUser(ctx.aliceId)
    if (ctx.bobId) await admin.auth.admin.deleteUser(ctx.bobId)
  }, 30_000)

  it('explicit p_purchase_id consumes the chosen purchase, not the oldest-expiring', async () => {
    const { data, error } = await admin.rpc('book_with_purchase', {
      p_slot_id: ctx.slotAId!,
      p_customer_id: ctx.aliceId!,
      p_purchase_id: ctx.alicePurchaseLaterId!,
    })
    expect(error).toBeNull()
    const row = (data as Array<{ booking_id: string; auto_confirmed: boolean }>)[0]
    expect(row?.booking_id).toBeDefined()

    // The chosen (later-expiring) purchase went from 0 → 1
    const { data: laterRow } = await admin
      .from('customer_purchases')
      .select('classes_used')
      .eq('id', ctx.alicePurchaseLaterId!)
      .single()
    expect(laterRow?.classes_used).toBe(1)

    // The earlier-expiring one — the oldest-expiring auto-pick — stayed at 0
    const { data: earlierRow } = await admin
      .from('customer_purchases')
      .select('classes_used')
      .eq('id', ctx.alicePurchaseEarlierId!)
      .single()
    expect(earlierRow?.classes_used).toBe(0)
  })

  it('passing a used-up purchase raises PURCHASE_INVALID', async () => {
    const { error } = await admin.rpc('book_with_purchase', {
      p_slot_id: ctx.slotBId!,
      p_customer_id: ctx.aliceId!,
      p_purchase_id: ctx.alicePurchaseUsedUpId!,
    })
    expect(error).not.toBeNull()
    expect(error?.message).toContain('PURCHASE_INVALID')

    // Slot B was untouched
    const { data: slot } = await admin
      .from('availability_slots')
      .select('status')
      .eq('id', ctx.slotBId!)
      .single()
    expect(slot?.status).toBe('available')
  })

  it("passing another customer's purchase raises PURCHASE_INVALID", async () => {
    const { error } = await admin.rpc('book_with_purchase', {
      p_slot_id: ctx.slotBId!,
      p_customer_id: ctx.aliceId!,
      p_purchase_id: ctx.bobPurchaseId!,
    })
    expect(error).not.toBeNull()
    expect(error?.message).toContain('PURCHASE_INVALID')

    // Bob's purchase classes_used stayed at 0 (no consumption)
    const { data: bobRow } = await admin
      .from('customer_purchases')
      .select('classes_used')
      .eq('id', ctx.bobPurchaseId!)
      .single()
    expect(bobRow?.classes_used).toBe(0)
  })
})
```

- [ ] **Step 2: Run the test, expect all green**

```bash
npx dotenv-cli -e .env.local -- npx vitest run tests/integration/book-with-purchase-selection.test.ts --reporter=verbose
```

Expected: `3 passed`. If "explicit p_purchase_id consumes the chosen purchase" fails because `earlierRow.classes_used` is 1 (not 0), the validation branch is being skipped — re-read the migration and verify the `if p_purchase_id is not null` branch runs. If the used-up test fails with `NO_BALANCE` instead of `PURCHASE_INVALID`, you mis-wired the fallback branch.

- [ ] **Step 3: Run the full integration suite — verify no regressions**

```bash
npx dotenv-cli -e .env.local -- npm run test:integration
```

Expected: All previously-green suites stay green (rpc-cross-customer-guard 3/3, atomic-booking 4/4, exclude-constraint 2/2, recurring-rules, rls-identity, staff-isolation, rls-rewrite-matrix). The new suite adds 3 more.

- [ ] **Step 4: Commit the test**

```bash
git add tests/integration/book-with-purchase-selection.test.ts
git commit -m "$(cat <<'EOF'
test(rpc): integration coverage for p_purchase_id selection

Three cases against the 4-arg book_with_purchase signature:
- explicit purchase id consumes that one, not oldest-expiring
- used-up purchase id raises PURCHASE_INVALID, slot untouched
- other customer's purchase id raises PURCHASE_INVALID, victim untouched

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Server action — accept `purchaseId`, pass through, map error

**Files:**
- Modify: `src/app/book/[slotId]/actions.ts:14-18, 56-60, 69-73`

- [ ] **Step 1: Extend `CreateBookingSchema`**

Edit `src/app/book/[slotId]/actions.ts`. Replace the existing `CreateBookingSchema` block (currently lines 14-18):

```ts
const CreateBookingSchema = z.object({
  slotId: z.string().uuid(),
  customerNotes: z.string().max(500).optional().nullable(),
  rescheduleFrom: z.string().uuid().optional().nullable(),
  purchaseId: z.string().uuid().optional().nullable(),
})
```

- [ ] **Step 2: Pass `p_purchase_id` to the RPC call**

In the same file, replace the existing `supabase.rpc('book_with_purchase', ...)` call (currently lines 56-60). The reschedule branch above it is unchanged — `reschedule_booking` does not take a purchase_id.

```ts
const { data, error } = await supabase.rpc('book_with_purchase', {
  p_slot_id: parsedInput.slotId,
  p_customer_id: session.userId,
  p_customer_notes: parsedInput.customerNotes ?? undefined,
  p_purchase_id: parsedInput.purchaseId ?? undefined,
})
```

- [ ] **Step 3: Add the PURCHASE_INVALID error mapping**

In the same file, add a new branch immediately after the existing `NO_BALANCE` mapping (currently lines 69-70). The order matters — keep it grouped with the other purchase-related codes.

```ts
if (error.message?.includes('NO_BALANCE'))
  throw new AppError('NO_BALANCE', '需先購買套裝才能預約')
if (error.message?.includes('PURCHASE_INVALID'))
  throw new AppError('PURCHASE_INVALID', '選擇的套裝不可用,請重新選擇')
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

Expected: clean exit (no errors).

The action change is a thin pass-through; the integration test in Task 2 already proves the RPC contract. No new unit test is needed.

(No commit yet — Task 4's UI changes belong to the same feature and will commit together.)

---

## Task 4: Move purchase picker into BookForm; enable interactivity

**Files:**
- Modify: `src/app/book/[slotId]/book-form.tsx` (full rewrite is cleanest given new state + new section)
- Modify: `src/app/book/[slotId]/page.tsx:195-245` (remove the inline picker section; pass props)

The picker moves from `page.tsx` into `book-form.tsx` so the React state (`selectedPurchaseId`) co-locates with the submit. Visual markup is preserved bit-for-bit; only `disabled` is removed and the radio is now controlled.

- [ ] **Step 1: Rewrite `book-form.tsx`**

Replace the entire contents of `src/app/book/[slotId]/book-form.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PrimaryCta } from '@/components/ui/primary-cta'
import { SectionHead } from '@/components/ui/section-head'
import { createBookingAction } from './actions'

type PurchaseOption = {
  id: string
  classes_total: number
  classes_used: number
  expires_at: string | null
  service_packages: { name: string } | null
}

export default function BookForm({
  slotId,
  rescheduleFrom,
  purchases,
  defaultPurchaseId,
}: {
  slotId: string
  rescheduleFrom?: string | null
  purchases: PurchaseOption[]
  defaultPurchaseId: string
}) {
  const [customerNotes, setCustomerNotes] = useState('')
  const [selectedPurchaseId, setSelectedPurchaseId] = useState(defaultPurchaseId)
  const { execute, isPending } = useAction(createBookingAction, {
    onError: ({ error }) =>
      toast.error(error.serverError?.message ?? (rescheduleFrom ? '改期失敗' : '預約失敗')),
  })

  return (
    <form
      className="space-y-7"
      onSubmit={(e) => {
        e.preventDefault()
        execute({
          slotId,
          customerNotes: customerNotes || null,
          rescheduleFrom: rescheduleFrom ?? null,
          purchaseId: rescheduleFrom ? null : selectedPurchaseId,
        })
      }}
    >
      {!rescheduleFrom && (
        <>
          <section>
            <SectionHead
              kicker="PACKAGE · 套裝餘額"
              title="本次將扣除"
              eng="DEDUCT"
              hint="預設挑最快到期的;可手動切換成其他有效套裝。"
            />
            <div className="grid gap-3">
              {purchases.map((p) => {
                const remaining = p.classes_total - p.classes_used
                const total = p.classes_total
                const percent = total > 0 ? (remaining / total) * 100 : 0
                const pkgName = p.service_packages?.name ?? '套裝'
                return (
                  <label
                    key={p.id}
                    className="flex cursor-pointer items-center gap-4 rounded-2xl border border-border bg-card p-5 transition-colors has-[:checked]:border-foreground has-[:checked]:bg-accent has-[:checked]:text-accent-foreground"
                  >
                    <input
                      type="radio"
                      name="package"
                      value={p.id}
                      checked={p.id === selectedPurchaseId}
                      onChange={() => setSelectedPurchaseId(p.id)}
                      className="size-4 accent-foreground"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-cjk truncate text-sm font-semibold">{pkgName}</div>
                      <div className="font-mono mt-1 text-xs tracking-wider text-muted-foreground">
                        {remaining}/{total} 堂
                        {p.expires_at ? (
                          <>
                            {' · '}期限 {format(new Date(p.expires_at), 'yyyy/MM/dd')}
                          </>
                        ) : null}
                      </div>
                      <div className="bg-muted mt-2 h-1 overflow-hidden rounded-full">
                        <div
                          className="bg-foreground h-full"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                    <div className="font-display text-2xl leading-none">{remaining}</div>
                  </label>
                )
              })}
            </div>
          </section>

          <div className="space-y-2">
            <Label htmlFor="notes" className="font-mono text-[11px] uppercase tracking-wider">
              備註(選填) NOTES
            </Label>
            <Input
              id="notes"
              value={customerNotes}
              onChange={(e) => setCustomerNotes(e.target.value)}
              placeholder="例如:第一次上課、想學發球..."
              className="font-cjk h-12 rounded-xl border-2 border-border bg-background px-4 text-sm"
            />
          </div>
        </>
      )}
      <PrimaryCta type="submit" disabled={isPending} className="w-full justify-between">
        {isPending
          ? rescheduleFrom
            ? '改期中...'
            : '送出中...'
          : rescheduleFrom
            ? '確認改期'
            : '送出預約申請'}
      </PrimaryCta>
      <p className="font-cjk text-center text-xs text-muted-foreground">
        {rescheduleFrom
          ? '原預約將被取消,並建立新的「待確認」預約。'
          : '送出後狀態為「待確認」,教練確認後即正式成立。'}
      </p>
    </form>
  )
}
```

- [ ] **Step 2: Trim `page.tsx` — remove the inline picker section, pass new props**

Edit `src/app/book/[slotId]/page.tsx`. Delete the entire `{/* Package balance picker ... */}` `<section>` block (currently lines 195-245 — runs from the comment through the closing `</section>`). The `{/* Cancellation policy */}` block immediately below stays.

Then update the `<BookForm ... />` call (currently line 262) to pass the new props:

```tsx
<BookForm
  slotId={slotId}
  rescheduleFrom={rescheduleFrom ?? null}
  purchases={activePurchases}
  defaultPurchaseId={activePurchase.id}
/>
```

After the edit, `page.tsx` no longer renders the picker — `BookForm` owns it. The `activePurchases` array and `activePurchase` server-side query at lines 121-134 stay; they still feed the props.

Remove unused imports from `page.tsx` after deletion: `format` from `date-fns` was used only inside the picker; if the slot detail card above still uses it (it does — `format(start, 'EEEE, MMM dd')`), leave the import. Verify by reading the surviving JSX. The radio-card-specific `service_packages` typing on `ActivePurchaseRow` (line 19) stays — `activePurchases` still references it.

- [ ] **Step 3: Typecheck + lint + unit**

```bash
npm run typecheck && npm run lint && npm test
```

Expected: `typecheck` clean. `lint`: `No ESLint warnings or errors`. Unit: `Tests 111 passed (111)` or higher.

- [ ] **Step 4: Manual UI verification**

Start the dev server and walk the flow once.

```bash
npm run dev
```

In a browser:
1. Sign in at `http://localhost:3000/login` as `demo-student-ming@example.com` / `Test1234!` (or any student with ≥2 active purchases for the same service)
2. Navigate to a coach's public page (e.g. `/demo-wang-coach`)
3. Pick an open time chip → click the CTA → land on `/book/<slotId>`
4. Confirm the picker now responds to clicks (selected card gets `bg-accent` highlight; radio dot moves)
5. **Do not submit** — that would create a real test booking. Closing the tab is the test boundary.

If the picker doesn't react to clicks, re-check that `disabled` is removed and `onChange` is wired in `book-form.tsx`. If the radio jumps back to the default after a click, `checked` and `setSelectedPurchaseId` are not co-located on the same state.

- [ ] **Step 5: Run full Playwright suite (drift-safe, no-submit)**

```bash
npx playwright test --reporter=list
```

Expected: 30 passed + 3 skipped against localhost. The booking-flow tests added yesterday will navigate to `/book` and assert chrome — they don't click submit, so they continue to pass.

---

## Task 5: Regen types, final verification, commit, push

**Files:**
- Regen: `src/lib/supabase/types.ts`
- Modify: `TOMORROW.md`

- [ ] **Step 1: Regen Supabase types**

```bash
SUPABASE_ACCESS_TOKEN=<token> npm run db:types
```

Then check the diff:

```bash
git diff src/lib/supabase/types.ts
```

Expected: the `book_with_purchase` function entry in the `Functions` interface gains a 4th argument `p_purchase_id: string | null` (or similar). If the diff is empty, the regen didn't pick up the new schema — re-run with the token, or wait a few seconds and retry (Supabase introspection can briefly lag).

- [ ] **Step 2: Typecheck once more with the new types in place**

```bash
npm run typecheck
```

Expected: clean. If the action call now complains about `p_purchase_id` being unknown, the types regen didn't land — re-run Step 1.

- [ ] **Step 3: Build**

```bash
npm run build
```

Expected: succeeds; no new pages added so the route count stays at 33. If a route disappears, you accidentally broke a server component — diff `page.tsx` and `book-form.tsx`.

- [ ] **Step 4: Update `TOMORROW.md`**

Mark the A-1 item complete. Locate the "方向 A:Phase 2 backlog" section and replace the bullet for item 1:

```markdown
1. ~~互動式套裝選擇 on `/book`~~ — ✅ 2026-05-29 ship。`book_with_purchase` RPC 加 4th arg `p_purchase_id`;page.tsx 的 disabled radio 搬進 `book-form.tsx` 變 interactive;3/3 integration test 涵蓋 explicit pick / used-up / cross-customer。
```

- [ ] **Step 5: Commit UI + action + types + docs**

```bash
git add src/app/book/[slotId]/actions.ts src/app/book/[slotId]/book-form.tsx src/app/book/[slotId]/page.tsx src/lib/supabase/types.ts TOMORROW.md
git commit -m "$(cat <<'EOF'
feat(book): wire interactive purchase selection through to RPC

Picker on /book is now enabled. Move it from page.tsx into book-form.tsx
so the selected purchase id lives next to the submit state. Server
action grows a `purchaseId` field, passes it as p_purchase_id, maps the
new PURCHASE_INVALID code to a user-actionable toast. Types regen picks
up the 4-arg RPC signature.

Reschedule path is unchanged — reschedule_booking carries the original
purchase forward, and BookForm continues to hide the picker when
rescheduleFrom is set.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 6: Push to master**

```bash
git push origin master
```

Then check the GitHub Actions e2e workflow run for this commit:

```bash
gh run list --limit 1 --workflow=e2e.yml
```

It will be `in_progress` immediately after push; expect green (~4 min) since the only customer-facing behaviour change is the picker being enabled — the no-submit Playwright tests don't exercise the radio.

---

## Self-review (against spec)

Spec coverage check — every section of `2026-05-29-interactive-purchase-selection-on-book-design.md`:

| Spec item | Covered by |
|---|---|
| Migration with optional 4th arg + validation + PURCHASE_INVALID | Task 1 |
| DROP-then-CREATE to avoid overload | Task 1 Step 1 (drop line first) |
| Auth.uid() guard preserved | Task 1 Step 1 (lines included verbatim) |
| Schema gains `purchaseId` | Task 3 Step 1 |
| RPC call passes p_purchase_id | Task 3 Step 2 |
| Error mapping | Task 3 Step 3 |
| page.tsx removes inline picker, passes new props | Task 4 Step 2 |
| book-form.tsx renders enabled radio + owns state | Task 4 Step 1 |
| Integration test (3 cases) | Task 2 Step 1 |
| Reschedule untouched | Task 3 Step 2 (reschedule branch left intact); Task 4 Step 1 (`!rescheduleFrom` guard around picker) |
| Types regen | Task 5 Step 1 |
| TOMORROW.md updated | Task 5 Step 4 |

No gaps.

Placeholder scan: no "TBD" or "etc.". Every code step shows the actual code. The migration timestamp `20260529110000` is concrete. The `<token>` placeholder in commands is intentional — the actual token is provided at runtime, not hardcoded into the plan.

Type / name consistency:
- `purchaseId` (camelCase) used in schema + action input + `BookForm` prop name `purchases` plural / `defaultPurchaseId` / `selectedPurchaseId` — consistent
- `p_purchase_id` (snake_case with prefix) used in SQL + RPC call site — matches Supabase RPC convention
- `PURCHASE_INVALID` error string used in migration `raise exception`, integration test `expect(error?.message).toContain(...)`, and action `error.message?.includes(...)` — same string everywhere

Scope: focused on a single user-facing feature with one migration, one new test file, three TypeScript file edits, one types regen. Fits a single plan.

No issues found. Ready to execute.
