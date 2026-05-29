---
title: SECURITY DEFINER RPC caller-guard audit
date: 2026-05-29
status: ✅ both P0s fixed in migration 20260529100000_secure_booking_rpcs_auth_uid_guard.sql + tests/integration/rpc-cross-customer-guard.test.ts (3/3 green)
parent: 2026-05-28-s7-audit-report.md (Action item #4)
---

# Summary

9 SECURITY DEFINER functions identified across `supabase/migrations/*.sql` (latest definitions only).

- 🟢 4 action RPCs with proper caller-guard (`confirm_booking`, `cancel_booking`, `reschedule_booking`, `auto_cancel_group_slot`)
- 🟡 3 RLS helpers (no guard needed — called inside RLS policies which already gate by auth context): `is_platform_admin`, `current_user_tenant_ids`, `current_user_owner_tenant_ids`
- 🔴 **2 P0 MISSING guard** — `book_slot_atomic`, `book_with_purchase` accept `p_customer_id` parameter but never verify it equals `auth.uid()`

## P0 attack vectors

Both vulnerable RPCs are `grant execute … to authenticated`. Any signed-in customer can hit them directly via `POST /rest/v1/rpc/<rpc>` and pass any other customer's UUID:

- **`book_with_purchase`** — Mallory (authenticated) calls `book_with_purchase(slot_x, victim_uuid)`. The RPC picks the victim's oldest active purchase, increments `classes_used`, inserts a `bookings` row owned by `victim_uuid`. Victim's package is silently drained; Mallory pays nothing. App code at `src/app/book/[slotId]/actions.ts:56` correctly passes `auth.uid()`, but the RPC layer doesn't enforce that — REST API bypasses the app.
- **`book_slot_atomic`** — Same vector; even though application code only calls `book_with_purchase`, this older RPC is still callable (migration `20260522050000` explicitly granted it to `authenticated`). Migration `20260525200009` re-defined `book_with_purchase` with the comment "replaces book_slot_atomic" but never revoked `book_slot_atomic`.

---

# Detailed findings

## Helpers (🟡 — no guard needed)

### `is_platform_admin()`
**Latest:** `20260521110654_identity_rls.sql`
**Purpose:** Returns true if `auth.uid()` is in `platform_admins`.
**Why safe:** No parameters; returns false for anon (`auth.uid()` is null).

### `current_user_tenant_ids()`
**Latest:** `20260521110654_identity_rls.sql`
**Purpose:** Returns set of `tenant_id` where caller has an active membership.
**Why safe:** Filters by `auth.uid()` internally. Empty set for anon.

### `current_user_owner_tenant_ids()`
**Latest:** `20260521112411_fix_tenant_members_rls_recursion.sql`
**Purpose:** Same as above but role='owner'. Exists to break tenant_members RLS recursion.
**Why safe:** Same pattern.

---

## Action RPCs with proper guards (🟢)

### `confirm_booking(p_booking_id uuid)`
**Latest:** `20260521115619_book_slot_atomic_rpc.sql`
**Guard:**
```sql
select exists (
  select 1 from public.tenant_members
  where tenant_id = v_booking.tenant_id and user_id = auth.uid() and status = 'active'
) into v_is_member;
if not v_is_member and not public.is_platform_admin() then
  raise exception 'FORBIDDEN' using errcode = '42501';
end if;
```
Coach/staff-only path — confirmed.

### `cancel_booking(p_booking_id uuid)`
**Latest:** `20260525200012_rpc_cancel_booking_refund.sql`
**Guard:** Customer-owns-booking OR tenant-member OR platform-admin (lines 19-26).

### `reschedule_booking(p_old_booking_id uuid, p_new_slot_id uuid)`
**Latest:** `20260525200011_rpc_reschedule_booking_purchase.sql`
**Guard:** Customer-owns-booking OR tenant-member (lines 26-33). Also explicitly rejects cross-tenant reschedule (line 47).

### `auto_cancel_group_slot(p_slot_id uuid)`
**Latest:** `20260525200010_rpc_auto_cancel_group_slot.sql`
**Guard:** GRANT-level — only `service_role` can execute. Cron uses admin client.

---

## Action RPCs MISSING guards (🔴)

### `book_slot_atomic(p_slot_id uuid, p_customer_id uuid, p_customer_notes text)`
**Latest:** `20260521150801_tenant_customers_blocked.sql`
**Grant:** `authenticated` (migration `20260522050000` line 18).
**Gap:** No `auth.uid()` check on `p_customer_id` (lines 6-68 in the migration above). The function trusts the caller-supplied customer_id wholesale.
**Status:** Functionally replaced by `book_with_purchase` per author's comment in `20260525200009`, but **never revoked**. Reachable via REST.
**Recommended patch (in the upcoming fix migration):**

```sql
-- Insert at line 20, before slot lock
if p_customer_id <> auth.uid() then
  raise exception 'FORBIDDEN' using errcode = '42501';
end if;
```

Alternative: revoke from `authenticated` since the application doesn't use it. The defensive choice is to add the guard AND keep the function (anyone with old app cache could still hit it).

### `book_with_purchase(p_slot_id uuid, p_customer_id uuid, p_customer_notes text)`
**Latest:** `20260525200009_rpc_book_with_purchase.sql`
**Grant:** `authenticated` (line 126 of the migration).
**Gap:** Same — accepts `p_customer_id` and never verifies caller identity. Worse impact than `book_slot_atomic` because this one consumes a purchase package.
**Recommended patch:**

```sql
-- Insert at line 34, before slot lock
if p_customer_id <> auth.uid() then
  raise exception 'FORBIDDEN' using errcode = '42501';
end if;
```

---

# Recommendations

| # | Action | Priority | Effort |
|---|--------|----------|--------|
| 1 | Add `auth.uid()` guard to `book_with_purchase` | 🔴 P0 | 1 migration + 1 integration test |
| 2 | Add `auth.uid()` guard to `book_slot_atomic` (or revoke + add guard) | 🔴 P0 | Same migration |
| 3 | Integration test: confirm cross-customer call → raises `42501` | 🔴 P0 | ~20 lines, mirror `tests/integration/atomic-booking.test.ts` setup |
| 4 | Dashboard: enable "Prevent sign up with leaked passwords" | 🟠 P1 | 1 click |
| 5 | Consider whether `book_slot_atomic` is truly dead — if yes, drop in a follow-up migration to reduce attack surface | 🟡 P2 | 1 migration after app verification |

`book_with_purchase` patch + integration test + `book_slot_atomic` parallel patch all fit in **one small migration**, no schema change. Low blast radius — adds a precondition that should never have been missing.

---

# Sign-off (shipped 2026-05-29)

- 9/9 SECURITY DEFINER functions now have correct caller posture
- New integration test `tests/integration/rpc-cross-customer-guard.test.ts`
  covers Alice-impersonates-Bob attack for both RPCs + legit Bob self-book
  (3/3 green against production Supabase)
- S7 audit Action item #4 closed

## Known follow-ups (out of scope)

- `tests/integration/atomic-booking.test.ts` has been broken since S4
  (`bookings.purchase_id` NOT NULL prevents `book_slot_atomic` from inserting).
  These 3 failures predate this audit. Recommended action: rewrite the test
  against `book_with_purchase` OR delete + rely on the new guard test.
- Consider revoking `book_slot_atomic` from `authenticated` in a follow-up
  migration if the app truly never calls it (it doesn't — verified via grep).
  Reduces attack surface; leaving alive for now to avoid scope creep.
