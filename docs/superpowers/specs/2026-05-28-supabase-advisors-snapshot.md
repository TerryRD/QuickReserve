---
title: Supabase Advisors Snapshot
date: 2026-05-28
status: read-only audit (no fixes shipped yet — review-then-fix)
endpoint: GET /v1/projects/{ref}/advisors/{security|performance}
project_ref: buiefmgwzxpuxfshixas
---

# Supabase Advisors — 2026-05-28 snapshot

Pulled live via Supabase Management API after Phase 1 ship. Nothing is fixed yet; this doc is the inventory.

## Security (17 WARN, 0 ERROR)

### 🟡 1 × `extension_in_public` — btree_gist in public schema
- `btree_gist` extension used by `availability_slots` GIST EXCLUDE constraint (S3 era)
- Low risk: it's a system extension, not user-defined.
- **Fix path:** move to `extensions` schema via `ALTER EXTENSION btree_gist SET SCHEMA extensions`. Need to update any references. Verify the EXCLUDE constraint still resolves the operator class.
- Defer-able. Cosmetic / best-practice. 不會洩漏資料。

### 🟡 1 × `public_bucket_allows_listing` — `coach-media` bucket
- Bucket has `coach_media_select_public` SELECT policy that allows clients to LIST all files
- Risk: someone calling `storage.objects` list endpoint could enumerate all uploaded photos / avatars (URLs include UUIDs but are guessable)
- **Fix:** restrict the SELECT policy to either no-listing (just public URL access works) or owner-only
- **Recommended.** 中優先 — 學員可以列其他教練的全部照片。

### 🟡 1 × `auth_leaked_password_protection` — HIBP check disabled
- Supabase Auth's "check against HaveIBeenPwned" feature is OFF
- **Fix:** Dashboard → Authentication → Policies → enable "Prevent sign up with leaked passwords"
- **Recommended.** 一鍵開,沒有 downside。

### 🟡 14 × SECURITY DEFINER functions executable by anon / authenticated

| Function | Anon | Auth |
|---|---|---|
| `auto_cancel_group_slot(uuid)` | ✓ | ✓ |
| `book_slot_atomic(uuid, uuid, text)` | ✓ | ✓ |
| `book_with_purchase(...)` | ✓ | ✓ |
| `cancel_booking_refund(uuid, text)` | ✓ | ✓ |
| `confirm_booking(uuid)` | ✓ | ✓ |
| `reject_booking(uuid, text)` | — | ✓ |
| `reschedule_booking(uuid, uuid, text)` | — | ✓ |
| `reschedule_booking_purchase(uuid, uuid)` | — | ✓ |
| `set_updated_at()` | — | ✓ |
| `record_member_activity(uuid)` | — | ✓ |

> Counts in advisor: 5 anon + 9 authenticated = 14 unique function×role rows; some functions appear in both.

- These are **mostly intentional** — RPCs need to be callable by `anon` (for public booking) or `authenticated` (for signed-in actions). They have internal guards (e.g. `book_slot_atomic` does its own auth check via session).
- **Risk:** if any function has a bug in its internal guard, the SECURITY DEFINER grant means it runs as superuser and can bypass RLS. Worth a one-pass audit each function checks its caller before doing anything sensitive.
- **Action:** S7 architecture/security audit should review each one explicitly. Don't blindly revoke.

---

## Performance (15 INFO + 130 WARN = 145)

> **Update 2026-05-28:** `multiple_permissive_policies` (120 lints) and `auth_rls_initplan` (10 lints) RESOLVED by migration `20260528152243_rls_rewrite_combine_permissive.sql` (commit `64bd953`). See `docs/superpowers/plans/2026-05-28-rls-rewrite-combine-permissive.md` for the rewrite plan and `2026-05-28-rls-rewrite-rollback.sql` for the escape hatch. Remaining perf lints: 5 unindexed_foreign_keys closed earlier in commit `b613dcd` (advisor may take time to catch up) + 15 unused_index (10 pre-existing + 5 from b613dcd new indexes which need ~1 week usage data to confirm safe to drop).

### 🔴 120 × `multiple_permissive_policies` (the big one)

Tables with multiple PERMISSIVE RLS policies for the same role × action — Postgres has to evaluate every one and union them, costing query time. Postgres recommends ONE PERMISSIVE + multiple RESTRICTIVE, or merge into one with OR.

| Table | Lints | Cause |
|---|---|---|
| `availability_template_assignments` | 24 | `assignments_modify_member` + `assignments_modify_owner` for SELECT/INSERT/UPDATE/DELETE × 4 roles + `assignments_select_member` overlap |
| `availability_template_windows` | 24 | same pattern as above |
| `availability_templates` | 24 | same pattern |
| `unavailable_events` | 24 | `events_modify_member` + `events_modify_owner` overlap |
| `customer_purchases` | 12 | `customer_purchases_modify_owner` + `customer_purchases_*_customer` overlap on shared rows |
| `service_packages` | 6 | similar |
| `tenant_photos` | 6 | similar |

- **Fix path:** rewrite each table's policies to **one combined policy with `OR`**, e.g.:
  ```sql
  -- Before (4 policies — multiple permissive)
  CREATE POLICY templates_select_member ON availability_templates FOR SELECT TO authenticated USING (...member check...);
  CREATE POLICY templates_select_owner  ON availability_templates FOR SELECT TO authenticated USING (...owner check...);
  -- After (1 policy)
  CREATE POLICY templates_select_member_or_owner ON availability_templates FOR SELECT TO authenticated
    USING ((...member check...) OR (...owner check...));
  ```
- High-impact:S3 + S5 era 寫 policies 時兩個 role 分別寫,沒合併。Each query against these tables pays a measurable cost.
- **Defer:** this is multi-table RLS rewrite. Treat as its own batch with full test coverage (`tests/integration/rls-identity.test.ts` etc.) to ensure no permission regression. Estimated 1-2 hours focused work.

### 🟠 10 × `auth_rls_initplan` — `auth.uid()` re-evaluated per row

Affected:
- `availability_templates` (templates_modify_member, templates_select_member)
- `availability_template_windows` (template_windows_modify_member, template_windows_select_member)
- `availability_template_assignments` (assignments_modify_member, assignments_select_member)
- `unavailable_events` (events_modify_member, events_select_member)
- `customer_purchases` (customer_purchases_insert_customer, customer_purchases_select_customer)

- **Fix:** wrap `auth.uid()` in subselect `(select auth.uid())` so Postgres caches the result for the whole query plan. Trivial textual rewrite.
- Often comes paired with the `multiple_permissive_policies` rewrite — do both at once.

### 🟡 10 × `unused_index` — drop these

| Index | Table |
|---|---|
| `idx_tenant_members_invite_token` | tenant_members |
| `idx_bookings_cancelled_by` | bookings |
| `idx_bookings_service` | bookings |
| `idx_bookings_purchase` | bookings |
| `idx_recurring_rules_member` | recurring_rules |
| `idx_recurring_rules_service` | recurring_rules |
| `idx_recurring_rules_tenant` | recurring_rules |
| `idx_tenant_customers_customer` | tenant_customers |
| `idx_tenant_members_parent` | tenant_members |
| `idx_customer_purchases_tenant_pending` | customer_purchases |

- Indexes cost disk + slow writes; if not used by any query plan, drop them.
- **Caveat:** "unused" means "Postgres hasn't used it since the stats were last reset" — recently created indexes may show as unused even when needed. Verify they truly aren't on the query path before dropping. Best to drop in a low-traffic window and watch p95 latency.

### 🟡 5 × `unindexed_foreign_keys` — add covering indexes

| Table | FK |
|---|---|
| `availability_template_assignments` | `template_id_fkey` |
| `customer_purchases` | `approved_by_fkey` |
| `customer_purchases` | `package_id_fkey` |
| `customer_purchases` | `service_id_fkey` |
| `service_packages` | `tenant_id_fkey` |

- **Fix:** `CREATE INDEX idx_<table>_<col> ON <table>(<col>);` per row.
- Low-risk addition.

---

## Recommended action order

| Priority | Item | Effort | Why |
|---|---|---|---|
| 1 | Enable leaked-password protection in Auth | 1-click | Free win |
| 2 | Restrict `coach-media` bucket SELECT policy | 1 migration | Stops listing enumeration |
| 3 | Add 5 missing FK indexes | 1 migration | Trivial perf win |
| 4 | Drop 10 unused indexes (after one more confirmation week) | 1 migration | Write-path perf + disk |
| 5 | Merge `multiple_permissive_policies` (120 lints) + fix `auth_rls_initplan` (10 lints) — 6-7 tables of RLS rewrite | Big batch (1-2h) | Read-path perf, must be done with integration tests |
| 6 | Audit each SECURITY DEFINER RPC function caller-guard | Part of S7 audit | Defence in depth |
| 7 | Move `btree_gist` extension out of public schema | Single migration with EXCLUDE constraint check | Cosmetic |

This entire list feeds into the **原本排定的 S7 architecture / security audit** (per memory `project-s7-next`). The advisor essentially pre-found ~80% of what S7 would surface — let it inform the S7 spec scope.

---

## How to re-pull

```bash
TOK='<personal access token>'
REF='buiefmgwzxpuxfshixas'
curl -s -H "Authorization: Bearer $TOK" "https://api.supabase.com/v1/projects/$REF/advisors/security" > sec.json
curl -s -H "Authorization: Bearer $TOK" "https://api.supabase.com/v1/projects/$REF/advisors/performance" > perf.json
```

Or via Dashboard: https://supabase.com/dashboard/project/buiefmgwzxpuxfshixas/advisors
