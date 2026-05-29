---
title: A-1 Interactive purchase selection on /book
date: 2026-05-29
status: design approved, awaiting implementation plan
scope: new booking flow (`/book/<slotId>`) only — reschedule flow untouched
followup: invoke writing-plans skill to produce implementation plan
---

# Goal

Customer who holds more than one active purchase package for the same service can now choose which one to spend on a new booking. Today the picker UI exists but is disabled — the RPC silently consumes the oldest-expiring purchase regardless of any visual selection. This spec enables the picker end-to-end without altering default behavior for users who don't actively choose.

# Scope

**In**
- `/book/<slotId>` new booking confirm page — picker becomes interactive
- `book_with_purchase` RPC — gain optional `p_purchase_id uuid default null`
- Server action `createBookingAction` — passes user selection through
- Validation: chosen purchase must belong to caller, match slot's service, be active, and have remaining classes
- New error code: `PURCHASE_INVALID` (errcode `P0001`)
- 1 new integration test file covering 3 scenarios

**Out**
- Reschedule flow — `reschedule_booking` already carries `purchase_id` forward from the old booking; UI is hidden in reschedule mode (`BookForm` guards picker and notes with `!rescheduleFrom`). No change.
- Cron / admin paths — `book_with_purchase` is not invoked from cron; only customer-facing path uses it.
- New Playwright test — integration covers the RPC path; the radio interaction is an internal UI detail.
- Visual / layout changes — radio cards already designed (`page.tsx:195-244`); we only change `disabled` → enabled and move state into the form.

# Behavior change

**Before (today, 2026-05-29):**
1. /book renders radio cards for all active purchases (oldest-expiring auto-checked, `disabled`)
2. User submits — server action calls `book_with_purchase(slot, customer_id, notes)`
3. RPC picks oldest-expiring purchase, increments `classes_used` on it, returns booking

**After:**
1. /book renders the same radio cards, but **enabled**. Default selection = oldest-expiring (server-computed, identical to current visual)
2. User can change the selection before submit. Or leave the default.
3. Submit sends `purchaseId` (the user's selection — or the default if untouched) to the action
4. Action passes it as `p_purchase_id` to the RPC
5. RPC validates the selection (customer, service, active, remaining classes). On success: consume that purchase. On failure: raise `PURCHASE_INVALID` (`P0001`).
6. Error mapping in action: `PURCHASE_INVALID` → `AppError('PURCHASE_INVALID', '選擇的套裝不可用,請重新選擇')` shown via toast (existing BookForm `onError` path).

Backwards-compat: callers passing `p_purchase_id => null` (or omitting it) get exactly the old oldest-expiring behavior. No existing caller breaks because the only app caller (`createBookingAction`) is updated in the same batch.

# Changes by file

## `supabase/migrations/20260529XXXXXX_book_with_purchase_optional_purchase_id.sql` (new)

Replace `book_with_purchase` with a 4-arg version. Keep the auth.uid() guard, slot lock, capacity check, group auto-confirm, and `return next` — only the purchase-selection branch changes.

```sql
create or replace function public.book_with_purchase(
  p_slot_id uuid,
  p_customer_id uuid,
  p_customer_notes text default null,
  p_purchase_id uuid default null
)
returns table (booking_id uuid, auto_confirmed boolean)
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
  -- Existing guard (kept verbatim)
  if auth.role() <> 'service_role' then
    if auth.uid() is null or p_customer_id <> auth.uid() then
      raise exception 'FORBIDDEN' using errcode = '42501';
    end if;
  end if;

  -- 1. Lock slot, validate availability (unchanged)
  -- 2. Load service capacity (unchanged)
  -- 3. Capacity check (unchanged)

  -- 4. Choose the purchase:
  if p_purchase_id is not null then
    -- Validate user-supplied selection
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
    -- Fall back to oldest-expiring (current behavior)
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

  -- 5-9. tenant_customers upsert / classes_used++ / insert booking / slot status / auto-confirm
  -- (unchanged from current implementation)
end;
$$;

grant execute on function public.book_with_purchase(uuid, uuid, text, uuid) to authenticated;
```

Note: PostgreSQL function overload resolution treats this as a new signature. The 3-arg version is implicitly replaced via `create or replace` only if signature matches — but adding `p_purchase_id default null` changes the signature. The migration must `drop function public.book_with_purchase(uuid, uuid, text)` first, then `create` the new 4-arg version. Otherwise both versions coexist and the 3-arg callers would silently win.

## `src/app/book/[slotId]/actions.ts:14-18, 56-60`

Schema:
```ts
const CreateBookingSchema = z.object({
  slotId: z.string().uuid(),
  customerNotes: z.string().max(500).optional().nullable(),
  rescheduleFrom: z.string().uuid().optional().nullable(),
  purchaseId: z.string().uuid().optional().nullable(),   // NEW
})
```

RPC call:
```ts
const { data, error } = await supabase.rpc('book_with_purchase', {
  p_slot_id: parsedInput.slotId,
  p_customer_id: session.userId,
  p_customer_notes: parsedInput.customerNotes ?? undefined,
  p_purchase_id: parsedInput.purchaseId ?? undefined,    // NEW
})
```

Error mapping (after existing `NO_BALANCE`):
```ts
if (error.message?.includes('PURCHASE_INVALID'))
  throw new AppError('PURCHASE_INVALID', '選擇的套裝不可用,請重新選擇')
```

Reschedule branch is untouched — `reschedule_booking` doesn't take a purchase_id.

## `src/app/book/[slotId]/page.tsx:80-265`

Remove the standalone "Package balance picker" `<section>` (lines 195-245). Pass `activePurchases` array + `defaultPurchaseId` to `BookForm`.

```tsx
<BookForm
  slotId={slotId}
  rescheduleFrom={rescheduleFrom ?? null}
  purchases={activePurchases}        // NEW
  defaultPurchaseId={activePurchase.id}  // NEW
  serviceCancelDeadlineHours={service?.cancel_deadline_hours ?? 24}  // NEW (was inline)
/>
```

The cancellation-policy block stays inline in page.tsx — it's not coupled to form state.

## `src/app/book/[slotId]/book-form.tsx`

Extended to render the picker and own selection state. In reschedule mode, picker is still hidden (current behavior).

```tsx
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
  const { execute, isPending } = useAction(createBookingAction, { ... })

  return (
    <form onSubmit={(e) => {
      e.preventDefault()
      execute({
        slotId,
        customerNotes: customerNotes || null,
        rescheduleFrom: rescheduleFrom ?? null,
        purchaseId: rescheduleFrom ? null : selectedPurchaseId,
      })
    }}>
      {!rescheduleFrom && (
        <>
          {/* Package picker section — moved from page.tsx, radios now enabled */}
          <section>
            <SectionHead kicker="PACKAGE · 套裝餘額" title="本次將扣除" eng="DEDUCT" hint="..." />
            <div className="grid gap-3">
              {purchases.map((p) => (
                <label key={p.id} ...>
                  <input
                    type="radio"
                    name="package"
                    value={p.id}
                    checked={p.id === selectedPurchaseId}
                    onChange={() => setSelectedPurchaseId(p.id)}
                  />
                  ...
                </label>
              ))}
            </div>
          </section>
          {/* Notes input — unchanged */}
        </>
      )}
      <PrimaryCta type="submit" disabled={isPending}>...</PrimaryCta>
    </form>
  )
}
```

The PrimaryCta + helper text below stay where they are.

## `tests/integration/book-with-purchase-selection.test.ts` (new)

Mirrors the setup in `atomic-booking.test.ts`. One customer with TWO confirmed purchases for the same service; first expires sooner. 3 scenarios:

1. **Caller passes the later-expiring purchase explicitly**
   - Assert: that purchase's `classes_used` increments to 1; the earlier-expiring one stays at 0.
   - Proves the user override actually overrides oldest-expiring.

2. **Caller passes an invalid purchase (used up)**
   - Setup: bump alice's later-expiring purchase to `classes_used = classes_total` before the call.
   - Pass that purchase_id → expect `PURCHASE_INVALID` error (`P0001`).
   - Slot stays available; nothing consumed.

3. **Caller passes a purchase belonging to another customer**
   - Bob has his own confirmed purchase. Alice (signed-in client) calls `book_with_purchase` with `p_customer_id = alice` + `p_purchase_id = bob's purchase id`.
   - Expected: `PURCHASE_INVALID` (the validation finds no row matching alice's customer_id + that purchase id).
   - Note: the auth.uid() guard from yesterday is also in play but the customer is alice (matches auth.uid()), so the request gets past the guard and hits the purchase validation specifically.

# Risk / blast radius

- **Functional**: low. The default code path (no `p_purchase_id`) preserves byte-identical behavior. Only the new branch is exercised by the updated UI.
- **Security**: improved. Cross-customer purchase theft was already blocked by yesterday's `auth.uid()` guard, but the new `customer_id` filter in the validation query closes a defense-in-depth gap (a future caller that bypasses the guard — e.g., service_role with the wrong customer_id — would still be caught).
- **Race conditions**: tiny window between page load and submit. If alice's chosen purchase expires or is consumed mid-flight, `PURCHASE_INVALID` surfaces a clear toast and lets her retry. No silent fallback to maintain user trust ("I picked package X — why was package Y consumed?").
- **Migration safety**: must `DROP FUNCTION ... (uuid, uuid, text)` before `CREATE` because PostgreSQL keeps overloads. Rollback path: re-create the 3-arg version from `20260529100000_secure_booking_rpcs_auth_uid_guard.sql`.
- **Backwards-compat for `book_slot_atomic`**: untouched. It was revoked from `authenticated` yesterday, app code no longer calls it, no overlap.

# Files touched

| File | Type | Change |
|---|---|---|
| `supabase/migrations/20260529XXXXXX_book_with_purchase_optional_purchase_id.sql` | new | DROP old 3-arg, CREATE new 4-arg |
| `src/app/book/[slotId]/actions.ts` | edit | Add `purchaseId` to schema + RPC call + error mapping |
| `src/app/book/[slotId]/page.tsx` | edit | Remove inline picker `<section>`; pass `purchases` + `defaultPurchaseId` to BookForm |
| `src/app/book/[slotId]/book-form.tsx` | edit | Accept new props; own selection state; render enabled radio picker |
| `tests/integration/book-with-purchase-selection.test.ts` | new | 3-case purchase-selection coverage |
| `src/lib/supabase/types.ts` | regen | `npm run db:types` after migration applies (4-arg signature) |

# Out-of-scope follow-ups

None for this batch. After this lands, `/notifications` persistent read state, group capacity counters, and Web Push remain as separate items in TOMORROW.md.
