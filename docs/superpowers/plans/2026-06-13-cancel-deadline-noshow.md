# Cancel-Deadline Refund + No-Show Marking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refund a booked class only when the student cancels within the service's cancel deadline; late cancels and no-shows forfeit the class; mark un-attended past bookings as `no_show` (label only).

**Architecture:** One status enum addition (`no_show`); a deadline-aware `cancel_booking` RPC (staff/admin cancels always refund, customer cancels refund only within `cancel_deadline_hours`); a no-show sweep appended to the existing every-minute `checkin-reminder` cron (pure labeling, never touches `classes_used`); a shared pure `isWithinCancelDeadline` helper driving the customer-side cancel warning.

**Tech Stack:** Next.js App Router, Supabase (Postgres RPC, pg_cron), next-safe-action, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-13-cancel-deadline-noshow-design.md`

**Conventions (verified in repo):**
- RPC: `language plpgsql security definer set search_path = public`; errcodes `42501`/`P0001`/`P0002`. Pattern: `supabase/migrations/20260529140000_group_slot_lifecycle_fix.sql` (current `cancel_booking`).
- Constraint rename via do-block (auto-named inline CHECK). Pattern: `supabase/migrations/20260529130000_customer_purchases_partial_paid_and_note.sql`.
- Migrations applied via Supabase MCP `apply_migration` (remote). After column/enum changes, regenerate types: `npm run db:types` (now works after `supabase login`; fallback = MCP `generate_typescript_types`).
- Integration tests run against live Supabase via `npm run test:integration`; user-scoped (non-service-role) RPC calls require signing in with the anon key — pattern: `tests/integration/rpc-cross-customer-guard.test.ts` and `tests/integration/checkin-booking.test.ts`.
- Cron route: Bearer `CRON_SECRET` guard + admin client. Pattern: `src/app/api/cron/checkin-reminder/route.ts`.

**Key decision (from spec):** Refund is governed SOLELY by the cancel deadline. `no_show` never changes `classes_used` — the class was deducted at booking and is forfeited simply by not being refunded. Deduction stays at booking time; check-in stays attendance-only.

---

## File Structure

**Create:**
- `supabase/migrations/20260613110000_bookings_status_no_show.sql` — add `no_show` to status CHECK
- `supabase/migrations/20260613110100_cancel_booking_deadline.sql` — deadline-aware refund
- `src/lib/cancel-deadline.ts` — pure `isWithinCancelDeadline`
- `tests/unit/cancel-deadline.test.ts`
- `tests/integration/cancel-booking-deadline.test.ts`

**Modify:**
- `src/app/api/cron/checkin-reminder/route.ts` — append no-show sweep
- `src/components/ui/badge.tsx` — `no_show` in StatusType/variant/label
- `src/app/(customer)/my-bookings/my-bookings-content.tsx` — query `cancel_deadline_hours`, compute within-deadline, no_show display
- `src/app/(customer)/my-bookings/cancel-button.tsx` — deadline-aware confirm text + toast
- `README.md` — notifications/booking section
- `docs/superpowers/specs/2026-06-13-cancel-deadline-noshow-design.md` — mark done

---

## Task 1: Migration — add `no_show` booking status

**Files:**
- Create: `supabase/migrations/20260613110000_bookings_status_no_show.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Cancel-deadline + no-show (spec 2026-06-13): add a terminal 'no_show' status.
-- The original status CHECK is inline (auto-named); drop by looked-up name then recreate.
do $$
declare cname text;
begin
  select conname into cname
    from pg_constraint
    where conrelid = 'public.bookings'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
      and pg_get_constraintdef(oid) ilike '%pending%';
  if cname is not null then
    execute format('alter table public.bookings drop constraint %I', cname);
  end if;
end $$;

alter table public.bookings
  add constraint bookings_status_check
  check (status in ('pending', 'confirmed', 'completed', 'cancelled', 'no_show'));
```

- [ ] **Step 2: Apply the migration**

Apply via Supabase MCP `apply_migration`, name `bookings_status_no_show`, SQL above. Expected: success.

- [ ] **Step 3: Verify the constraint**

Run via Supabase MCP `execute_sql`:
```sql
select pg_get_constraintdef(oid) from pg_constraint
where conrelid='public.bookings'::regclass and conname='bookings_status_check';
```
Expected: definition contains `'no_show'`.

- [ ] **Step 4: Regenerate types**

Run: `npm run db:types` (if it errors, use the Supabase MCP `generate_typescript_types` and overwrite `src/lib/supabase/types.ts`).
Expected: `git diff src/lib/supabase/types.ts` shows `no_show` added to the bookings status union.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260613110000_bookings_status_no_show.sql src/lib/supabase/types.ts
git commit -m "feat(booking): add no_show booking status"
```

---

## Task 2: Pure helper — `isWithinCancelDeadline`

**Files:**
- Create: `src/lib/cancel-deadline.ts`
- Test: `tests/unit/cancel-deadline.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { isWithinCancelDeadline } from '@/lib/cancel-deadline'

const start = '2026-06-13T12:00:00.000Z'

describe('isWithinCancelDeadline', () => {
  it('true well before the cutoff (24h deadline)', () => {
    // cutoff = start - 24h = 2026-06-12T12:00; now earlier => within
    expect(isWithinCancelDeadline(new Date('2026-06-12T08:00:00.000Z'), start, 24)).toBe(true)
  })
  it('true exactly at the cutoff', () => {
    expect(isWithinCancelDeadline(new Date('2026-06-12T12:00:00.000Z'), start, 24)).toBe(true)
  })
  it('false one second after the cutoff', () => {
    expect(isWithinCancelDeadline(new Date('2026-06-12T12:00:01.000Z'), start, 24)).toBe(false)
  })
  it('deadline 0 means refund allowed right up to start', () => {
    expect(isWithinCancelDeadline(new Date('2026-06-13T11:59:59.000Z'), start, 0)).toBe(true)
    expect(isWithinCancelDeadline(new Date('2026-06-13T12:00:01.000Z'), start, 0)).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/cancel-deadline.test.ts`
Expected: FAIL — cannot resolve `@/lib/cancel-deadline`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/cancel-deadline.ts
/** True when `now` is at or before (start − deadlineHours) — i.e. a customer cancel still earns a refund. */
export function isWithinCancelDeadline(now: Date, startAt: string, deadlineHours: number): boolean {
  const cutoff = new Date(startAt).getTime() - deadlineHours * 3600_000
  return now.getTime() <= cutoff
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/cancel-deadline.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/cancel-deadline.ts tests/unit/cancel-deadline.test.ts
git commit -m "feat(booking): pure cancel-deadline helper"
```

---

## Task 3: `cancel_booking` RPC — deadline-aware refund

**Files:**
- Create: `supabase/migrations/20260613110100_cancel_booking_deadline.sql`
- Test: `tests/integration/cancel-booking-deadline.test.ts`

- [ ] **Step 1: Write the migration**

```sql
-- Cancel-deadline refund (spec 2026-06-13): customer cancels refund ONLY within
-- the service's cancel_deadline_hours; staff/admin cancels always refund. Late
-- customer cancels still cancel the booking + free the slot, but forfeit the class.
-- Also block re-cancelling terminal states incl. the new 'no_show'.

create or replace function public.cancel_booking(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
  v_is_customer boolean;
  v_is_member boolean;
  v_is_admin boolean;
  v_remaining int;
  v_slot record;
  v_refund boolean;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0002'; end if;

  v_is_customer := (v_booking.customer_id = auth.uid());
  select exists (
    select 1 from public.tenant_members
    where tenant_id = v_booking.tenant_id and user_id = auth.uid() and status = 'active'
  ) into v_is_member;
  v_is_admin := public.is_platform_admin();
  if not v_is_customer and not v_is_member and not v_is_admin then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if v_booking.status in ('cancelled', 'completed', 'no_show') then
    raise exception 'INVALID_STATE' using errcode = 'P0001';
  end if;

  -- Refund eligibility: staff/admin always refund; customer only within deadline.
  if v_is_member or v_is_admin then
    v_refund := true;
  else
    select s.start_at as start_at, sv.cancel_deadline_hours as deadline_hours
      into v_slot
      from public.availability_slots s
      join public.services sv on sv.id = s.service_id
      where s.id = v_booking.slot_id;
    v_refund := now() <= v_slot.start_at - (v_slot.deadline_hours || ' hours')::interval;
  end if;

  if v_refund then
    update public.customer_purchases
      set classes_used = classes_used - 1
      where id = v_booking.purchase_id and classes_used > 0;
  end if;

  update public.bookings
    set status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid()
    where id = p_booking_id
    returning * into v_booking;

  select count(*) into v_remaining
    from public.bookings
    where slot_id = v_booking.slot_id and status <> 'cancelled';
  update public.availability_slots
    set status = case when v_remaining = 0 then 'available' else 'pending' end
    where id = v_booking.slot_id;

  return v_booking;
end;
$$;

grant execute on function public.cancel_booking(uuid) to authenticated;
```

- [ ] **Step 2: Write the failing integration test**

First READ `tests/integration/checkin-booking.test.ts` and `tests/integration/rpc-cross-customer-guard.test.ts` to copy: (a) the `ws` WebSocket setup, (b) how to make an authenticated (user-scoped, anon-key) client by signing in a customer/coach with a known password, (c) the tenant/member/service/customer/purchase/slot/booking fixture helpers. Then create `tests/integration/cancel-booking-deadline.test.ts`:

```ts
// @vitest-environment node
import WebSocket from 'ws'
if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket
}
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const admin = createClient<Database>(URL, SERVICE)
const ts = Date.now()
const PW = 'TestPass123!'
const ctx: any = {}

async function signedInClient(email: string) {
  const c = createClient<Database>(URL, ANON)
  const { error } = await c.auth.signInWithPassword({ email, password: PW })
  if (error) throw new Error(`signIn ${email}: ${error.message}`)
  return c
}
// service must have cancel_deadline_hours = 24 (default)
async function makeSlot(memberId: string, startOffsetMin: number) {
  const start = new Date(Date.now() + startOffsetMin * 60_000)
  const { data } = await admin.from('availability_slots').insert({
    tenant_id: ctx.tenantId, member_id: memberId, service_id: ctx.serviceId,
    start_at: start.toISOString(), end_at: new Date(start.getTime() + 60 * 60_000).toISOString(), status: 'booked',
  }).select().single()
  return data!.id as string
}
async function makeBookingWithPurchase(slotId: string) {
  const { data: p } = await admin.from('customer_purchases').insert({
    tenant_id: ctx.tenantId, customer_id: ctx.custId, service_id: ctx.serviceId,
    classes_total: 5, classes_used: 1, approval_status: 'confirmed',
    approved_at: new Date().toISOString(), payment_self_reported: 'claimed_paid',
  }).select().single()
  const { data: b } = await admin.from('bookings').insert({
    tenant_id: ctx.tenantId, slot_id: slotId, customer_id: ctx.custId,
    service_id: ctx.serviceId, purchase_id: p!.id, status: 'confirmed',
  }).select().single()
  return { bookingId: b!.id as string, purchaseId: p!.id as string }
}
async function usedCount(purchaseId: string) {
  const { data } = await admin.from('customer_purchases').select('classes_used').eq('id', purchaseId).single()
  return data!.classes_used as number
}

describe('cancel_booking deadline-aware refund', () => {
  beforeAll(async () => {
    const { data: coach } = await admin.auth.admin.createUser({ email: `coach-cd-${ts}@example.com`, password: PW, email_confirm: true })
    ctx.coachUserId = coach!.user!.id
    const { data: t } = await admin.from('tenants').insert({ slug: `cd-${ts}`, name: 'CD Tenant' }).select().single()
    ctx.tenantId = t!.id
    const { data: m } = await admin.from('tenant_members').insert({ tenant_id: ctx.tenantId, user_id: ctx.coachUserId, role: 'owner', status: 'active' }).select().single()
    ctx.memberId = m!.id
    const { data: s } = await admin.from('services').insert({ tenant_id: ctx.tenantId, name: 'CD Svc', duration_minutes: 60, cancel_deadline_hours: 24 }).select().single()
    ctx.serviceId = s!.id
    const { data: cu } = await admin.auth.admin.createUser({ email: `cust-cd-${ts}@example.com`, password: PW, email_confirm: true })
    ctx.custId = cu!.user!.id
    await admin.from('customers').insert({ id: ctx.custId, display_name: 'CD Cust' })
    ctx.custClient = await signedInClient(`cust-cd-${ts}@example.com`)
    ctx.coachClient = await signedInClient(`coach-cd-${ts}@example.com`)
  })
  afterAll(async () => { if (ctx.tenantId) await admin.from('tenants').delete().eq('id', ctx.tenantId) })

  it('customer cancel WITHIN deadline refunds', async () => {
    const slot = await makeSlot(ctx.memberId, 48 * 60) // 48h away, deadline 24h => within
    const { bookingId, purchaseId } = await makeBookingWithPurchase(slot)
    const { error } = await ctx.custClient.rpc('cancel_booking', { p_booking_id: bookingId })
    expect(error).toBeNull()
    expect(await usedCount(purchaseId)).toBe(0) // 1 -> 0 (refunded)
  })

  it('customer cancel PAST deadline does NOT refund but still cancels', async () => {
    const slot = await makeSlot(ctx.memberId, 12 * 60) // 12h away, deadline 24h => past
    const { bookingId, purchaseId } = await makeBookingWithPurchase(slot)
    const { error } = await ctx.custClient.rpc('cancel_booking', { p_booking_id: bookingId })
    expect(error).toBeNull()
    expect(await usedCount(purchaseId)).toBe(1) // unchanged (forfeited)
    const { data: b } = await admin.from('bookings').select('status').eq('id', bookingId).single()
    expect(b!.status).toBe('cancelled')
  })

  it('coach cancel PAST deadline still refunds', async () => {
    const slot = await makeSlot(ctx.memberId, 12 * 60)
    const { bookingId, purchaseId } = await makeBookingWithPurchase(slot)
    const { error } = await ctx.coachClient.rpc('cancel_booking', { p_booking_id: bookingId })
    expect(error).toBeNull()
    expect(await usedCount(purchaseId)).toBe(0) // refunded despite past deadline
  })
})
```

- [ ] **Step 3: Run the test to verify it FAILS**

Run: `npm run test:integration -- cancel-booking-deadline`
Expected: FAIL — the "past deadline" test fails because the current `cancel_booking` refunds unconditionally (used count would be 0, test expects 1). (If env/DB unreachable, STOP and report BLOCKED.)

- [ ] **Step 4: Apply the migration**

Apply via Supabase MCP `apply_migration`, name `cancel_booking_deadline`, SQL from Step 1.

- [ ] **Step 5: Run the test to verify it PASSES**

Run: `npm run test:integration -- cancel-booking-deadline`
Expected: PASS (3 tests).

- [ ] **Step 6: Run advisors**

Supabase MCP `get_advisors` security + performance. Report any NEW finding for `cancel_booking` (expect none beyond the by-design `authenticated_security_definer` WARN shared by all RPCs).

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260613110100_cancel_booking_deadline.sql tests/integration/cancel-booking-deadline.test.ts
git commit -m "feat(booking): cancel_booking refunds only within deadline (staff/admin always)"
```

---

## Task 4: No-show sweep in the checkin-reminder cron

**Files:**
- Modify: `src/app/api/cron/checkin-reminder/route.ts`

- [ ] **Step 1: Add the sweep**

In `src/app/api/cron/checkin-reminder/route.ts`, immediately BEFORE the final `return NextResponse.json({...})`, insert the no-show sweep, and add `noShowMarked` to the response object.

```ts
  // No-show sweep: confirmed + not-checked-in + slot already ended -> mark no_show.
  // Label only: the class was deducted at booking and is forfeited by not being
  // refunded (no classes_used change here). 30-day floor avoids scanning ancient rows
  // on first run; once marked, rows leave the 'confirmed' set and aren't rescanned.
  const noShowFloor = new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString()
  const { data: endedRows } = await admin
    .from('bookings')
    .select('id, availability_slots!inner(end_at)')
    .eq('status', 'confirmed')
    .is('checked_in_at', null)
    .lt('availability_slots.end_at', now.toISOString())
    .gte('availability_slots.end_at', noShowFloor)
  const noShowIds = (endedRows ?? []).map((r) => r.id)
  let noShowMarked = 0
  if (noShowIds.length > 0) {
    const { error: nsErr } = await admin.from('bookings').update({ status: 'no_show' }).in('id', noShowIds)
    if (!nsErr) noShowMarked = noShowIds.length
  }
```

Then change the response to include it:
```ts
  return NextResponse.json({
    scanned: rows.length,
    reminders,
    missingStudents: planned.filter((p) => p.kind === 'missing').length,
    coachAlerts,
    noShowMarked,
    timestamp: now.toISOString(),
  })
```

- [ ] **Step 2: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: clean. (If the embedded `availability_slots!inner(end_at)` select type fights the `.map((r) => r.id)`, the row type is inferred; `r.id` is a plain column so it resolves. If lint flags an unused var, remove it.)

- [ ] **Step 3: Commit**

```bash
git add src/app/api/cron/checkin-reminder/route.ts
git commit -m "feat(booking): mark past un-checked-in bookings as no_show in cron sweep"
```

---

## Task 5: Frontend — no_show badge + deadline-aware cancel

**Files:**
- Modify: `src/components/ui/badge.tsx`
- Modify: `src/app/(customer)/my-bookings/my-bookings-content.tsx`
- Modify: `src/app/(customer)/my-bookings/cancel-button.tsx`

- [ ] **Step 1: Add `no_show` to StatusBadge**

In `src/components/ui/badge.tsx`:
- Extend the type: `export type StatusType = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'`
- Add to `STATUS_VARIANT`: `no_show: 'outline',`
- Add to `STATUS_LABEL`: `no_show: '未到場',`

- [ ] **Step 2: Update `cancel-button.tsx` for deadline awareness**

Replace `src/app/(customer)/my-bookings/cancel-button.tsx` with:
```tsx
'use client'

import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import ConfirmDialog from '@/components/confirm-dialog'
import { cancelMyBookingAction } from '@/app/book/[slotId]/actions'

export default function CancelMyBookingButton({
  bookingId,
  willRefund,
}: {
  bookingId: string
  willRefund: boolean
}) {
  const { execute, isPending } = useAction(cancelMyBookingAction, {
    onSuccess: () => toast.success(willRefund ? '已取消預約，已退還堂數' : '已取消預約（未退還堂數）'),
    onError: ({ error }) => toast.error(error.serverError?.message ?? '取消失敗'),
  })

  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline" size="sm" disabled={isPending}>
          {isPending ? '取消中...' : '取消預約'}
        </Button>
      }
      title="確定要取消此預約嗎？"
      description={
        willRefund
          ? '取消後該時段會釋出，其他學員可重新預約，並退還此堂課數。'
          : '⚠️ 已超過免費取消期限，取消將不退還此堂課數，仍要取消嗎？'
      }
      confirmLabel="取消預約"
      variant="destructive"
      onConfirm={() => execute({ bookingId })}
    />
  )
}
```

- [ ] **Step 3: Wire deadline + no_show into `my-bookings-content.tsx`**

(a) Add import:
```tsx
import { isWithinCancelDeadline } from '@/lib/cancel-deadline'
```
(b) Extend `BookingRow.services` to include the deadline:
```ts
  services: { name: string; duration_minutes: number; cancel_deadline_hours: number } | null
```
(c) Update the bookings `select` string (first query) — change `services(name, duration_minutes)` to `services(name, duration_minutes, cancel_deadline_hours)`.
(d) In `BookingCard`, where `<CancelMyBookingButton bookingId={b.id} />` is rendered, compute and pass `willRefund`. Replace BOTH occurrences of `<CancelMyBookingButton bookingId={b.id} />` with:
```tsx
<CancelMyBookingButton
  bookingId={b.id}
  willRefund={
    !!slot &&
    !!service &&
    isWithinCancelDeadline(new Date(), slot.start_at, service.cancel_deadline_hours)
  }
/>
```
(`slot` and `service` are already destructured at the top of `BookingCard`.)
(e) The completed/cancelled status label block (the final `else` branch): add a `no_show` case. Find the block that renders `b.status === 'completed' ? ... : b.status === 'cancelled' ? ... : ''` and add no_show handling so it reads:
```tsx
{b.status === 'completed'
  ? b.checked_in_at
    ? `已簽到 · ${format(toLocal(b.checked_in_at), 'HH:mm')} 完課`
    : '已完成 · 期待下次見面'
  : b.status === 'cancelled'
    ? '已取消 · 不會佔用套裝堂數'
    : b.status === 'no_show'
      ? '未到場 · 未退還此堂'
      : ''}
```
(`asStatus` already falls back safely; since `StatusType` now includes `no_show`, also add `'no_show'` to the local `STATUS_TYPES` array in this file so `asStatus('no_show')` returns `'no_show'` rather than defaulting to `'pending'`.)

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm run lint && npm test`
Expected: clean + all unit tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/badge.tsx "src/app/(customer)/my-bookings/my-bookings-content.tsx" "src/app/(customer)/my-bookings/cancel-button.tsx"
git commit -m "feat(booking): no_show badge + deadline-aware cancel warning in my-bookings"
```

---

## Task 6: Docs + advisors + verify + spec close-out

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-06-13-cancel-deadline-noshow-design.md`

- [ ] **Step 1: README**

In the booking/notifications section, document: refund only within `cancel_deadline_hours` (staff/admin cancels always refund); `no_show` status set by the checkin-reminder cron sweep for past un-checked-in bookings (label only, class forfeited); deduction stays at booking time.

- [ ] **Step 2: Mark spec done**

In `docs/superpowers/specs/2026-06-13-cancel-deadline-noshow-design.md`, change `狀態：待 review` → `狀態：已實作（2026-06-13）`.

- [ ] **Step 3: Final verification**

Run and confirm: `npm run typecheck` (clean), `npm run lint` (clean), `npm test` (all pass), `npm run test:integration -- cancel-booking-deadline` (3 pass).

- [ ] **Step 4: Commit**

```bash
git add README.md docs/superpowers/specs/2026-06-13-cancel-deadline-noshow-design.md
git commit -m "docs(booking): document cancel-deadline refund + no_show"
```

---

## Self-Review notes (for the executor)

- **Spec coverage:** no_show status (T1), shared deadline helper (T2), deadline-aware refund incl. staff-always-refund + block no_show re-cancel (T3), no_show sweep label-only (T4), badge + cancel warning + display (T5), docs (T6). The spec's "回傳 refunded" was intentionally NOT done — the customer UI computes refund-eligibility client-side via `isWithinCancelDeadline` (same inputs), avoiding a `cancel_booking` signature change and its caller churn; the RPC still performs the correct conditional refund server-side (source of truth).
- **Type consistency:** `isWithinCancelDeadline(now, startAt, deadlineHours)` defined T2, used T5. `StatusType` gains `no_show` T5 (and the local `STATUS_TYPES`/`asStatus` in my-bookings-content must include it). `willRefund` prop added to `CancelMyBookingButton` T5 (both call-sites updated).
- **No-show never refunds:** T4 sweep updates status only — no `classes_used` write. Verified against spec's label-only requirement.
- **LINE message:** update the tenant announcement's 堂數/取消/未到場 wording to match (deduct at booking; refund only if cancelled within deadline; no-show forfeits + shows 未到場). Not a code task — hand the revised copy to the user after T6.
