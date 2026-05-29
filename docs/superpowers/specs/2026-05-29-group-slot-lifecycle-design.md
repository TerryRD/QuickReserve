---
title: A-6 Group slot lifecycle + capacity counter
date: 2026-05-29
status: design approved
followup: writing-plans next
---

# Problem

Three RPCs share an oversimplified slot lifecycle that breaks for group classes (services where `max_capacity > 1`):

1. **`book_with_purchase`** sets `slot.status = 'booked'` the moment a booking pushes the count to `min_attendance`, not when the slot is actually full. The 3rd booker on a 4-seat / min-2 class hits `SLOT_UNAVAILABLE` even though 2 seats remain. (Found during A-6 backlog review, 2026-05-29.)
2. **`cancel_booking`** unconditionally sets `slot.status = 'available'` on cancel. In a group with 3 of 4 confirmed bookings, cancelling one drops the slot to `'available'` even though 2 remaining bookings still exist — and the public API would re-emit it as if empty.
3. **`reschedule_booking`** requires `v_new_slot.status = 'available'` for the destination, blocking reschedule into a partially-filled group. Same `'available'` over-set on the old slot as cancel.

Plus the public slot picker has no way to display "2/4 已報名" — `TimeChip state='group'` already supports it, but `/api/public/slots` returns only `id / start_at / end_at`.

# Slot lifecycle (corrected)

A `availability_slots.status` is a denormalised view of the booking count for the slot:

| Status | Invariant |
|---|---|
| `available` | 0 active (non-cancelled) bookings |
| `pending` | `1 ≤ count < max_capacity` |
| `booked` | `count ≥ max_capacity` |
| `cancelled` | slot itself was cancelled by coach (out of scope here) |

Booking row state (`bookings.status`) is independent — `auto-confirm` at `min_attendance` still bulk-flips all booking rows to `confirmed`, but the slot's status reflects capacity, not confirmation.

For 1-on-1 services (`max_capacity = 1`): `min_attendance = 1`, so the first booking pushes count to 1 = max → slot jumps straight from `available` to `booked`, identical to today's behaviour. The fix is invisible to existing single-seat tests.

# Migration changes (one file, three function rewrites)

`supabase/migrations/20260529140000_group_slot_lifecycle_fix.sql`

## `book_with_purchase`
Split the existing "if reached min_attendance → confirm + mark booked" block into two independent checks:

```sql
-- 9a. Auto-confirm bookings when min_attendance reached (unchanged semantics)
if v_existing_count + 1 >= v_service.min_attendance then
  update public.bookings
    set status = 'confirmed'
    where slot_id = p_slot_id and status = 'pending';
  v_auto_confirmed := true;
end if;

-- 9b. Mark slot fully booked only when capacity is filled
if v_existing_count + 1 >= v_service.max_capacity then
  update public.availability_slots
    set status = 'booked'
    where id = p_slot_id;
end if;
```

Everything else in the function (guard, slot lock, capacity check, purchase resolution, booking insert, set slot pending) stays byte-for-byte.

## `cancel_booking`
Replace the unconditional `update availability_slots set status = 'available'` with a count-aware rebuild. After cancelling the booking, recount and pick the right status:

```sql
-- Rebuild slot status from remaining active bookings
declare
  v_remaining int;
begin
  select count(*) into v_remaining
    from public.bookings
    where slot_id = v_booking.slot_id and status <> 'cancelled';
  update public.availability_slots
    set status = case when v_remaining = 0 then 'available' else 'pending' end
    where id = v_booking.slot_id;
end;
```

(The function already opens a PL/pgSQL block, so the inner `declare` just adds one variable. If easier, move `v_remaining` to the outer DECLARE block.)

## `reschedule_booking`
Two edits:

1. Accept `'pending'` as a valid destination for groups:
   ```sql
   if v_new_slot.status not in ('available', 'pending') then
     raise exception 'SLOT_UNAVAILABLE' using errcode = 'P0001';
   end if;
   ```
2. Apply the same recount-on-cancel logic to the OLD slot:
   ```sql
   -- ... after cancelling old booking ...
   select count(*) into v_remaining_old
     from public.bookings
     where slot_id = v_old.slot_id and status <> 'cancelled';
   update public.availability_slots
     set status = case when v_remaining_old = 0 then 'available' else 'pending' end
     where id = v_old.slot_id;
   ```
3. New slot transitions: insert booking (status='pending'), set slot 'pending' if not already 'pending', then run the same 9a/9b logic from `book_with_purchase` for auto-confirm + capacity-full check. Reschedule today doesn't apply auto-confirm — that's also wrong for groups. Add the same two-step block.

`reschedule_booking` doesn't accept `p_purchase_id` (carries the old purchase forward) and that's unchanged.

# Public API change

`src/app/api/public/slots/route.ts`:

```ts
const { data, error } = await supabase
  .from('availability_slots')
  .select(`
    id, start_at, end_at,
    services(max_capacity),
    bookings(id, status)
  `)
  .eq('tenant_id', tenantId)
  .eq('service_id', serviceId)
  .in('status', ['available', 'pending'])   // groups in progress are still bookable
  .gte('start_at', dayStart)
  .lt('start_at', dayEnd)
  .order('start_at')

// Map: compute current_bookings = count where status <> 'cancelled'
return data.map(s => {
  const max = (s.services as { max_capacity: number }).max_capacity
  const active = (s.bookings as Array<{ status: string }>).filter(b => b.status !== 'cancelled').length
  return { id: s.id, start_at: s.start_at, end_at: s.end_at, max_capacity: max, current_bookings: active }
}).filter(s => s.current_bookings < s.max_capacity)
```

The trailing `.filter` is defensive — once `book_with_purchase` is fixed, `status = 'booked'` already excludes full slots, so the count filter only catches a race.

# UI change

`src/app/[tenantSlug]/slot-picker.tsx`:

The `Slot` type gains `max_capacity` + `current_bookings`. Where `TimeChip` is rendered, derive state:

```tsx
const isGroup = slot.max_capacity > 1
const state: TimeChipState = isSelected
  ? 'selected'
  : isGroup
    ? 'group'
    : 'open'
const group = isGroup
  ? { filled: slot.current_bookings, capacity: slot.max_capacity }
  : undefined

return <TimeChip key={slot.id} time={...} state={state} group={group} onSelect={...} />
```

`TimeChip` already accepts `state='group'` + `group={filled,capacity}` per `src/components/booking/time-chip.tsx` — no change there.

# Test plan

New integration test `tests/integration/group-slot-lifecycle.test.ts` covers:

1. **Group fills correctly** — service max=4 min=2.
   - Book A → slot=`pending`, A=`pending`, `auto_confirmed=false`
   - Book B → slot=`pending`, A=B=`confirmed`, `auto_confirmed=true`
   - Book C → slot=`pending`, all=`confirmed`
   - Book D → slot=`booked`, all=`confirmed`
   - Book E (5th attempt) → `SLOT_UNAVAILABLE` (status=booked) or `SLOT_FULL` (whichever fires first; both are correct)
2. **Cancel preserves pending** — 3 confirmed in a 4-seat slot, cancel one → slot=`pending`, remaining 2 still `confirmed`, B's purchase classes_used decremented by 1.
3. **Cancel last booking** — only 1 booking, cancel → slot=`available`.
4. **Reschedule into group** — A has booking on `slotX`. Try `reschedule_booking(A.booking, slotY)` where slotY is a group with 1 of 4 bookings (`pending`). Expect: success; slotX rebuilt (to `available` or `pending` depending on its other bookings), slotY now has 2 bookings; slot stays `pending`.

Existing tests (`atomic-booking`, `rpc-cross-customer-guard`, `book-with-purchase-selection`) use `max=1, min=1` and should pass unchanged — verify after migration.

# Files touched

| File | Change |
|---|---|
| `supabase/migrations/20260529140000_group_slot_lifecycle_fix.sql` | new — rewrite 3 RPCs |
| `src/app/api/public/slots/route.ts` | edit — join, compute counts, return max_capacity + current_bookings |
| `src/app/[tenantSlug]/slot-picker.tsx` | edit — new `Slot` fields, derive TimeChip state + group prop |
| `tests/integration/group-slot-lifecycle.test.ts` | new — 4 scenarios |
| `TOMORROW.md` | edit — strike A-6 |

`src/lib/supabase/types.ts` won't change (no schema columns added).

# Risk

- 1-on-1 services keep identical observable behaviour (count=1=max immediately → 'booked'). All 9 existing tests should pass.
- Race between cancel + concurrent book on a group: cancel might rebuild status while a book is mid-flight. Both acquire `FOR UPDATE` on the slot row, so transactions serialise. The later one sees the post-other state. No torn state.
- Booking's `purchase_id` carry-through unchanged.
- No new error codes introduced.

# Out of scope

- Coach-side group view doesn't currently distinguish 2-of-4 vs 4-of-4. A-6 ships only the public-side capacity counter.
- Group min_attendance auto-cancel cron (`auto_cancel_group_slot`) is unrelated; it triggers when min not reached by service start. Untouched.
