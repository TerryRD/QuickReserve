# Student Check-In Mechanism Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let students self check-in to a confirmed booking (check-in = completed), notify the coach on check-in, and remind student/coach/owner around class start if not checked in — all driven by Supabase pg_cron (no Vercel Pro needed).

**Architecture:** Two columns on `bookings` + one on `tenants`; a `security definer` RPC `checkin_booking`; a customer-side check-in button + server action; pure helper modules for the time-window and reminder-planning logic (unit-tested); a `/api/cron/checkin-reminder` route that consumes the planner and fans out via the existing `pushToUser`; a pg_cron+pg_net migration that pings that route every minute.

**Tech Stack:** Next.js App Router, next-safe-action, Supabase (Postgres RPC, pg_cron, pg_net, Vault), web-push, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-13-student-checkin-design.md`

**Conventions to follow (verified in repo):**
- RPC: `language plpgsql security definer set search_path = public`; errcodes `42501` (FORBIDDEN), `P0001` (business), `P0002` (not found); `grant execute ... to authenticated`. Pattern: `supabase/migrations/20260529110000_book_with_purchase_optional_purchase_id.sql`.
- Cron route: `GET`, `Bearer ${process.env.CRON_SECRET}` guard, `createSupabaseAdminClient()`, return `NextResponse.json`. Pattern: `src/app/api/cron/auto-cancel-group-class/route.ts`.
- Notify helper: admin client, `pushToUser`, wrapped in try/catch that only logs (never throws). TZ display = UTC+8. Pattern: `src/lib/notify-booking.ts`.
- Server action: `actionClient.inputSchema(zod).action(...)`, `requireSession()` / `requireTenantOwner()`, map RPC error substrings to `AppError`, `revalidatePath`. Pattern: `src/app/book/[slotId]/actions.ts`.
- Migrations are timestamped `YYYYMMDDHHMMSS_name.sql` under `supabase/migrations/`. Apply with the Supabase MCP `apply_migration` tool (remote project). After any column change, regenerate types: `npm run db:types`.

---

## File Structure

**Create:**
- `supabase/migrations/20260613100000_bookings_checkin_columns.sql` — booking check-in columns + tenant reminder setting
- `supabase/migrations/20260613100100_checkin_booking_rpc.sql` — `checkin_booking` RPC
- `supabase/migrations/20260613100200_checkin_reminder_cron.sql` — pg_cron + pg_net schedule
- `src/lib/checkin-window.ts` — pure: is `now` inside the check-in window
- `src/lib/checkin-reminder-plan.ts` — pure: which bookings need `reminder` vs `missing`
- `src/lib/notify-checkin.ts` — push helpers for the 3 check-in notification types
- `src/app/api/cron/checkin-reminder/route.ts` — every-minute reminder dispatcher
- `src/app/(customer)/my-bookings/checkin-button.tsx` — client check-in button
- `tests/unit/checkin-window.test.ts`
- `tests/unit/checkin-reminder-plan.test.ts`
- `tests/integration/checkin-booking.test.ts`

**Modify:**
- `src/app/book/[slotId]/actions.ts` — add `checkinBookingAction`
- `src/app/(customer)/my-bookings/my-bookings-content.tsx` — select `checked_in_at`, `end_at`; render button
- `src/app/(tenant)/settings/notifications/page.tsx` + `actions.ts` + `notification-prefs-form.tsx` — tenant reminder-minutes control
- `README.md` — notifications section
- `docs/superpowers/specs/2026-06-13-student-checkin-design.md` — mark done

---

## Task 1: Migration — bookings check-in columns + tenant reminder setting

**Files:**
- Create: `supabase/migrations/20260613100000_bookings_checkin_columns.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Student check-in (spec 2026-06-13-student-checkin-design):
-- bookings gains check-in tracking; check-in = completed.
-- tenants gains a tenant-wide pre-class reminder lead (null = disabled).

alter table public.bookings
  add column if not exists checked_in_at timestamptz,
  add column if not exists checked_in_by uuid references auth.users(id);

comment on column public.bookings.checked_in_at is 'When the student checked in; null = not checked in';
comment on column public.bookings.checked_in_by is 'auth.users id that performed the check-in (usually the student)';

alter table public.tenants
  add column if not exists checkin_reminder_minutes int default 15
    check (checkin_reminder_minutes is null or checkin_reminder_minutes >= 1);

comment on column public.tenants.checkin_reminder_minutes is 'Minutes before start_at to remind student to check in; null = disabled';

-- Partial index to support the every-minute cron scan for un-checked-in confirmed bookings.
create index if not exists idx_bookings_checkin_scan
  on public.bookings (status, slot_id)
  where checked_in_at is null and status = 'confirmed';
```

- [ ] **Step 2: Apply the migration**

Apply via Supabase MCP `apply_migration` with name `bookings_checkin_columns` and the SQL above.
Expected: success, no error.

- [ ] **Step 3: Verify columns exist**

Run via Supabase MCP `execute_sql`:
```sql
select column_name from information_schema.columns
where table_schema='public' and table_name='bookings' and column_name in ('checked_in_at','checked_in_by')
union all
select column_name from information_schema.columns
where table_schema='public' and table_name='tenants' and column_name='checkin_reminder_minutes';
```
Expected: 3 rows (`checked_in_at`, `checked_in_by`, `checkin_reminder_minutes`).

- [ ] **Step 4: Regenerate TypeScript types**

Run: `npm run db:types`
Expected: `src/lib/supabase/types.ts` updated; `git diff` shows the new columns on `bookings` and `tenants`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260613100000_bookings_checkin_columns.sql src/lib/supabase/types.ts
git commit -m "feat(checkin): add booking check-in columns + tenant reminder setting"
```

---

## Task 2: Pure module — check-in time window

**Files:**
- Create: `src/lib/checkin-window.ts`
- Test: `tests/unit/checkin-window.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { CHECKIN_OPEN_BEFORE_MIN, canCheckIn } from '@/lib/checkin-window'

const start = '2026-06-13T10:00:00.000Z'
const end = '2026-06-13T11:00:00.000Z'

describe('canCheckIn', () => {
  it('blocks before the open window (>30 min before start)', () => {
    expect(canCheckIn(new Date('2026-06-13T09:29:00.000Z'), start, end)).toBe(false)
  })
  it('allows exactly at the open boundary (start - 30 min)', () => {
    expect(canCheckIn(new Date('2026-06-13T09:30:00.000Z'), start, end)).toBe(true)
  })
  it('allows during class', () => {
    expect(canCheckIn(new Date('2026-06-13T10:30:00.000Z'), start, end)).toBe(true)
  })
  it('allows at end_at', () => {
    expect(canCheckIn(new Date('2026-06-13T11:00:00.000Z'), start, end)).toBe(true)
  })
  it('blocks after end_at', () => {
    expect(canCheckIn(new Date('2026-06-13T11:00:01.000Z'), start, end)).toBe(false)
  })
  it('exposes the 30-minute constant', () => {
    expect(CHECKIN_OPEN_BEFORE_MIN).toBe(30)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/checkin-window.test.ts`
Expected: FAIL — cannot resolve `@/lib/checkin-window`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/checkin-window.ts
export const CHECKIN_OPEN_BEFORE_MIN = 30

/** True when `now` is within [start - 30min, end] — the student-self-checkin window. */
export function canCheckIn(now: Date, startAt: string, endAt: string): boolean {
  const start = new Date(startAt).getTime()
  const end = new Date(endAt).getTime()
  const openFrom = start - CHECKIN_OPEN_BEFORE_MIN * 60_000
  const t = now.getTime()
  return t >= openFrom && t <= end
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/checkin-window.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/checkin-window.ts tests/unit/checkin-window.test.ts
git commit -m "feat(checkin): pure check-in time-window helper"
```

---

## Task 3: Pure module — reminder planner

**Files:**
- Create: `src/lib/checkin-reminder-plan.ts`
- Test: `tests/unit/checkin-reminder-plan.test.ts`

**Rule:** For each `confirmed`, not-checked-in booking — if `now >= start_at` → `missing`; else if tenant lead set and `now >= start_at - lead` → `reminder`. Bookings that are checked in, not confirmed, or whose start is too far away produce nothing. `missing` is bounded: skip if start_at is more than `MISSING_MAX_AGE_MIN` (120) in the past (stale; cron downtime).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { planCheckinReminders, type ReminderBooking } from '@/lib/checkin-reminder-plan'

const now = new Date('2026-06-13T10:00:00.000Z')
function bk(over: Partial<ReminderBooking>): ReminderBooking {
  return {
    bookingId: 'b1', slotId: 's1', startAt: '2026-06-13T10:10:00.000Z',
    checkedInAt: null, status: 'confirmed', reminderLeadMin: 15, ...over,
  }
}

describe('planCheckinReminders', () => {
  it('emits reminder inside the lead window before start', () => {
    // start 10:10, lead 15 -> window opens 09:55; now 10:00 is inside
    expect(planCheckinReminders(now, [bk({})])).toEqual([{ kind: 'reminder', bookingId: 'b1' }])
  })
  it('no reminder before the lead window opens', () => {
    expect(planCheckinReminders(now, [bk({ startAt: '2026-06-13T10:30:00.000Z' })])).toEqual([])
  })
  it('no reminder when tenant lead is disabled (null)', () => {
    expect(planCheckinReminders(now, [bk({ reminderLeadMin: null })])).toEqual([])
  })
  it('emits missing when start has passed and not checked in', () => {
    expect(planCheckinReminders(now, [bk({ startAt: '2026-06-13T09:59:00.000Z' })])).toEqual([
      { kind: 'missing', bookingId: 'b1' },
    ])
  })
  it('skips checked-in bookings', () => {
    expect(planCheckinReminders(now, [bk({ startAt: '2026-06-13T09:59:00.000Z', checkedInAt: '2026-06-13T09:58:00.000Z' })])).toEqual([])
  })
  it('skips non-confirmed bookings', () => {
    expect(planCheckinReminders(now, [bk({ status: 'pending', startAt: '2026-06-13T09:59:00.000Z' })])).toEqual([])
  })
  it('skips stale missing (> 120 min past start)', () => {
    expect(planCheckinReminders(now, [bk({ startAt: '2026-06-13T07:30:00.000Z' })])).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/checkin-reminder-plan.test.ts`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/checkin-reminder-plan.ts
export const MISSING_MAX_AGE_MIN = 120

export type ReminderBooking = {
  bookingId: string
  slotId: string
  startAt: string
  checkedInAt: string | null
  status: string
  reminderLeadMin: number | null // tenant checkin_reminder_minutes; null = disabled
}

export type ReminderAction =
  | { kind: 'reminder'; bookingId: string }
  | { kind: 'missing'; bookingId: string }

/** Decide which un-checked-in confirmed bookings need a pre-class reminder or a not-checked-in escalation. */
export function planCheckinReminders(now: Date, bookings: ReminderBooking[]): ReminderAction[] {
  const out: ReminderAction[] = []
  const t = now.getTime()
  for (const b of bookings) {
    if (b.status !== 'confirmed' || b.checkedInAt) continue
    const start = new Date(b.startAt).getTime()
    if (t >= start) {
      if (t - start <= MISSING_MAX_AGE_MIN * 60_000) out.push({ kind: 'missing', bookingId: b.bookingId })
      continue
    }
    if (b.reminderLeadMin != null) {
      const remindFrom = start - b.reminderLeadMin * 60_000
      if (t >= remindFrom) out.push({ kind: 'reminder', bookingId: b.bookingId })
    }
  }
  return out
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/checkin-reminder-plan.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/checkin-reminder-plan.ts tests/unit/checkin-reminder-plan.test.ts
git commit -m "feat(checkin): pure reminder planner"
```

---

## Task 4: RPC `checkin_booking` + integration test

**Files:**
- Create: `supabase/migrations/20260613100100_checkin_booking_rpc.sql`
- Test: `tests/integration/checkin-booking.test.ts`

- [ ] **Step 1: Write the migration**

```sql
-- checkin_booking (spec 2026-06-13): student self check-in.
-- Confirmed + within [start-30min, end] + owned by caller -> completed.

create or replace function public.checkin_booking(p_booking_id uuid)
returns table (booking_id uuid, checked_in_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking record;
  v_slot record;
  v_open_from timestamptz;
begin
  select b.id, b.customer_id, b.status, b.checked_in_at, b.slot_id
    into v_booking
    from public.bookings b
    where b.id = p_booking_id
    for update;
  if not found then
    raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- Ownership: authenticated callers may only check in their own booking.
  if auth.role() <> 'service_role' then
    if auth.uid() is null or v_booking.customer_id <> auth.uid() then
      raise exception 'FORBIDDEN' using errcode = '42501';
    end if;
  end if;

  if v_booking.checked_in_at is not null then
    raise exception 'ALREADY_CHECKED_IN' using errcode = 'P0001';
  end if;
  if v_booking.status <> 'confirmed' then
    raise exception 'NOT_CONFIRMED' using errcode = 'P0001';
  end if;

  select s.start_at, s.end_at into v_slot
    from public.availability_slots s
    where s.id = v_booking.slot_id;

  v_open_from := v_slot.start_at - interval '30 minutes';
  if now() < v_open_from then
    raise exception 'CHECKIN_TOO_EARLY' using errcode = 'P0001';
  end if;
  if now() > v_slot.end_at then
    raise exception 'CHECKIN_CLOSED' using errcode = 'P0001';
  end if;

  update public.bookings
    set checked_in_at = now(),
        checked_in_by = coalesce(auth.uid(), v_booking.customer_id),
        status = 'completed',
        updated_at = now()
    where id = p_booking_id
    returning id, bookings.checked_in_at into booking_id, checked_in_at;
  return next;
end;
$$;

grant execute on function public.checkin_booking(uuid) to authenticated;
```

- [ ] **Step 2: Write the failing integration test**

```ts
// @vitest-environment node
import WebSocket from 'ws'
if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket
}
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)
const ts = Date.now()
const ctx: { tenantId?: string; memberId?: string; serviceId?: string; customerId?: string } = {}

async function makeSlot(startOffsetMin: number, durationMin: number) {
  const start = new Date(Date.now() + startOffsetMin * 60_000)
  const end = new Date(start.getTime() + durationMin * 60_000)
  const { data } = await admin
    .from('availability_slots')
    .insert({
      tenant_id: ctx.tenantId!, member_id: ctx.memberId!, service_id: ctx.serviceId!,
      start_at: start.toISOString(), end_at: end.toISOString(), status: 'booked',
    })
    .select().single()
  return data!.id as string
}
async function makeBooking(slotId: string, status: string) {
  const { data: p } = await admin.from('customer_purchases').insert({
    tenant_id: ctx.tenantId!, customer_id: ctx.customerId!, service_id: ctx.serviceId!,
    classes_total: 5, classes_used: 1, approval_status: 'confirmed',
    approved_at: new Date().toISOString(), payment_self_reported: 'claimed_paid',
  }).select().single()
  const { data } = await admin.from('bookings').insert({
    tenant_id: ctx.tenantId!, slot_id: slotId, customer_id: ctx.customerId!,
    service_id: ctx.serviceId!, status, purchase_id: p!.id,
  }).select().single()
  return data!.id as string
}

describe('checkin_booking RPC', () => {
  beforeAll(async () => {
    const { data: u } = await admin.auth.admin.createUser({
      email: `coach-ci-${ts}@example.com`, password: 'TestPass123!', email_confirm: true,
    })
    const coachId = u!.user!.id
    const { data: t } = await admin.from('tenants').insert({ slug: `ci-${ts}`, name: 'CI Tenant' }).select().single()
    ctx.tenantId = t!.id
    const { data: m } = await admin.from('tenant_members').insert({
      tenant_id: ctx.tenantId, user_id: coachId, role: 'owner', status: 'active',
    }).select().single()
    ctx.memberId = m!.id
    const { data: s } = await admin.from('services').insert({
      tenant_id: ctx.tenantId, name: 'CI Service', duration_minutes: 60,
    }).select().single()
    ctx.serviceId = s!.id
    const { data: cu } = await admin.auth.admin.createUser({
      email: `cust-ci-${ts}@example.com`, password: 'TestPass123!', email_confirm: true,
    })
    ctx.customerId = cu!.user!.id
    await admin.from('customers').insert({ id: ctx.customerId, display_name: 'CI Cust' })
  })
  afterAll(async () => {
    if (ctx.tenantId) await admin.from('tenants').delete().eq('id', ctx.tenantId)
  })

  it('checks in a confirmed booking inside the window -> completed', async () => {
    const slot = await makeSlot(-5, 60) // started 5 min ago, ongoing
    const booking = await makeBooking(slot, 'confirmed')
    const { data, error } = await admin.rpc('checkin_booking', { p_booking_id: booking })
    expect(error).toBeNull()
    expect((data as Array<{ booking_id: string }>)[0].booking_id).toBe(booking)
    const { data: b } = await admin.from('bookings').select('status, checked_in_at').eq('id', booking).single()
    expect(b!.status).toBe('completed')
    expect(b!.checked_in_at).not.toBeNull()
  })

  it('rejects a second check-in (ALREADY_CHECKED_IN)', async () => {
    const slot = await makeSlot(-5, 60)
    const booking = await makeBooking(slot, 'confirmed')
    await admin.rpc('checkin_booking', { p_booking_id: booking })
    const { error } = await admin.rpc('checkin_booking', { p_booking_id: booking })
    expect(error?.message).toContain('ALREADY_CHECKED_IN')
  })

  it('rejects a pending booking (NOT_CONFIRMED)', async () => {
    const slot = await makeSlot(-5, 60)
    const booking = await makeBooking(slot, 'pending')
    const { error } = await admin.rpc('checkin_booking', { p_booking_id: booking })
    expect(error?.message).toContain('NOT_CONFIRMED')
  })

  it('rejects too early (CHECKIN_TOO_EARLY)', async () => {
    const slot = await makeSlot(60, 60) // starts in 60 min, window opens at 30 min
    const booking = await makeBooking(slot, 'confirmed')
    const { error } = await admin.rpc('checkin_booking', { p_booking_id: booking })
    expect(error?.message).toContain('CHECKIN_TOO_EARLY')
  })

  it('rejects after class ended (CHECKIN_CLOSED)', async () => {
    const slot = await makeSlot(-120, 60) // ended 60 min ago
    const booking = await makeBooking(slot, 'confirmed')
    const { error } = await admin.rpc('checkin_booking', { p_booking_id: booking })
    expect(error?.message).toContain('CHECKIN_CLOSED')
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm run test:integration -- checkin-booking`
Expected: FAIL — `checkin_booking` function does not exist.

- [ ] **Step 4: Apply the migration**

Apply via Supabase MCP `apply_migration` with name `checkin_booking_rpc` and the SQL from Step 1.
Expected: success.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test:integration -- checkin-booking`
Expected: PASS (5 tests).

- [ ] **Step 6: Run Supabase advisors**

Use Supabase MCP `get_advisors` (type `security`) and (type `performance`). Report any new findings about `checkin_booking` / the new index. Expected: no new security errors (search_path is set, function is security definer with ownership guard).

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260613100100_checkin_booking_rpc.sql tests/integration/checkin-booking.test.ts
git commit -m "feat(checkin): checkin_booking RPC + integration tests"
```

---

## Task 5: Notification helpers for check-in events

**Files:**
- Create: `src/lib/notify-checkin.ts`

These mirror `src/lib/notify-booking.ts` exactly (admin client, `pushToUser`, swallow errors, UTC+8 label). No new unit test — the testable decision logic lives in Task 3; these are thin fan-out wrappers like the existing `notify-booking.ts` (which has no unit tests).

- [ ] **Step 1: Write the helpers**

```ts
// src/lib/notify-checkin.ts
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { pushToUser } from '@/lib/push'

const tzLabel = (iso: string) =>
  new Date(new Date(iso).getTime() + 8 * 3600 * 1000).toLocaleString('zh-TW')

/** Flow 1: student checked in -> notify the slot's coach. Called from the check-in action. */
export async function notifyCheckinDone(bookingId: string): Promise<void> {
  try {
    const admin = createSupabaseAdminClient()
    const { data: b } = await admin
      .from('bookings')
      .select('id, customers(display_name), services(name), availability_slots(start_at, tenant_members(user_id))')
      .eq('id', bookingId)
      .maybeSingle()
    if (!b) return
    const customer = b.customers as { display_name: string | null } | null
    const service = b.services as { name: string } | null
    const slot = b.availability_slots as { start_at: string; tenant_members: { user_id: string | null } | null } | null
    const coachUserId = slot?.tenant_members?.user_id ?? null
    if (!coachUserId) return
    await pushToUser(admin, {
      userId: coachUserId,
      type: 'checkin_done',
      payload: {
        title: '學員已簽到',
        body: `${customer?.display_name ?? '學員'} 已簽到（${service?.name ?? '課程'} ${slot ? tzLabel(slot.start_at) : ''}）`,
        url: '/calendar',
        tag: `checkin-${bookingId}`,
      },
      relatedId: bookingId,
    })
  } catch (err) {
    console.error('[notify-checkin-done]', err)
  }
}

/** Flow 2: pre-class reminder to the student. scheduledFor = slot start_at for once-per-booking dedup. */
export async function notifyCheckinReminder(
  studentUserId: string,
  serviceName: string,
  slotStartAt: string,
  relatedId: string,
): Promise<void> {
  try {
    const admin = createSupabaseAdminClient()
    await pushToUser(admin, {
      userId: studentUserId,
      type: 'checkin_reminder',
      payload: {
        title: '記得簽到',
        body: `${serviceName}（${tzLabel(slotStartAt)} 開始）記得到場後簽到`,
        url: '/my-bookings',
        tag: `checkin-reminder-${relatedId}`,
      },
      relatedId,
      scheduledFor: slotStartAt,
    })
  } catch (err) {
    console.error('[notify-checkin-reminder]', err)
  }
}

/** Flow 3a: not-checked-in escalation to the student. */
export async function notifyCheckinMissingStudent(
  studentUserId: string,
  serviceName: string,
  slotStartAt: string,
  bookingId: string,
): Promise<void> {
  try {
    const admin = createSupabaseAdminClient()
    await pushToUser(admin, {
      userId: studentUserId,
      type: 'checkin_missing',
      payload: {
        title: '您尚未簽到',
        body: `${serviceName}（${tzLabel(slotStartAt)}）已開始，請儘快簽到`,
        url: '/my-bookings',
        tag: `checkin-missing-${bookingId}`,
      },
      relatedId: bookingId,
      scheduledFor: slotStartAt,
    })
  } catch (err) {
    console.error('[notify-checkin-missing-student]', err)
  }
}

/** Flow 3b: not-checked-in escalation to one coach/owner, batched per slot. names = un-checked-in student names. */
export async function notifyCheckinMissingCoach(
  coachUserId: string,
  serviceName: string,
  slotStartAt: string,
  slotId: string,
  names: string[],
): Promise<void> {
  if (names.length === 0) return
  try {
    const admin = createSupabaseAdminClient()
    await pushToUser(admin, {
      userId: coachUserId,
      type: 'checkin_missing',
      payload: {
        title: `${names.length} 位學員尚未簽到`,
        body: `${serviceName}（${tzLabel(slotStartAt)}）：${names.join('、')}`,
        url: '/calendar',
        tag: `checkin-missing-slot-${slotId}`,
      },
      relatedId: slotId,
      scheduledFor: slotStartAt,
    })
  } catch (err) {
    console.error('[notify-checkin-missing-coach]', err)
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors (confirms the select shapes match regenerated `Database` types).

- [ ] **Step 3: Commit**

```bash
git add src/lib/notify-checkin.ts
git commit -m "feat(checkin): push notification helpers for check-in events"
```

---

## Task 6: Cron route `/api/cron/checkin-reminder`

**Files:**
- Create: `src/app/api/cron/checkin-reminder/route.ts`

Consumes the Task 3 planner. Query window: confirmed, not-checked-in bookings whose slot `start_at` is between `now - 2h` and `now + 3h` (covers the longest sane reminder lead and the missing grace). Groups `missing` coach notifications per slot. Sends `reminder` + `missing-student` per booking.

- [ ] **Step 1: Write the route**

```ts
// src/app/api/cron/checkin-reminder/route.ts
import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { planCheckinReminders, type ReminderBooking } from '@/lib/checkin-reminder-plan'
import {
  notifyCheckinReminder,
  notifyCheckinMissingStudent,
  notifyCheckinMissingCoach,
} from '@/lib/notify-checkin'

type Row = {
  id: string
  slot_id: string
  customer_id: string
  status: string
  checked_in_at: string | null
  customers: { display_name: string | null } | null
  services: { name: string } | null
  tenants: { checkin_reminder_minutes: number | null } | null
  availability_slots: { start_at: string; tenant_members: { user_id: string | null } | null } | null
}

export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }
  const admin = createSupabaseAdminClient()
  const now = new Date()
  const from = new Date(now.getTime() - 2 * 3600 * 1000).toISOString()
  const to = new Date(now.getTime() + 3 * 3600 * 1000).toISOString()

  const { data, error } = await admin
    .from('bookings')
    .select(
      'id, slot_id, customer_id, status, checked_in_at, customers(display_name), services(name), tenants(checkin_reminder_minutes), availability_slots!inner(start_at, tenant_members(user_id))',
    )
    .eq('status', 'confirmed')
    .is('checked_in_at', null)
    .gte('availability_slots.start_at', from)
    .lte('availability_slots.start_at', to)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (data ?? []) as unknown as Row[]
  const byId = new Map(rows.map((r) => [r.id, r]))

  const planned = planCheckinReminders(
    now,
    rows.map<ReminderBooking>((r) => ({
      bookingId: r.id,
      slotId: r.slot_id,
      startAt: r.availability_slots!.start_at,
      checkedInAt: r.checked_in_at,
      status: r.status,
      reminderLeadMin: r.tenants?.checkin_reminder_minutes ?? null,
    })),
  )

  let reminders = 0
  const missingBySlot = new Map<string, Row[]>()

  for (const action of planned) {
    const r = byId.get(action.bookingId)
    if (!r || !r.availability_slots) continue
    const svcName = r.services?.name ?? '課程'
    const startAt = r.availability_slots.start_at
    if (action.kind === 'reminder') {
      void notifyCheckinReminder(r.customer_id, svcName, startAt, r.id)
      reminders++
    } else {
      // student gets an individual nudge; coach notification is batched per slot below
      void notifyCheckinMissingStudent(r.customer_id, svcName, startAt, r.id)
      const arr = missingBySlot.get(r.slot_id) ?? []
      arr.push(r)
      missingBySlot.set(r.slot_id, arr)
    }
  }

  let coachAlerts = 0
  for (const [slotId, slotRows] of missingBySlot) {
    const first = slotRows[0]
    const coachUserId = first.availability_slots?.tenant_members?.user_id ?? null
    if (!coachUserId) continue
    const names = slotRows.map((r) => r.customers?.display_name ?? '學員')
    void notifyCheckinMissingCoach(
      coachUserId,
      first.services?.name ?? '課程',
      first.availability_slots!.start_at,
      slotId,
      names,
    )
    coachAlerts++
  }

  return NextResponse.json({
    scanned: rows.length,
    reminders,
    missingStudents: planned.filter((p) => p.kind === 'missing').length,
    coachAlerts,
    timestamp: now.toISOString(),
  })
}
```

> **Note on owner notification:** v1 sends the per-slot "missing" alert to the slot's coach (`slot.member_id`). If the coach is a staff member and the spec's "也通知老闆" is desired, a follow-up can resolve the tenant `owner` and call `notifyCheckinMissingCoach` for them too — deferred to keep v1 query simple; logged here so it is not silently dropped.

- [ ] **Step 2: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: no errors.

- [ ] **Step 3: Manual smoke (local dev server)**

Run dev server, then:
```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/checkin-reminder
```
Expected: JSON `{ scanned, reminders, missingStudents, coachAlerts, timestamp }` (zeros are fine with no due bookings). Without the header → `401 Unauthorized`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/cron/checkin-reminder/route.ts
git commit -m "feat(checkin): every-minute reminder cron route"
```

---

## Task 7: Check-in server action + customer UI

**Files:**
- Modify: `src/app/book/[slotId]/actions.ts`
- Create: `src/app/(customer)/my-bookings/checkin-button.tsx`
- Modify: `src/app/(customer)/my-bookings/my-bookings-content.tsx`

- [ ] **Step 1: Add the server action**

Append to `src/app/book/[slotId]/actions.ts` (it already imports `z`, `actionClient`, `requireSession`, `createSupabaseServerClient`, `AppError`, `revalidatePath`). Add this import near the top:
```ts
import { notifyCheckinDone } from '@/lib/notify-checkin'
```
Append at the end of the file:
```ts
const CheckinBookingSchema = z.object({ bookingId: z.string().uuid() })

export const checkinBookingAction = actionClient
  .inputSchema(CheckinBookingSchema)
  .action(async ({ parsedInput }) => {
    await requireSession()
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase.rpc('checkin_booking', { p_booking_id: parsedInput.bookingId })
    if (error) {
      if (error.message?.includes('BOOKING_NOT_FOUND')) throw new AppError('BOOKING_NOT_FOUND', '預約不存在')
      if (error.message?.includes('FORBIDDEN')) throw new AppError('FORBIDDEN', '無權限')
      if (error.message?.includes('ALREADY_CHECKED_IN')) throw new AppError('ALREADY_CHECKED_IN', '已簽到過了')
      if (error.message?.includes('NOT_CONFIRMED')) throw new AppError('NOT_CONFIRMED', '此預約尚未確認，無法簽到')
      if (error.message?.includes('CHECKIN_TOO_EARLY')) throw new AppError('CHECKIN_TOO_EARLY', '尚未開放簽到（開課前 30 分鐘起）')
      if (error.message?.includes('CHECKIN_CLOSED')) throw new AppError('CHECKIN_CLOSED', '課程已結束，無法簽到')
      throw new AppError('CHECKIN_FAILED', error.message)
    }
    void notifyCheckinDone(parsedInput.bookingId)
    revalidatePath('/my-bookings')
    return { ok: true }
  })
```

- [ ] **Step 2: Create the client button**

```tsx
// src/app/(customer)/my-bookings/checkin-button.tsx
'use client'

import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { checkinBookingAction } from '@/app/book/[slotId]/actions'

export default function CheckinButton({ bookingId }: { bookingId: string }) {
  const { execute, isPending } = useAction(checkinBookingAction, {
    onSuccess: () => toast.success('簽到成功'),
    onError: ({ error }) => toast.error(error.serverError?.message ?? '簽到失敗'),
  })
  return (
    <Button size="sm" disabled={isPending} onClick={() => execute({ bookingId })}>
      {isPending ? '簽到中...' : '簽到'}
    </Button>
  )
}
```

- [ ] **Step 3: Wire into the bookings list**

In `src/app/(customer)/my-bookings/my-bookings-content.tsx`:

(a) Add the import at the top with the other local imports:
```tsx
import CheckinButton from './checkin-button'
import { canCheckIn } from '@/lib/checkin-window'
```

(b) Extend `BookingRow` — add `checked_in_at` and `end_at`:
```ts
type BookingRow = {
  id: string
  status: string
  customer_notes: string | null
  created_at: string
  service_id: string
  checked_in_at: string | null
  tenants: { name: string; slug: string } | null
  services: { name: string; duration_minutes: number } | null
  availability_slots: { start_at: string; end_at: string } | null
}
```

(c) Update the bookings `select` string (the first query in `Promise.all`) to include the new fields:
```ts
'id, status, customer_notes, created_at, service_id, checked_in_at, tenants(name, slug), services(name, duration_minutes), availability_slots(start_at, end_at)',
```

(d) Inside `BookingCard`, compute check-in availability right after the existing `canCancel` block:
```ts
const slotForCheckin = b.availability_slots
const canDoCheckin =
  b.status === 'confirmed' &&
  !b.checked_in_at &&
  !!slotForCheckin &&
  canCheckIn(new Date(), slotForCheckin.start_at, slotForCheckin.end_at)
```

(e) Render the button. In the `canCancel ?` action row, add the check-in button as the first child inside the `<div className="mt-2 flex flex-wrap items-center gap-2">`:
```tsx
{canDoCheckin && <CheckinButton bookingId={b.id} />}
```
Also handle the not-cancellable-but-checkinable case: replace the `) : (` else branch's opening so a check-in button still shows for confirmed-but-not-cancellable bookings. Change the final block to:
```tsx
) : canDoCheckin ? (
  <div className="mt-2 flex flex-wrap items-center gap-2">
    <CheckinButton bookingId={b.id} />
  </div>
) : (
  <div className="font-mono mt-2 text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">
    {b.status === 'completed'
      ? b.checked_in_at
        ? `已簽到 · ${format(toLocal(b.checked_in_at), 'HH:mm')} 完課`
        : '已完成 · 期待下次見面'
      : b.status === 'cancelled'
        ? '已取消 · 不會佔用套裝堂數'
        : ''}
  </div>
)}
```

- [ ] **Step 4: Typecheck + lint + build**

Run: `npm run typecheck && npm run lint`
Expected: no errors.

- [ ] **Step 5: Run the full unit suite (no regressions)**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/app/book/[slotId]/actions.ts src/app/\(customer\)/my-bookings/checkin-button.tsx src/app/\(customer\)/my-bookings/my-bookings-content.tsx
git commit -m "feat(checkin): student check-in action + my-bookings button"
```

---

## Task 8: Tenant setting — pre-class reminder minutes

**Files:**
- Modify: `src/app/(tenant)/settings/notifications/actions.ts`
- Modify: `src/app/(tenant)/settings/notifications/page.tsx`
- Modify: `src/app/(tenant)/settings/notifications/notification-prefs-form.tsx`

> Read these three files first to match their existing form/action shape (they were not fully quoted in this plan). The action below follows the `requireTenantOwner` + `tenants` update pattern from `src/app/(tenant)/settings/profile/actions.ts`.

- [ ] **Step 1: Add the update action**

Append to `src/app/(tenant)/settings/notifications/actions.ts` (add imports `requireTenantOwner` from `@/lib/auth/get-session`, `z`, `actionClient`, `createSupabaseServerClient`, `AppError`, `revalidatePath` if not already present):
```ts
const UpdateCheckinReminderSchema = z.object({
  // null = disabled; otherwise minutes-before-start (>= 1)
  minutes: z.number().int().min(1).max(180).nullable(),
})

export const updateCheckinReminderAction = actionClient
  .inputSchema(UpdateCheckinReminderSchema)
  .action(async ({ parsedInput }) => {
    const session = await requireTenantOwner()
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase
      .from('tenants')
      .update({ checkin_reminder_minutes: parsedInput.minutes })
      .eq('id', session.tenantId)
    if (error) throw new AppError('CHECKIN_REMINDER_UPDATE_FAILED', error.message)
    revalidatePath('/settings/notifications')
    return { ok: true }
  })
```

- [ ] **Step 2: Load the current value in the page**

In `src/app/(tenant)/settings/notifications/page.tsx`, query the tenant's current value and pass it to the form. Add to the page's data load (it already resolves the session/tenant):
```ts
const { data: tenantRow } = await supabase
  .from('tenants')
  .select('checkin_reminder_minutes')
  .eq('id', session.tenantId)
  .maybeSingle()
```
Pass `checkinReminderMinutes={tenantRow?.checkin_reminder_minutes ?? null}` into `<NotificationPrefsForm ... />`.

- [ ] **Step 3: Add the control to the form**

In `notification-prefs-form.tsx`, accept the new prop and render a labelled number input + an "不提醒" toggle. Follow the file's existing control styling. Minimal control:
```tsx
// props: add `checkinReminderMinutes: number | null`
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { updateCheckinReminderAction } from './actions'

// inside component:
const { execute: saveCheckin, isPending: savingCheckin } = useAction(updateCheckinReminderAction, {
  onSuccess: () => toast.success('已更新簽到提醒設定'),
  onError: ({ error }) => toast.error(error.serverError?.message ?? '更新失敗'),
})
```
Render a section: a checkbox "課前提醒學員簽到" bound to `checkinReminderMinutes !== null`; when on, a number input (min 1, max 180, default 15) that calls `saveCheckin({ minutes })` on change/blur; when unchecked, call `saveCheckin({ minutes: null })`. Label hint: "預設 15 分鐘；關閉則不提醒。"

- [ ] **Step 4: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(tenant\)/settings/notifications/
git commit -m "feat(checkin): tenant pre-class reminder-minutes setting"
```

---

## Task 9: pg_cron + pg_net schedule migration

**Files:**
- Create: `supabase/migrations/20260613100200_checkin_reminder_cron.sql`

> This wires Postgres to ping the cron route every minute. Requires two Vault secrets: `app_base_url` (the deployed origin, e.g. `https://quickreserve.example.com`) and `cron_secret` (must equal the `CRON_SECRET` env var the route checks).

- [ ] **Step 1: Store the Vault secrets** (one-time, via Supabase MCP `execute_sql`)

```sql
select vault.create_secret('https://YOUR-DEPLOYED-ORIGIN', 'app_base_url');
select vault.create_secret('YOUR-CRON-SECRET-MATCHING-ENV', 'cron_secret');
```
Expected: two uuids returned. (Replace placeholders with real values; do not commit the secrets.)

- [ ] **Step 2: Write the migration**

```sql
-- Schedule the check-in reminder cron (spec 2026-06-13).
-- pg_cron pings the Next.js route every minute; the route does the push fan-out.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'checkin-reminder',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'app_base_url')
           || '/api/cron/checkin-reminder',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    timeout_milliseconds := 5000
  );
  $$
);
```

> The route uses `GET` with a `Bearer` header; `net.http_post` sends the header correctly and the route reads `authorization` regardless of method. If a strict GET is required, switch the route handler to also export `POST` delegating to `GET`. Keep `GET` for the manual curl smoke test.

- [ ] **Step 3: Apply the migration**

Apply via Supabase MCP `apply_migration` with name `checkin_reminder_cron` and the SQL above.
Expected: success.

- [ ] **Step 4: Verify the job is scheduled**

Run via Supabase MCP `execute_sql`:
```sql
select jobname, schedule, active from cron.job where jobname = 'checkin-reminder';
```
Expected: one row, `schedule = '* * * * *'`, `active = true`.

- [ ] **Step 5: Verify a run fired (after ~1-2 min)**

```sql
select status, return_message, start_time
from cron.job_run_details
where jobid = (select jobid from cron.job where jobname = 'checkin-reminder')
order by start_time desc limit 3;
```
Expected: recent rows with `status = 'succeeded'`. Cross-check `select status_code from net._http_response order by created desc limit 3;` shows `200`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260613100200_checkin_reminder_cron.sql
git commit -m "feat(checkin): pg_cron + pg_net every-minute reminder schedule"
```

---

## Task 10: Docs + advisors + spec close-out

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-06-13-student-checkin-design.md`

- [ ] **Step 1: Update README notifications section**

Find the notifications/cron section in `README.md` and add bullets:
- `checkin_done` / `checkin_reminder` / `checkin_missing` notification types.
- The `checkin-reminder` pg_cron job (every minute, via pg_net) and that it requires Vault secrets `app_base_url` + `cron_secret`.
- `bookings.checked_in_at` / `checked_in_by`; check-in = `completed`.
- `tenants.checkin_reminder_minutes` (default 15, null = off).

- [ ] **Step 2: Mark the spec done**

In `docs/superpowers/specs/2026-06-13-student-checkin-design.md`, change `狀態：待 review` → `狀態：已實作（2026-06-13）`.

- [ ] **Step 3: Run advisors and report**

Use Supabase MCP `get_advisors` for both `security` and `performance`. Report findings (expect none new from this work). Address any error-level findings before closing.

- [ ] **Step 4: Final verification**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all green. Then `npm run test:integration -- checkin-booking` → PASS.

- [ ] **Step 5: Commit**

```bash
git add README.md docs/superpowers/specs/2026-06-13-student-checkin-design.md
git commit -m "docs(checkin): document check-in notifications + close spec"
```

---

## Self-Review notes (for the executor)

- **Spec coverage:** check-in self-service (T4,T7), check-in=completed (T4), coach notify on check-in (T5 flow1, T7), pre-class reminder (T3,T5,T6), not-checked-in escalation to student+coach (T3,T5,T6), per-slot coach batching (T6), tenant-level configurable lead default 15/off (T1,T8), pg_cron free scheduling (T9), no check-out / no auto-no-show (intentionally absent). Owner-also-notified is explicitly deferred in T6 note (not silently dropped).
- **Type consistency:** `checkin_booking(p_booking_id)` returns `(booking_id, checked_in_at)` — consumed in T7 action only for error/success, in T4 test by `booking_id`. `ReminderBooking` / `ReminderAction` shapes match between T3 and T6. `canCheckIn` (T2) used in T7. `notify*` signatures in T5 match calls in T6/T7.
- **Window agreement:** RPC (T4) and `canCheckIn` (T2) both use start−30min..end. If one changes, change both.
