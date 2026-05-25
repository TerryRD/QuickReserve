# S4 — Services Model Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 引入 punch-card 套裝/課數模型（service_packages + customer_purchases，bookings 強制經過 purchase）、團班最少人數機制（service capacity + min_attendance + 教練自訂 deadline、auto-confirm/auto-cancel cron）、軟刪除規範化（is_active 統一語意 + UI「刪除/重新啟用」）。

**Architecture:** 2 張新表（service_packages、customer_purchases）+ bookings 加 purchase_id FK + services 加 3 個 group class 欄位。Book flow 改走新 RPC `book_with_purchase`（替代 `book_slot_atomic`），內部 SELECT FOR UPDATE lock slot row 防超賣。新 cron `auto-cancel-group-class` 每小時跑、達 deadline 不足 min_attendance 時 RPC `auto_cancel_group_slot` 取消整 slot + 退課數 + 通知。軟刪除沿用 is_active，UI 改寫「刪除/重新啟用」並加「已刪除」分頁。

**Tech Stack:** Next.js 15 App Router, TypeScript strict, Supabase (PostgreSQL + RLS + plpgsql RPC), Vitest, next-safe-action + Zod, Tailwind + shadcn/ui (base-ui), date-fns, sonner, web-push.

**Spec reference:** [`docs/superpowers/specs/2026-05-25-s4-services-model-design.md`](../specs/2026-05-25-s4-services-model-design.md)

**Out of scope:** 金流整合、跨 service package、refund 財務文件、customer/tenant 軟刪除、公開頁顯示 X/Y。

---

## File Map

**Create**

**Migrations**（11 個 SQL 檔，timestamp 連續以強制應用順序）：
- `supabase/migrations/20260525200000_service_packages_schema.sql`
- `supabase/migrations/20260525200001_service_packages_rls.sql`
- `supabase/migrations/20260525200002_customer_purchases_schema.sql`
- `supabase/migrations/20260525200003_customer_purchases_rls.sql`
- `supabase/migrations/20260525200004_bookings_add_purchase_id.sql`
- `supabase/migrations/20260525200005_backfill_synthetic_purchases.sql`
- `supabase/migrations/20260525200006_bookings_purchase_id_not_null.sql`
- `supabase/migrations/20260525200007_services_group_class_columns.sql`
- `supabase/migrations/20260525200008_bookings_slot_customer_unique.sql`
- `supabase/migrations/20260525200009_rpc_book_with_purchase.sql`
- `supabase/migrations/20260525200010_rpc_auto_cancel_group_slot.sql`

**Pure / helper code:**
- `src/lib/purchases.ts` — `isActivePurchase`, types
- `tests/unit/purchases.test.ts`
- `src/lib/purchases-server.ts` — `findActivePurchaseForBooking`, `getCustomerBalance` (server-only)

**教練後台 (`(tenant)/packages/`):**
- `src/app/(tenant)/packages/page.tsx`
- `src/app/(tenant)/packages/loading.tsx`
- `src/app/(tenant)/packages/actions.ts` — createPackage / updatePackage / softDeletePackage / restorePackage
- `src/app/(tenant)/packages/package-form-dialog.tsx`
- `src/app/(tenant)/packages/package-actions-row.tsx` — delete/restore buttons

**Pending review queue:**
- `src/app/(tenant)/packages/pending/page.tsx`
- `src/app/(tenant)/packages/pending/loading.tsx`
- `src/app/(tenant)/packages/pending/purchase-actions.ts` — approvePurchase / rejectPurchase
- `src/app/(tenant)/packages/pending/purchase-row.tsx`

**學員端 (`[tenantSlug]/packages/` + `purchases/`):**
- `src/app/[tenantSlug]/packages/page.tsx` — 瀏覽 service 的 packages
- `src/app/[tenantSlug]/packages/loading.tsx`
- `src/app/[tenantSlug]/packages/purchase-request-form.tsx`
- `src/app/[tenantSlug]/packages/purchase-request-action.ts`
- `src/app/[tenantSlug]/purchases/page.tsx` — 學員看自己的餘額
- `src/app/[tenantSlug]/purchases/loading.tsx`

**Cron:**
- `src/app/api/cron/auto-cancel-group-class/route.ts`

**Modify:**
- `src/lib/supabase/types.ts` — regen
- `src/lib/notify-booking.ts` — 加 group-confirm / group-cancel / purchase-approved / purchase-rejected types
- `src/app/(tenant)/sidebar-nav.tsx` — 加「套裝管理」+「審核」連結
- `src/app/(tenant)/services/page.tsx` — 加 active/archived tab
- `src/app/(tenant)/services/actions.ts` — 改 deactivateServiceAction → softDeleteServiceAction + 新 restoreServiceAction；CreateService/UpdateService schema 加 maxCapacity / minAttendance / cancelDeadlineHours
- `src/app/(tenant)/services/service-form-dialog.tsx` — 加 group class fields + 改按鈕語意
- `src/app/book/[slotId]/page.tsx` — 加 balance check 顯示 packages CTA
- `src/app/book/[slotId]/actions.ts` — createBookingAction 改走 `book_with_purchase`，cancel 走 `cancel_booking_with_refund`（如要的話；既有 `cancel_booking` RPC 加退課數邏輯）
- `src/app/(tenant)/calendar/page.tsx` — slots query 帶 max_capacity；slotDisplays 增 `bookingCount` 與 `maxCapacity`
- `src/app/(tenant)/calendar/calendar-panel.tsx` — SlotDisplay 加 `bookingCount: number | null`, `maxCapacity: number`
- `src/app/(tenant)/calendar/week-grid.tsx` — slot 上若 max_capacity > 1 顯示「N/M」
- `src/app/(tenant)/calendar/list-view.tsx` — 同上
- `src/app/(tenant)/calendar/slot-popover.tsx` — 若 max_capacity > 1 顯示成員列表 + 「N/M 已預約」
- `src/app/(customer)/my-bookings/page.tsx` — 顯示套裝來源
- `scripts/seed-test-data.mjs` — 改 bookSlot 走 purchase；新增 林教練 packages、purchases、團班 demo（網球團體班 capacity=4 min=3）
- `vercel.json` — 加 auto-cancel-group-class cron entry
- `README.md` — 加「套裝 / 課數模型」與「團班」說明節
- `docs/superpowers/specs/2026-05-21-quickreserve-redesign-design.md` 附錄 C — 加 FR-125~130

---

## Conventions

- 直接在 `master` 分支工作（專案慣例）
- 每 task 收尾 commit 一次，HEREDOC commit message，末尾掛 `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`
- Pure function 走 TDD（Task 1）
- 改 schema 需 `npm run db:push` 推 Supabase；產 types `npm run db:types`
- **務必依 migration timestamp 順序執行**，特別是 backfill 與 NOT NULL 順序
- 各 task 跑 `npm run typecheck` + `npm run build` 作為機器驗證
- 不 push origin 直到 Task 19；最後 push 後等 Vercel READY 才算結束
- Task 4（backfill）跑前先 `pg_dump`（透過 Supabase Dashboard），失敗有 rollback path

---

## Task 1: `isActivePurchase` + types (TDD)

**Files:**
- Create: `src/lib/purchases.ts`
- Create: `tests/unit/purchases.test.ts`

- [ ] **Step 1: 寫失敗測試**

`tests/unit/purchases.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { isActivePurchase, type CustomerPurchase } from '@/lib/purchases'

const base: CustomerPurchase = {
  id: 'p1',
  approval_status: 'confirmed',
  classes_total: 10,
  classes_used: 0,
  expires_at: null,
}

const now = new Date('2026-06-01T00:00:00Z')

describe('isActivePurchase', () => {
  it('returns true for confirmed + remaining + never expires', () => {
    expect(isActivePurchase(base, now)).toBe(true)
  })

  it('returns false when not yet confirmed', () => {
    expect(isActivePurchase({ ...base, approval_status: 'pending_review' }, now)).toBe(false)
  })

  it('returns false when rejected', () => {
    expect(isActivePurchase({ ...base, approval_status: 'rejected' }, now)).toBe(false)
  })

  it('returns false when classes exhausted', () => {
    expect(isActivePurchase({ ...base, classes_used: 10 }, now)).toBe(false)
  })

  it('returns true when classes partially used but balance remains', () => {
    expect(isActivePurchase({ ...base, classes_used: 3 }, now)).toBe(true)
  })

  it('returns false when expired', () => {
    expect(
      isActivePurchase({ ...base, expires_at: '2026-05-30T00:00:00Z' }, now),
    ).toBe(false)
  })

  it('returns true when expires_at in future', () => {
    expect(
      isActivePurchase({ ...base, expires_at: '2026-06-10T00:00:00Z' }, now),
    ).toBe(true)
  })

  it('returns false at exact expiration moment', () => {
    expect(
      isActivePurchase({ ...base, expires_at: '2026-06-01T00:00:00Z' }, now),
    ).toBe(false)
  })
})
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npm run test -- tests/unit/purchases.test.ts`
Expected: FAIL — module not found `@/lib/purchases`

- [ ] **Step 3: 實作最小通過**

`src/lib/purchases.ts`:

```ts
export type ApprovalStatus = 'pending_review' | 'confirmed' | 'rejected'
export type PaymentSelfReport = 'claimed_paid' | 'awaiting_payment'

export type CustomerPurchase = {
  id: string
  approval_status: ApprovalStatus
  classes_total: number
  classes_used: number
  expires_at: string | null // ISO timestamp or null = never expires
}

/**
 * A purchase is "active" (usable for booking) when:
 *   - approved by coach
 *   - has remaining balance
 *   - not expired (null expires_at means permanent)
 */
export function isActivePurchase(p: CustomerPurchase, now: Date): boolean {
  if (p.approval_status !== 'confirmed') return false
  if (p.classes_used >= p.classes_total) return false
  if (p.expires_at !== null && new Date(p.expires_at) <= now) return false
  return true
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npm run test -- tests/unit/purchases.test.ts`
Expected: 8 tests PASS

- [ ] **Step 5: typecheck**

Run: `npm run typecheck`
Expected: no errors

- [ ] **Step 6: commit**

```bash
git add src/lib/purchases.ts tests/unit/purchases.test.ts
git commit -m "$(cat <<'EOF'
feat(s4): isActivePurchase pure function + types (FR-127 part)

Predicate for "purchase is usable for booking": confirmed approval +
remaining balance + not expired. Used by SlotPicker balance check and
the book_with_purchase RPC's candidate selection. Eight test cases
cover approval states, exhaustion, expiration boundary (strict less-than).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Migrations — `service_packages` schema + RLS

**Files (Create):**
- `supabase/migrations/20260525200000_service_packages_schema.sql`
- `supabase/migrations/20260525200001_service_packages_rls.sql`

- [ ] **Step 1: schema 檔**

`supabase/migrations/20260525200000_service_packages_schema.sql`:

```sql
-- service_packages: per-service N-class bundles defined by coach
create table public.service_packages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  name text not null,
  class_count int not null check (class_count >= 1),
  price numeric(10, 2) not null check (price >= 0),
  expires_in_days int check (expires_in_days is null or expires_in_days > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_service_packages_service on public.service_packages(service_id, is_active);

create trigger service_packages_set_updated_at
  before update on public.service_packages
  for each row execute function public.set_updated_at();
```

- [ ] **Step 2: RLS 檔**

`supabase/migrations/20260525200001_service_packages_rls.sql`:

```sql
alter table public.service_packages enable row level security;

-- Tenant members read their own packages
create policy service_packages_select_member on public.service_packages for select
  using (tenant_id in (select current_user_tenant_ids()));

-- Public can read active packages of active tenants (學員瀏覽)
create policy service_packages_select_public on public.service_packages for select
  using (
    is_active = true
    and tenant_id in (select id from public.tenants where status = 'active')
  );

create policy service_packages_select_admin on public.service_packages for select
  using (is_platform_admin());

-- Only tenant owners can write
create policy service_packages_insert_owner on public.service_packages for insert
  with check (tenant_id in (select current_user_owner_tenant_ids()));
create policy service_packages_update_owner on public.service_packages for update
  using (tenant_id in (select current_user_owner_tenant_ids()));
create policy service_packages_delete_owner on public.service_packages for delete
  using (tenant_id in (select current_user_owner_tenant_ids()));
```

- [ ] **Step 3: 不跑 db:push（與 Task 3 一起跑）**

Migrations 累積到 Task 6 之後一次推。先確認檔案語法 OK：

Run: `cat supabase/migrations/20260525200000_service_packages_schema.sql | head -5`
Expected: 內容無亂碼

- [ ] **Step 4: commit**

```bash
git add supabase/migrations/20260525200000_service_packages_schema.sql supabase/migrations/20260525200001_service_packages_rls.sql
git commit -m "$(cat <<'EOF'
feat(s4): service_packages schema + RLS (FR-125 part)

Per-service N-class bundles. Coach defines packages for each service
(single class = class_count=1, package = N>1). RLS follows the
services pattern: tenant_member SELECT all own; public SELECT
is_active=true of active tenants; only owner can write.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Migrations — `customer_purchases` schema + RLS

**Files (Create):**
- `supabase/migrations/20260525200002_customer_purchases_schema.sql`
- `supabase/migrations/20260525200003_customer_purchases_rls.sql`

- [ ] **Step 1: schema 檔**

`supabase/migrations/20260525200002_customer_purchases_schema.sql`:

```sql
-- customer_purchases: every booking source (both single class N=1 and packages N>1)
create table public.customer_purchases (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid not null references public.customers(id),
  service_id uuid not null references public.services(id),
  package_id uuid references public.service_packages(id),
  classes_total int not null check (classes_total >= 1),
  classes_used int not null default 0
    check (classes_used >= 0 and classes_used <= classes_total),
  expires_at timestamptz,
  payment_self_reported text not null
    check (payment_self_reported in ('claimed_paid', 'awaiting_payment')),
  approval_status text not null default 'pending_review'
    check (approval_status in ('pending_review', 'confirmed', 'rejected')),
  approved_at timestamptz,
  approved_by uuid references auth.users(id),
  rejected_reason text,
  created_at timestamptz not null default now()
);

create index idx_customer_purchases_lookup
  on public.customer_purchases(customer_id, service_id, approval_status, expires_at);

create index idx_customer_purchases_tenant_pending
  on public.customer_purchases(tenant_id, approval_status)
  where approval_status = 'pending_review';
```

- [ ] **Step 2: RLS 檔**

`supabase/migrations/20260525200003_customer_purchases_rls.sql`:

```sql
alter table public.customer_purchases enable row level security;

-- Customer reads own; tenant_member reads all in own tenant; admin all
create policy customer_purchases_select_customer on public.customer_purchases for select
  using (customer_id = auth.uid());

create policy customer_purchases_select_member on public.customer_purchases for select
  using (tenant_id in (select current_user_tenant_ids()));

create policy customer_purchases_select_admin on public.customer_purchases for select
  using (is_platform_admin());

-- Customer can request own purchase (must start as pending_review)
create policy customer_purchases_insert_customer on public.customer_purchases for insert
  with check (
    customer_id = auth.uid()
    and approval_status = 'pending_review'
    and classes_used = 0
    and approved_at is null
    and approved_by is null
  );

-- Tenant members can also create (e.g. coach walks customer through purchase in person)
create policy customer_purchases_insert_member on public.customer_purchases for insert
  with check (tenant_id in (select current_user_tenant_ids()));

-- Only tenant members can update (approve/reject/adjust classes)
create policy customer_purchases_update_member on public.customer_purchases for update
  using (tenant_id in (select current_user_tenant_ids()));

-- Delete: deny for everyone via no policy (we don't hard-delete; reject + leave audit trail)
```

- [ ] **Step 3: commit**

```bash
git add supabase/migrations/20260525200002_customer_purchases_schema.sql supabase/migrations/20260525200003_customer_purchases_rls.sql
git commit -m "$(cat <<'EOF'
feat(s4): customer_purchases schema + RLS (FR-126 part)

Student purchases (both single class and N-class packages). Tracks
approval_status (pending_review / confirmed / rejected) + classes
balance + expiration. Customer can insert own as pending; tenant
members can approve or insert directly. No DELETE policy — keep
audit trail.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Migrations — bookings purchase_id (nullable + backfill + NOT NULL)

**Files (Create):**
- `supabase/migrations/20260525200004_bookings_add_purchase_id.sql`
- `supabase/migrations/20260525200005_backfill_synthetic_purchases.sql`
- `supabase/migrations/20260525200006_bookings_purchase_id_not_null.sql`

⚠ **DESTRUCTIVE-ADJACENT**：此 task 改現有資料。先 Supabase Dashboard → SQL Editor 跑 `select count(*) from public.bookings;` 紀錄當前 count；若 backfill 失敗、新表可丟、column 可 drop。

- [ ] **Step 1: 加 purchase_id 欄（nullable）**

`supabase/migrations/20260525200004_bookings_add_purchase_id.sql`:

```sql
alter table public.bookings
  add column purchase_id uuid references public.customer_purchases(id);
create index idx_bookings_purchase on public.bookings(purchase_id);
```

- [ ] **Step 2: backfill synthetic purchases**

`supabase/migrations/20260525200005_backfill_synthetic_purchases.sql`:

```sql
-- For each existing booking, create a 1-class synthetic purchase
-- (pre-S4 legacy data) so that the FK NOT NULL constraint can be
-- safely added next. Synthetic purchases are marked 'confirmed' +
-- 'claimed_paid' and never expire.
do $$
declare
  v_booking record;
  v_purchase_id uuid;
begin
  for v_booking in
    select id, tenant_id, customer_id, service_id, created_at
    from public.bookings
    where purchase_id is null
  loop
    insert into public.customer_purchases (
      tenant_id, customer_id, service_id, package_id,
      classes_total, classes_used,
      expires_at,
      payment_self_reported, approval_status,
      approved_at, approved_by,
      created_at
    ) values (
      v_booking.tenant_id, v_booking.customer_id, v_booking.service_id, null,
      1, 1,
      null,
      'claimed_paid', 'confirmed',
      v_booking.created_at, null,
      v_booking.created_at
    )
    returning id into v_purchase_id;

    update public.bookings
      set purchase_id = v_purchase_id
      where id = v_booking.id;
  end loop;
end $$;
```

- [ ] **Step 3: 加 NOT NULL constraint**

`supabase/migrations/20260525200006_bookings_purchase_id_not_null.sql`:

```sql
alter table public.bookings alter column purchase_id set not null;
```

- [ ] **Step 4: commit**

```bash
git add supabase/migrations/20260525200004_bookings_add_purchase_id.sql supabase/migrations/20260525200005_backfill_synthetic_purchases.sql supabase/migrations/20260525200006_bookings_purchase_id_not_null.sql
git commit -m "$(cat <<'EOF'
feat(s4): bookings.purchase_id FK + backfill synthetic purchases (FR-127 part)

Three-step migration: add column nullable, backfill one synthetic
1-class purchase per existing booking (approved + claimed_paid + never
expires), then set NOT NULL. Existing bookings stay functional while
new bookings flow through book_with_purchase RPC (Task 7).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Migrations — services group class columns + unique index swap

**Files (Create):**
- `supabase/migrations/20260525200007_services_group_class_columns.sql`
- `supabase/migrations/20260525200008_bookings_slot_customer_unique.sql`

- [ ] **Step 1: services 加欄位**

`supabase/migrations/20260525200007_services_group_class_columns.sql`:

```sql
alter table public.services
  add column max_capacity int not null default 1
    check (max_capacity >= 1),
  add column min_attendance int not null default 1
    check (min_attendance >= 1),
  add column cancel_deadline_hours int not null default 24
    check (cancel_deadline_hours >= 1);

-- Cross-column check: min_attendance <= max_capacity
alter table public.services
  add constraint services_min_le_max
  check (min_attendance <= max_capacity);
```

注意：`cancel_deadline_hours >= 1` 因為 cron 跑頻率最高每小時。

- [ ] **Step 2: 替換 unique index**

`supabase/migrations/20260525200008_bookings_slot_customer_unique.sql`:

```sql
-- Drop 1-slot-1-booking guard (incompatible with group classes)
drop index if exists public.bookings_slot_unique_active;

-- Replace with: one customer can only book a slot once (still no double-booking)
create unique index bookings_slot_customer_unique
  on public.bookings(slot_id, customer_id)
  where status <> 'cancelled';
```

- [ ] **Step 3: commit**

```bash
git add supabase/migrations/20260525200007_services_group_class_columns.sql supabase/migrations/20260525200008_bookings_slot_customer_unique.sql
git commit -m "$(cat <<'EOF'
feat(s4): services group class columns + slot-customer unique (FR-128)

services gains max_capacity (>=1), min_attendance (>=1, <=max), and
cancel_deadline_hours (>=1). Existing rows default to 1/1/24 = current
1-on-1 behavior. The bookings slot-unique index is replaced with a
slot+customer composite — one customer still can't double-book, but
multiple customers can share a slot (group class).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Migrations — `book_with_purchase` RPC + `auto_cancel_group_slot` RPC

**Files (Create):**
- `supabase/migrations/20260525200009_rpc_book_with_purchase.sql`
- `supabase/migrations/20260525200010_rpc_auto_cancel_group_slot.sql`

- [ ] **Step 1: `book_with_purchase` RPC**

`supabase/migrations/20260525200009_rpc_book_with_purchase.sql`:

```sql
-- book_with_purchase: replaces book_slot_atomic
--
-- Atomically:
--   1. Lock the slot row (FOR UPDATE) to serialize concurrent booking attempts
--   2. Verify slot is bookable (status='available' or 'pending' for groups)
--   3. Verify capacity not exceeded
--   4. Pick oldest-expiring active purchase for this (customer, service)
--   5. Increment classes_used on that purchase
--   6. Insert the booking with purchase_id
--   7. If post-insert count >= min_attendance: bulk confirm all bookings in slot
--   8. Return booking + auto_confirmed flag

create or replace function public.book_with_purchase(
  p_slot_id uuid,
  p_customer_id uuid,
  p_customer_notes text default null
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
  v_existing_count int;
  v_new_booking_id uuid;
  v_auto_confirmed boolean := false;
begin
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

  -- 4. Pick oldest-expiring active purchase (skip NULL expires_at first,
  --    they're permanent — use them after dated ones)
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

  -- 5. Ensure tenant_customers bridge
  insert into public.tenant_customers (tenant_id, customer_id)
    values (v_slot.tenant_id, p_customer_id)
    on conflict (tenant_id, customer_id) do nothing;

  -- 6. Increment classes_used
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

  -- 8. Update slot status: pending if first, stays pending for group
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

grant execute on function public.book_with_purchase(uuid, uuid, text) to authenticated;
```

- [ ] **Step 2: `auto_cancel_group_slot` RPC**

`supabase/migrations/20260525200010_rpc_auto_cancel_group_slot.sql`:

```sql
-- auto_cancel_group_slot: invoked by cron when a group slot fails to reach
-- min_attendance by the cancel deadline. Cancels slot, all bookings, refunds
-- classes_used on each purchase. Returns list of affected (customer_id, member_user_id)
-- so the cron can fan out push notifications.

create or replace function public.auto_cancel_group_slot(p_slot_id uuid)
returns table (
  affected_customer_id uuid,
  affected_member_user_id uuid,
  service_name text,
  slot_start_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot record;
  v_service_name text;
  v_member_user_id uuid;
begin
  -- Lock slot
  select id, tenant_id, service_id, member_id, start_at
    into v_slot
    from public.availability_slots
    where id = p_slot_id
    for update;
  if not found then
    raise exception 'SLOT_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- Look up service name + member user_id (for notify)
  select name into v_service_name from public.services where id = v_slot.service_id;
  select user_id into v_member_user_id from public.tenant_members where id = v_slot.member_id;

  -- Refund each non-cancelled booking's purchase
  update public.customer_purchases cp
    set classes_used = classes_used - 1
    from public.bookings b
    where b.slot_id = p_slot_id
      and b.status <> 'cancelled'
      and b.purchase_id = cp.id
      and cp.classes_used > 0;

  -- Cancel all non-cancelled bookings & return customer IDs for notify fan-out
  return query
    update public.bookings
      set status = 'cancelled', cancelled_at = now(), cancelled_by = null
      where slot_id = p_slot_id
        and status <> 'cancelled'
    returning customer_id, v_member_user_id, v_service_name, v_slot.start_at;

  -- Mark slot cancelled
  update public.availability_slots
    set status = 'cancelled', updated_at = now()
    where id = p_slot_id;
end;
$$;

grant execute on function public.auto_cancel_group_slot(uuid) to service_role;
-- service_role only; cron uses admin client. authenticated callers go through
-- cancel_booking (per-booking) instead.
```

- [ ] **Step 3: 推所有 migrations 到 Supabase（Tasks 2-6 累積 11 個檔案）**

Run: `npm run db:push`
Expected: 11 migrations applied successfully

**IMPORTANT**：若失敗，**不要** 嘗試手動修；report BLOCKED 含完整 error message + 哪個 migration 失敗。Recovery：DBA 進 Supabase Dashboard SQL Editor 手動處理。

- [ ] **Step 4: 重新產生 types**

Run: `npm run db:types`
Expected: `src/lib/supabase/types.ts` 內 `service_packages`、`customer_purchases`、`bookings.purchase_id`、`services.max_capacity`/`min_attendance`/`cancel_deadline_hours` 都出現

- [ ] **Step 5: typecheck**

Run: `npm run typecheck`
Expected: clean

- [ ] **Step 6: commit**

```bash
git add supabase/migrations/20260525200009_rpc_book_with_purchase.sql supabase/migrations/20260525200010_rpc_auto_cancel_group_slot.sql src/lib/supabase/types.ts
git commit -m "$(cat <<'EOF'
feat(s4): book_with_purchase + auto_cancel_group_slot RPCs + types

book_with_purchase: SELECT FOR UPDATE on slot + capacity check + pick
oldest-expiring purchase + insert booking + auto-confirm if min reached.
auto_cancel_group_slot: refund classes_used on all bookings then cancel
them + cancel slot; returns customer ids for cron notification fan-out.
Both fail-closed via raised exceptions. Types regenerated.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: `purchases-server.ts` helper

**Files:**
- Create: `src/lib/purchases-server.ts`

- [ ] **Step 1: 寫 helper**

`src/lib/purchases-server.ts`:

```ts
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { isActivePurchase, type CustomerPurchase } from './purchases'
import type { Database } from './supabase/types'

type Client = SupabaseClient<Database>

/**
 * Returns the count of active classes (sum of classes_total - classes_used
 * across all active purchases) for a (customer, service) pair.
 */
export async function getCustomerBalance(
  supabase: Client,
  customerId: string,
  serviceId: string,
): Promise<number> {
  const now = new Date()
  const { data, error } = await supabase
    .from('customer_purchases')
    .select('id, approval_status, classes_total, classes_used, expires_at')
    .eq('customer_id', customerId)
    .eq('service_id', serviceId)
    .eq('approval_status', 'confirmed')
  if (error) throw error
  let balance = 0
  for (const p of (data ?? []) as CustomerPurchase[]) {
    if (isActivePurchase(p, now)) {
      balance += p.classes_total - p.classes_used
    }
  }
  return balance
}

/**
 * Returns the oldest-expiring active purchase for booking attribution.
 * Returns null if no eligible purchase exists.
 */
export async function findActivePurchaseForBooking(
  supabase: Client,
  customerId: string,
  serviceId: string,
): Promise<CustomerPurchase | null> {
  const now = new Date()
  const { data, error } = await supabase
    .from('customer_purchases')
    .select('id, approval_status, classes_total, classes_used, expires_at')
    .eq('customer_id', customerId)
    .eq('service_id', serviceId)
    .eq('approval_status', 'confirmed')
    .order('expires_at', { ascending: true, nullsFirst: false })
  if (error) throw error
  for (const p of (data ?? []) as CustomerPurchase[]) {
    if (isActivePurchase(p, now)) return p
  }
  return null
}
```

- [ ] **Step 2: typecheck**

Run: `npm run typecheck`
Expected: clean

- [ ] **Step 3: commit**

```bash
git add src/lib/purchases-server.ts
git commit -m "$(cat <<'EOF'
feat(s4): purchases-server helper for balance lookup

Two helpers: getCustomerBalance returns sum of remaining classes for a
(customer, service); findActivePurchaseForBooking returns the oldest
non-expired purchase for booking attribution. Both surface Supabase
errors (no silent swallow). Used by SlotPicker balance check, /book
page, and Student-facing /[tenantSlug]/purchases page.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: 教練後台 `/packages` — CRUD + soft delete UI

**Files (Create):**
- `src/app/(tenant)/packages/page.tsx`
- `src/app/(tenant)/packages/loading.tsx`
- `src/app/(tenant)/packages/actions.ts`
- `src/app/(tenant)/packages/package-form-dialog.tsx`
- `src/app/(tenant)/packages/package-actions-row.tsx`

**Modify:**
- `src/app/(tenant)/sidebar-nav.tsx` — 加「套裝管理」連結

- [ ] **Step 1: actions.ts**

`src/app/(tenant)/packages/actions.ts`:

```ts
'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { actionClient } from '@/lib/safe-action'
import { requireTenantOwner } from '@/lib/auth/get-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AppError, NotFoundError } from '@/lib/errors'

const CreatePackageSchema = z.object({
  serviceId: z.string().uuid(),
  name: z.string().min(1).max(60),
  classCount: z.coerce.number().int().positive(),
  price: z.coerce.number().nonnegative(),
  expiresInDays: z.coerce.number().int().positive().nullable(),
})

export const createPackageAction = actionClient
  .inputSchema(CreatePackageSchema)
  .action(async ({ parsedInput }) => {
    const session = await requireTenantOwner()
    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase
      .from('service_packages')
      .insert({
        tenant_id: session.tenantId,
        service_id: parsedInput.serviceId,
        name: parsedInput.name,
        class_count: parsedInput.classCount,
        price: parsedInput.price,
        expires_in_days: parsedInput.expiresInDays,
      })
      .select('id')
      .single()
    if (error || !data) throw new AppError('PACKAGE_CREATE_FAILED', error?.message ?? '建立失敗')
    revalidatePath('/packages')
    return { id: data.id }
  })

const UpdatePackageSchema = CreatePackageSchema.extend({ id: z.string().uuid() })

export const updatePackageAction = actionClient
  .inputSchema(UpdatePackageSchema)
  .action(async ({ parsedInput }) => {
    const session = await requireTenantOwner()
    const supabase = await createSupabaseServerClient()
    const { data: existing } = await supabase
      .from('service_packages')
      .select('tenant_id')
      .eq('id', parsedInput.id)
      .maybeSingle()
    if (!existing || existing.tenant_id !== session.tenantId) throw new NotFoundError('套裝')

    const { error } = await supabase
      .from('service_packages')
      .update({
        name: parsedInput.name,
        class_count: parsedInput.classCount,
        price: parsedInput.price,
        expires_in_days: parsedInput.expiresInDays,
        service_id: parsedInput.serviceId,
      })
      .eq('id', parsedInput.id)
    if (error) throw new AppError('PACKAGE_UPDATE_FAILED', error.message)
    revalidatePath('/packages')
    return { ok: true }
  })

const IdSchema = z.object({ id: z.string().uuid() })

export const softDeletePackageAction = actionClient
  .inputSchema(IdSchema)
  .action(async ({ parsedInput }) => {
    await requireTenantOwner()
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase
      .from('service_packages')
      .update({ is_active: false })
      .eq('id', parsedInput.id)
    if (error) throw new AppError('PACKAGE_DELETE_FAILED', error.message)
    revalidatePath('/packages')
    return { ok: true }
  })

export const restorePackageAction = actionClient
  .inputSchema(IdSchema)
  .action(async ({ parsedInput }) => {
    await requireTenantOwner()
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase
      .from('service_packages')
      .update({ is_active: true })
      .eq('id', parsedInput.id)
    if (error) throw new AppError('PACKAGE_RESTORE_FAILED', error.message)
    revalidatePath('/packages')
    return { ok: true }
  })
```

- [ ] **Step 2: page.tsx**

`src/app/(tenant)/packages/page.tsx`:

```tsx
import Link from 'next/link'
import { Package } from 'lucide-react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { requireTenantMember } from '@/lib/auth/get-session'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import PackageFormDialog from './package-form-dialog'
import PackageActionsRow from './package-actions-row'

export default async function PackagesPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>
}) {
  const session = await requireTenantMember()
  const params = await searchParams
  const showArchived = params.archived === '1'
  const supabase = await createSupabaseServerClient()

  const { data: services } = await supabase
    .from('services')
    .select('id, name, duration_minutes')
    .eq('tenant_id', session.tenantId)
    .eq('is_active', true)
    .order('name')

  const { data: packages } = await supabase
    .from('service_packages')
    .select('id, service_id, name, class_count, price, expires_in_days, is_active, services(name)')
    .eq('tenant_id', session.tenantId)
    .eq('is_active', !showArchived)
    .order('created_at', { ascending: false })

  const canEdit = session.role === 'tenant_owner'

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl tracking-tight">
            <span className="italic">套裝管理</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            為每個服務定義可購買的方案（單堂、N 堂套裝等）
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={showArchived ? '/packages' : '/packages?archived=1'}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            {showArchived ? '看使用中' : '看已刪除'}
          </Link>
          <Link href="/packages/pending" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            審核佇列
          </Link>
          {canEdit && !showArchived && (services?.length ?? 0) > 0 && (
            <PackageFormDialog mode="create" services={services ?? []} />
          )}
        </div>
      </header>

      {!packages || packages.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Package className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 font-medium text-slate-700">
              {showArchived ? '無已刪除的套裝' : '尚無套裝'}
            </p>
            {!showArchived && (
              <p className="mt-1 text-sm text-muted-foreground">
                {(services?.length ?? 0) === 0 ? '請先建立服務' : '為服務建立套裝以開放販售'}
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {packages.map((p) => {
            const svc = p.services as { name: string } | null
            return (
              <Card key={p.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-xl italic">{p.name}</h3>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                        {svc?.name ?? '—'}
                      </span>
                      {!p.is_active && (
                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] text-slate-700">
                          已刪除
                        </span>
                      )}
                    </div>
                    <div className="mt-2 grid gap-x-4 gap-y-1 text-sm text-foreground/80 sm:grid-cols-3">
                      <div>
                        <span className="text-muted-foreground">堂數：</span>
                        {p.class_count}
                      </div>
                      <div>
                        <span className="text-muted-foreground">價格：</span>$
                        {Number(p.price).toLocaleString()}
                      </div>
                      <div>
                        <span className="text-muted-foreground">有效期：</span>
                        {p.expires_in_days ? `${p.expires_in_days} 天` : '永久'}
                      </div>
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-2">
                      {p.is_active && (
                        <PackageFormDialog
                          mode="edit"
                          services={services ?? []}
                          pkg={{
                            id: p.id,
                            service_id: p.service_id,
                            name: p.name,
                            class_count: p.class_count,
                            price: Number(p.price),
                            expires_in_days: p.expires_in_days,
                          }}
                        />
                      )}
                      <PackageActionsRow id={p.id} isActive={p.is_active} />
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: loading.tsx**

`src/app/(tenant)/packages/loading.tsx`:

```tsx
import PageSkeleton from '@/components/ui/page-skeleton'
export default function Loading() {
  return <PageSkeleton rows={4} />
}
```

- [ ] **Step 4: package-form-dialog.tsx**

`src/app/(tenant)/packages/package-form-dialog.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Plus, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { createPackageAction, updatePackageAction } from './actions'

type Service = { id: string; name: string; duration_minutes: number }
type Package = {
  id: string
  service_id: string
  name: string
  class_count: number
  price: number
  expires_in_days: number | null
}

type Props =
  | { mode: 'create'; services: Service[]; pkg?: undefined }
  | { mode: 'edit'; services: Service[]; pkg: Package }

export default function PackageFormDialog(props: Props) {
  const isEdit = props.mode === 'edit'
  const [open, setOpen] = useState(false)
  const [serviceId, setServiceId] = useState(props.pkg?.service_id ?? props.services[0]?.id ?? '')
  const [name, setName] = useState(props.pkg?.name ?? '')
  const [classCount, setClassCount] = useState(String(props.pkg?.class_count ?? 10))
  const [price, setPrice] = useState(String(props.pkg?.price ?? ''))
  const [permanent, setPermanent] = useState(props.pkg?.expires_in_days === null)
  const [expiresInDays, setExpiresInDays] = useState(
    props.pkg?.expires_in_days != null ? String(props.pkg.expires_in_days) : '180',
  )

  const onSuccess = () => {
    toast.success(isEdit ? '已更新' : '已新增')
    setOpen(false)
  }
  const onError = ({ error }: { error: { serverError?: { message?: string } } }) =>
    toast.error(error.serverError?.message ?? '失敗')

  const create = useAction(createPackageAction, { onSuccess, onError })
  const update = useAction(updatePackageAction, { onSuccess, onError })

  function submit() {
    const payload = {
      serviceId,
      name,
      classCount,
      price,
      expiresInDays: permanent ? null : expiresInDays,
    }
    if (isEdit) update.execute({ ...payload, id: props.pkg.id })
    else create.execute(payload)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          isEdit ? (
            <Button variant="outline" size="sm">
              <Pencil className="mr-1 h-3.5 w-3.5" />
              編輯
            </Button>
          ) : (
            <Button>
              <Plus className="mr-1 h-3.5 w-3.5" />
              新增套裝
            </Button>
          )
        }
      />
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? '編輯套裝' : '新增套裝'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pkg-service">服務</Label>
            <select
              id="pkg-service"
              className="w-full rounded border p-2 text-sm"
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
            >
              {props.services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.duration_minutes} 分)
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pkg-name">名稱</Label>
            <Input
              id="pkg-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="單堂 / 10 堂套裝"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="pkg-count">堂數</Label>
              <Input
                id="pkg-count"
                type="number"
                min={1}
                value={classCount}
                onChange={(e) => setClassCount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pkg-price">售價</Label>
              <Input
                id="pkg-price"
                type="number"
                min={0}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>有效期</Label>
            <div className="flex items-center gap-3 text-sm">
              <label className="inline-flex items-center gap-1.5">
                <input
                  type="radio"
                  checked={!permanent}
                  onChange={() => setPermanent(false)}
                />
                <span>限期</span>
              </label>
              {!permanent && (
                <Input
                  type="number"
                  min={1}
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(e.target.value)}
                  className="w-24"
                />
              )}
              {!permanent && <span className="text-xs text-muted-foreground">天</span>}
              <label className="ml-2 inline-flex items-center gap-1.5">
                <input
                  type="radio"
                  checked={permanent}
                  onChange={() => setPermanent(true)}
                />
                <span>永久</span>
              </label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button onClick={submit} disabled={create.isPending || update.isPending || !name.trim()}>
            {create.isPending || update.isPending ? '處理中...' : isEdit ? '儲存' : '建立'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 5: package-actions-row.tsx**

`src/app/(tenant)/packages/package-actions-row.tsx`:

```tsx
'use client'

import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Trash2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import ConfirmDialog from '@/components/confirm-dialog'
import { softDeletePackageAction, restorePackageAction } from './actions'

export default function PackageActionsRow({
  id,
  isActive,
}: {
  id: string
  isActive: boolean
}) {
  const del = useAction(softDeletePackageAction, {
    onSuccess: () => toast.success('已刪除'),
    onError: ({ error }) => toast.error(error.serverError?.message ?? '刪除失敗'),
  })
  const restore = useAction(restorePackageAction, {
    onSuccess: () => toast.success('已重新啟用'),
    onError: ({ error }) => toast.error(error.serverError?.message ?? '失敗'),
  })

  if (!isActive) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => restore.execute({ id })}
        disabled={restore.isPending}
      >
        <RotateCcw className="mr-1 h-3.5 w-3.5" />
        重新啟用
      </Button>
    )
  }

  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline" size="sm">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      }
      title="刪除此套裝？"
      description="刪除後學員端不再顯示此套裝。既有 confirmed 購買記錄不受影響、學員仍可繼續使用餘額。可從『已刪除』分頁重新啟用。"
      confirmLabel="刪除"
      variant="destructive"
      onConfirm={() => del.execute({ id })}
    />
  )
}
```

- [ ] **Step 6: sidebar-nav.tsx 加連結**

Modify `src/app/(tenant)/sidebar-nav.tsx`:

Add `Package` icon import (already imported in services context — but here we need lucide `Package` — check if it's in the import line; if not add).

Add new item after `/services` and before `/staff`:

```tsx
{ href: '/packages', label: '套裝管理', icon: Package },
```

(Match the existing pattern; `Package` icon already used by services page.)

- [ ] **Step 7: typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: build success; `/packages` in route table

- [ ] **Step 8: commit**

```bash
git add src/app/(tenant)/packages/ src/app/(tenant)/sidebar-nav.tsx
git commit -m "$(cat <<'EOF'
feat(s4): packages CRUD + UI for tenant owners (FR-125)

/packages lists service_packages with active / archived tabs; create
+ edit dialog supports class_count, price, and expires_in_days
(permanent = null). Soft delete via is_active=false with restore
affordance. Sidebar gets 「套裝管理」 link.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Pending purchase review queue

**Files (Create):**
- `src/app/(tenant)/packages/pending/page.tsx`
- `src/app/(tenant)/packages/pending/loading.tsx`
- `src/app/(tenant)/packages/pending/purchase-actions.ts`
- `src/app/(tenant)/packages/pending/purchase-row.tsx`

**Modify:**
- `src/lib/notify-booking.ts` — add purchase_approved / purchase_rejected types

- [ ] **Step 1: purchase-actions.ts**

`src/app/(tenant)/packages/pending/purchase-actions.ts`:

```ts
'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { actionClient } from '@/lib/safe-action'
import { requireTenantMember } from '@/lib/auth/get-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AppError, NotFoundError } from '@/lib/errors'
import { notifyPurchaseDecision } from '@/lib/notify-booking'

const ApproveSchema = z.object({ id: z.string().uuid() })

export const approvePurchaseAction = actionClient
  .inputSchema(ApproveSchema)
  .action(async ({ parsedInput }) => {
    const session = await requireTenantMember()
    const supabase = await createSupabaseServerClient()

    const { data: purchase } = await supabase
      .from('customer_purchases')
      .select(
        'id, tenant_id, customer_id, service_id, package_id, classes_total, approval_status, service_packages(expires_in_days)',
      )
      .eq('id', parsedInput.id)
      .maybeSingle()
    if (!purchase) throw new NotFoundError('購買記錄')
    if (purchase.tenant_id !== session.tenantId) throw new NotFoundError('購買記錄')
    if (purchase.approval_status !== 'pending_review')
      throw new AppError('INVALID_STATE', '只能審核待審核狀態的購買')

    const now = new Date()
    const pkg = purchase.service_packages as { expires_in_days: number | null } | null
    const expiresAt =
      pkg?.expires_in_days != null
        ? new Date(now.getTime() + pkg.expires_in_days * 24 * 3600 * 1000).toISOString()
        : null

    const { error } = await supabase
      .from('customer_purchases')
      .update({
        approval_status: 'confirmed',
        approved_at: now.toISOString(),
        approved_by: session.userId,
        expires_at: expiresAt,
      })
      .eq('id', parsedInput.id)
    if (error) throw new AppError('APPROVE_FAILED', error.message)

    void notifyPurchaseDecision(parsedInput.id, 'approved', session.userId)
    revalidatePath('/packages/pending')
    return { ok: true }
  })

const RejectSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().min(1).max(200),
})

export const rejectPurchaseAction = actionClient
  .inputSchema(RejectSchema)
  .action(async ({ parsedInput }) => {
    const session = await requireTenantMember()
    const supabase = await createSupabaseServerClient()

    const { data: purchase } = await supabase
      .from('customer_purchases')
      .select('tenant_id, approval_status')
      .eq('id', parsedInput.id)
      .maybeSingle()
    if (!purchase || purchase.tenant_id !== session.tenantId) throw new NotFoundError('購買記錄')
    if (purchase.approval_status !== 'pending_review')
      throw new AppError('INVALID_STATE', '只能審核待審核狀態的購買')

    const { error } = await supabase
      .from('customer_purchases')
      .update({
        approval_status: 'rejected',
        approved_at: new Date().toISOString(),
        approved_by: session.userId,
        rejected_reason: parsedInput.reason,
      })
      .eq('id', parsedInput.id)
    if (error) throw new AppError('REJECT_FAILED', error.message)

    void notifyPurchaseDecision(parsedInput.id, 'rejected', session.userId)
    revalidatePath('/packages/pending')
    return { ok: true }
  })
```

- [ ] **Step 2: notify-booking.ts 加 purchase_decision**

In `src/lib/notify-booking.ts`, append a new exported function `notifyPurchaseDecision`:

```ts
export async function notifyPurchaseDecision(
  purchaseId: string,
  decision: 'approved' | 'rejected',
  triggeredByUserId: string,
): Promise<void> {
  try {
    const admin = createSupabaseAdminClient()
    const { data: p } = await admin
      .from('customer_purchases')
      .select(
        'id, customer_id, classes_total, rejected_reason, services(name), service_packages(name), tenants(name)',
      )
      .eq('id', purchaseId)
      .maybeSingle()
    if (!p) return

    const svc = p.services as { name: string } | null
    const pkg = p.service_packages as { name: string } | null
    const tenant = p.tenants as { name: string } | null
    const title = decision === 'approved' ? '套裝已確認' : '套裝申請被拒絕'
    const body =
      decision === 'approved'
        ? `${tenant?.name ?? ''} 確認您的 ${pkg?.name ?? svc?.name ?? '套裝'}（${p.classes_total} 堂），可開始預約`
        : `${tenant?.name ?? '教練'} 拒絕了您的套裝申請：${p.rejected_reason ?? ''}`

    await pushToUser(admin, {
      userId: p.customer_id,
      type: 'booking_status',
      payload: {
        title,
        body,
        url: decision === 'approved' ? '/my-bookings' : '/[tenantSlug]/purchases',
        tag: `purchase-${purchaseId}`,
      },
      relatedId: purchaseId,
    })
  } catch (err) {
    console.error('[notify-purchase]', err)
  }
}
```

(Confirm `createSupabaseAdminClient` and `pushToUser` are already imported.)

- [ ] **Step 3: page.tsx**

`src/app/(tenant)/packages/pending/page.tsx`:

```tsx
import Link from 'next/link'
import { format } from 'date-fns'
import { ArrowLeft, ClipboardCheck } from 'lucide-react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { requireTenantMember } from '@/lib/auth/get-session'
import { Card, CardContent } from '@/components/ui/card'
import PurchaseRow from './purchase-row'

export default async function PendingPurchasesPage() {
  const session = await requireTenantMember()
  const supabase = await createSupabaseServerClient()

  const { data: purchases } = await supabase
    .from('customer_purchases')
    .select(
      'id, customer_id, classes_total, payment_self_reported, created_at, services(name), service_packages(name), customers(display_name)',
    )
    .eq('tenant_id', session.tenantId)
    .eq('approval_status', 'pending_review')
    .order('created_at', { ascending: true })

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/packages"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          回套裝管理
        </Link>
        <h1 className="font-display text-3xl tracking-tight">
          <span className="italic">套裝審核佇列</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          學員提交的購買申請，確認收款後點「確認」開放餘額
        </p>
      </div>

      {!purchases || purchases.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <ClipboardCheck className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 font-medium text-slate-700">無待審核項目</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {purchases.map((p) => {
            const customer = p.customers as { display_name: string | null } | null
            const svc = p.services as { name: string } | null
            const pkg = p.service_packages as { name: string } | null
            return (
              <PurchaseRow
                key={p.id}
                purchase={{
                  id: p.id,
                  customerName: customer?.display_name ?? '匿名',
                  serviceName: svc?.name ?? '—',
                  packageName: pkg?.name ?? `${p.classes_total} 堂課`,
                  classesTotal: p.classes_total,
                  paymentSelfReported: p.payment_self_reported,
                  createdAt: format(new Date(p.created_at), 'yyyy/MM/dd HH:mm'),
                }}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: loading.tsx**

`src/app/(tenant)/packages/pending/loading.tsx`:

```tsx
import PageSkeleton from '@/components/ui/page-skeleton'
export default function Loading() {
  return <PageSkeleton rows={3} />
}
```

- [ ] **Step 5: purchase-row.tsx**

`src/app/(tenant)/packages/pending/purchase-row.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { approvePurchaseAction, rejectPurchaseAction } from './purchase-actions'

type Props = {
  purchase: {
    id: string
    customerName: string
    serviceName: string
    packageName: string
    classesTotal: number
    paymentSelfReported: 'claimed_paid' | 'awaiting_payment'
    createdAt: string
  }
}

export default function PurchaseRow({ purchase }: Props) {
  const [rejectOpen, setRejectOpen] = useState(false)
  const [reason, setReason] = useState('')

  const approve = useAction(approvePurchaseAction, {
    onSuccess: () => toast.success('已確認'),
    onError: ({ error }) => toast.error(error.serverError?.message ?? '失敗'),
  })
  const reject = useAction(rejectPurchaseAction, {
    onSuccess: () => {
      toast.success('已拒絕')
      setRejectOpen(false)
    },
    onError: ({ error }) => toast.error(error.serverError?.message ?? '失敗'),
  })

  const paidLabel =
    purchase.paymentSelfReported === 'claimed_paid' ? '學員自報：已付款' : '學員自報：未付款'
  const paidColor =
    purchase.paymentSelfReported === 'claimed_paid'
      ? 'bg-emerald-100 text-emerald-800'
      : 'bg-amber-100 text-amber-800'

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-xl italic">{purchase.customerName}</h3>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${paidColor}`}>
              {paidLabel}
            </span>
          </div>
          <div className="mt-1.5 text-sm">
            <span className="text-muted-foreground">想買：</span>
            {purchase.serviceName} · {purchase.packageName}（{purchase.classesTotal} 堂）
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">申請於 {purchase.createdAt}</div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => approve.execute({ id: purchase.id })}
            disabled={approve.isPending}
          >
            {approve.isPending ? '處理中...' : '確認'}
          </Button>
          <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
            <DialogTrigger render={<Button variant="outline">拒絕</Button>} />
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>拒絕購買申請</DialogTitle>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="rej-reason">原因（必填）</Label>
                <Input
                  id="rej-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="尚未收到款項 / 學員已取消 ..."
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setRejectOpen(false)}>
                  取消
                </Button>
                <Button
                  onClick={() => reject.execute({ id: purchase.id, reason })}
                  disabled={reject.isPending || !reason.trim()}
                  variant="destructive"
                >
                  確定拒絕
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 6: sidebar 加 pending 連結（如果 badge 機制要做的話，省略；本輪先不加 badge）**

Skip — `/packages/pending` 從 `/packages` 頁的「審核佇列」按鈕進入即可。

- [ ] **Step 7: typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: clean

- [ ] **Step 8: commit**

```bash
git add src/app/(tenant)/packages/pending/ src/lib/notify-booking.ts
git commit -m "$(cat <<'EOF'
feat(s4): pending purchase review queue + decision notifications (FR-126)

/packages/pending lists customer_purchases with approval_status =
pending_review; coach approves (sets expires_at from package's
expires_in_days * 24h offset from now) or rejects with required
reason. Push notification fires on both decisions via
notifyPurchaseDecision.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Student-facing `/[tenantSlug]/packages` + `/purchases` pages

**Files (Create):**
- `src/app/[tenantSlug]/packages/page.tsx`
- `src/app/[tenantSlug]/packages/loading.tsx`
- `src/app/[tenantSlug]/packages/purchase-request-form.tsx`
- `src/app/[tenantSlug]/packages/purchase-request-action.ts`
- `src/app/[tenantSlug]/purchases/page.tsx`
- `src/app/[tenantSlug]/purchases/loading.tsx`

- [ ] **Step 1: purchase-request-action.ts**

`src/app/[tenantSlug]/packages/purchase-request-action.ts`:

```ts
'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { actionClient } from '@/lib/safe-action'
import { requireSession } from '@/lib/auth/get-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AppError, NotFoundError } from '@/lib/errors'

const RequestSchema = z.object({
  packageId: z.string().uuid(),
  paymentSelfReported: z.enum(['claimed_paid', 'awaiting_payment']),
})

export const requestPurchaseAction = actionClient
  .inputSchema(RequestSchema)
  .action(async ({ parsedInput }) => {
    const session = await requireSession()
    const supabase = await createSupabaseServerClient()

    const { data: pkg } = await supabase
      .from('service_packages')
      .select('id, tenant_id, service_id, class_count, is_active')
      .eq('id', parsedInput.packageId)
      .maybeSingle()
    if (!pkg || !pkg.is_active) throw new NotFoundError('套裝')

    // Ensure tenant_customers bridge
    await supabase
      .from('tenant_customers')
      .upsert(
        { tenant_id: pkg.tenant_id, customer_id: session.userId },
        { onConflict: 'tenant_id,customer_id' },
      )

    const { error } = await supabase.from('customer_purchases').insert({
      tenant_id: pkg.tenant_id,
      customer_id: session.userId,
      service_id: pkg.service_id,
      package_id: pkg.id,
      classes_total: pkg.class_count,
      classes_used: 0,
      payment_self_reported: parsedInput.paymentSelfReported,
      approval_status: 'pending_review',
    })
    if (error) throw new AppError('REQUEST_FAILED', error.message)

    revalidatePath('/[tenantSlug]/packages', 'layout')
    return { ok: true }
  })
```

- [ ] **Step 2: page.tsx**

`src/app/[tenantSlug]/packages/page.tsx`:

```tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Package } from 'lucide-react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getTenantBySlug } from '@/lib/auth/get-tenant-context'
import { Card, CardContent } from '@/components/ui/card'
import PurchaseRequestForm from './purchase-request-form'

export default async function PublicPackagesPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>
}) {
  const { tenantSlug } = await params
  const tenant = await getTenantBySlug(tenantSlug)
  if (!tenant) notFound()

  const supabase = await createSupabaseServerClient()

  const { data: services } = await supabase
    .from('services')
    .select('id, name, description, duration_minutes')
    .eq('tenant_id', tenant.id)
    .eq('is_active', true)
    .order('name')

  const serviceIds = (services ?? []).map((s) => s.id)
  const { data: packages } =
    serviceIds.length === 0
      ? { data: [] }
      : await supabase
          .from('service_packages')
          .select('id, service_id, name, class_count, price, expires_in_days')
          .in('service_id', serviceIds)
          .eq('is_active', true)
          .order('class_count', { ascending: true })

  const pkgsByService: Record<
    string,
    Array<{
      id: string
      name: string
      class_count: number
      price: number
      expires_in_days: number | null
    }>
  > = {}
  for (const p of packages ?? []) {
    pkgsByService[p.service_id] = pkgsByService[p.service_id] ?? []
    pkgsByService[p.service_id]!.push({
      id: p.id,
      name: p.name,
      class_count: p.class_count,
      price: Number(p.price),
      expires_in_days: p.expires_in_days,
    })
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <Link
          href={`/${tenantSlug}`}
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          回 {tenant.name}
        </Link>
        <h1 className="font-display text-3xl tracking-tight">
          <span className="italic">{tenant.name} 的方案</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">選擇方案、自報付款狀態後送出申請。教練確認後即可開始預約。</p>
      </div>

      {(services ?? []).map((svc) => {
        const list = pkgsByService[svc.id] ?? []
        if (list.length === 0) return null
        return (
          <section key={svc.id}>
            <h2 className="mb-2 font-display text-xl">{svc.name}</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {list.map((p) => (
                <Card key={p.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold">{p.name}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {p.class_count} 堂 · {p.expires_in_days ? `${p.expires_in_days} 天內上完` : '永久有效'}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="font-display text-xl italic">${p.price.toLocaleString()}</div>
                      </div>
                    </div>
                    <div className="mt-3">
                      <PurchaseRequestForm packageId={p.id} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )
      })}

      {(services ?? []).every((s) => (pkgsByService[s.id] ?? []).length === 0) && (
        <Card>
          <CardContent className="p-12 text-center">
            <Package className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 font-medium text-slate-700">此教練尚未開放套裝</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
```

- [ ] **Step 3: loading.tsx**

`src/app/[tenantSlug]/packages/loading.tsx`:

```tsx
import PageSkeleton from '@/components/ui/page-skeleton'
export default function Loading() {
  return <PageSkeleton rows={4} />
}
```

- [ ] **Step 4: purchase-request-form.tsx**

`src/app/[tenantSlug]/packages/purchase-request-form.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { requestPurchaseAction } from './purchase-request-action'

export default function PurchaseRequestForm({ packageId }: { packageId: string }) {
  const [open, setOpen] = useState(false)
  const [paid, setPaid] = useState<'claimed_paid' | 'awaiting_payment'>('claimed_paid')

  const { execute, isPending } = useAction(requestPurchaseAction, {
    onSuccess: () => {
      toast.success('申請已送出，請等教練確認')
      setOpen(false)
    },
    onError: ({ error }) => toast.error(error.serverError?.message ?? '送出失敗'),
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="w-full">申請購買</Button>} />
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>確認購買申請</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            送出後教練會在審核佇列看到此申請。請選擇您的付款狀態：
          </p>
          <div className="space-y-2">
            <label className="flex items-center gap-2 rounded border p-2 text-sm">
              <input
                type="radio"
                checked={paid === 'claimed_paid'}
                onChange={() => setPaid('claimed_paid')}
              />
              <span>已付款（現金 / 轉帳已完成）</span>
            </label>
            <label className="flex items-center gap-2 rounded border p-2 text-sm">
              <input
                type="radio"
                checked={paid === 'awaiting_payment'}
                onChange={() => setPaid('awaiting_payment')}
              />
              <span>未付款（會在後續支付）</span>
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button
            onClick={() => execute({ packageId, paymentSelfReported: paid })}
            disabled={isPending}
          >
            {isPending ? '送出中...' : '送出申請'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 5: /purchases page (學員看自己餘額)**

`src/app/[tenantSlug]/purchases/page.tsx`:

```tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { format } from 'date-fns'
import { ArrowLeft, Wallet } from 'lucide-react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { requireSession } from '@/lib/auth/get-session'
import { getTenantBySlug } from '@/lib/auth/get-tenant-context'
import { Card, CardContent } from '@/components/ui/card'

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending_review: { label: '待教練確認', color: 'bg-amber-100 text-amber-800' },
  confirmed: { label: '已生效', color: 'bg-emerald-100 text-emerald-800' },
  rejected: { label: '已拒絕', color: 'bg-slate-200 text-slate-700' },
}

export default async function MyPurchasesPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>
}) {
  const session = await requireSession()
  const { tenantSlug } = await params
  const tenant = await getTenantBySlug(tenantSlug)
  if (!tenant) notFound()

  const supabase = await createSupabaseServerClient()
  const { data: purchases } = await supabase
    .from('customer_purchases')
    .select(
      'id, classes_total, classes_used, expires_at, approval_status, rejected_reason, created_at, services(name), service_packages(name)',
    )
    .eq('customer_id', session.userId)
    .eq('tenant_id', tenant.id)
    .order('created_at', { ascending: false })

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <Link
          href={`/${tenantSlug}`}
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          回 {tenant.name}
        </Link>
        <h1 className="font-display text-3xl tracking-tight">
          <span className="italic">我的方案</span>
        </h1>
      </div>

      {!purchases || purchases.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Wallet className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 font-medium text-slate-700">尚無購買記錄</p>
            <Link
              href={`/${tenantSlug}/packages`}
              className="mt-3 inline-block text-sm text-blue-600 hover:underline"
            >
              瀏覽可購方案 →
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {purchases.map((p) => {
            const svc = p.services as { name: string } | null
            const pkg = p.service_packages as { name: string } | null
            const status = STATUS_LABEL[p.approval_status] ?? STATUS_LABEL.pending_review!
            const remaining = p.classes_total - p.classes_used
            return (
              <Card key={p.id}>
                <CardContent className="p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-display text-lg italic">
                        {pkg?.name ?? `${p.classes_total} 堂課`}
                      </h3>
                      <p className="text-xs text-muted-foreground">{svc?.name ?? '—'}</p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${status.color}`}
                    >
                      {status.label}
                    </span>
                  </div>
                  {p.approval_status === 'confirmed' && (
                    <div className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
                      <div>
                        <span className="text-muted-foreground">餘額：</span>
                        <span className="font-medium">
                          {remaining} / {p.classes_total} 堂
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">到期：</span>
                        {p.expires_at ? format(new Date(p.expires_at), 'yyyy/MM/dd') : '永久'}
                      </div>
                    </div>
                  )}
                  {p.approval_status === 'rejected' && p.rejected_reason && (
                    <div className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                      拒絕原因：{p.rejected_reason}
                    </div>
                  )}
                  <div className="mt-3 text-[10px] text-muted-foreground">
                    申請於 {format(new Date(p.created_at), 'yyyy/MM/dd HH:mm')}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 6: /purchases loading**

`src/app/[tenantSlug]/purchases/loading.tsx`:

```tsx
import PageSkeleton from '@/components/ui/page-skeleton'
export default function Loading() {
  return <PageSkeleton rows={4} />
}
```

- [ ] **Step 7: typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: clean; `/[tenantSlug]/packages` and `/[tenantSlug]/purchases` in route table

- [ ] **Step 8: commit**

```bash
git add src/app/[tenantSlug]/packages/ src/app/[tenantSlug]/purchases/
git commit -m "$(cat <<'EOF'
feat(s4): student-facing packages browsing + purchases ledger (FR-126)

/[tenantSlug]/packages lists all is_active=true service_packages
grouped by service; student picks one, self-reports payment status,
submits a pending_review request. /[tenantSlug]/purchases shows the
student's own purchases (pending / confirmed / rejected) with current
balance and rejection reason if applicable.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: createBookingAction switch to `book_with_purchase` + `/book` balance check

**Files (Modify):**
- `src/app/book/[slotId]/actions.ts`
- `src/app/book/[slotId]/page.tsx`

- [ ] **Step 1: 改 createBookingAction**

In `src/app/book/[slotId]/actions.ts`, find the existing `book_slot_atomic` RPC call in `createBookingAction` (the non-reschedule path) and replace with `book_with_purchase`.

Replace this section:

```ts
const { data, error } = await supabase.rpc('book_slot_atomic', {
  p_slot_id: parsedInput.slotId,
  p_customer_id: session.userId,
  p_customer_notes: parsedInput.customerNotes ?? undefined,
})
if (error) {
  if (error.message?.includes('SLOT_UNAVAILABLE')) throw new SlotUnavailableError()
  if (error.message?.includes('SLOT_NOT_FOUND'))
    throw new AppError('SLOT_NOT_FOUND', '時段不存在')
  if (error.message?.includes('CUSTOMER_BLOCKED'))
    throw new AppError('CUSTOMER_BLOCKED', '此教練已封鎖您的預約')
  throw new AppError('BOOKING_FAILED', error.message)
}
const booking = data as { id: string }
```

With:

```ts
const { data, error } = await supabase.rpc('book_with_purchase', {
  p_slot_id: parsedInput.slotId,
  p_customer_id: session.userId,
  p_customer_notes: parsedInput.customerNotes ?? undefined,
})
if (error) {
  if (error.message?.includes('SLOT_UNAVAILABLE')) throw new SlotUnavailableError()
  if (error.message?.includes('SLOT_NOT_FOUND'))
    throw new AppError('SLOT_NOT_FOUND', '時段不存在')
  if (error.message?.includes('SLOT_FULL'))
    throw new AppError('SLOT_FULL', '此時段名額已滿')
  if (error.message?.includes('SLOT_PAST'))
    throw new AppError('SLOT_PAST', '此時段已過')
  if (error.message?.includes('NO_BALANCE'))
    throw new AppError('NO_BALANCE', '需先購買套裝才能預約')
  if (error.message?.includes('CUSTOMER_BLOCKED'))
    throw new AppError('CUSTOMER_BLOCKED', '此教練已封鎖您的預約')
  throw new AppError('BOOKING_FAILED', error.message)
}
const result = (data as Array<{ booking_id: string; auto_confirmed: boolean }>)[0]
if (!result) throw new AppError('BOOKING_FAILED', 'unexpected empty result')
const booking = { id: result.booking_id }
```

Note: `book_with_purchase` returns a table (array), so destructure first row.

The reschedule path (`reschedule_booking` RPC) stays untouched for now — reschedule keeps using the existing purchase association (no new purchase consumed).

`notifyBookingChange` 等其他下游邏輯 (revalidatePath, redirect) 不變。

- [ ] **Step 2: 改 /book page 顯示 balance + packages CTA when no balance**

In `src/app/book/[slotId]/page.tsx`, the existing page fetches slot details. Add a server-side balance check:

Add near the top:

```ts
import { findActivePurchaseForBooking } from '@/lib/purchases-server'
```

After loading `slot` and verifying it's bookable, before rendering the booking form:

```ts
const activePurchase = await findActivePurchaseForBooking(supabase, session.userId, slot.service_id)

if (!activePurchase) {
  const { data: packages } = await supabase
    .from('service_packages')
    .select('id, name, class_count, price, expires_in_days')
    .eq('service_id', slot.service_id)
    .eq('is_active', true)
    .order('class_count', { ascending: true })

  return (
    <main className="mx-auto max-w-2xl p-6">
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-6">
        <h2 className="font-display text-2xl italic text-amber-900">需先購買套裝</h2>
        <p className="mt-2 text-sm text-amber-800">
          您尚未持有 {(slot.services as { name: string } | null)?.name ?? '此服務'} 的有效課數。
          請先選擇方案、送出申請、待教練確認後即可預約。
        </p>
        {packages && packages.length > 0 ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {packages.map((p) => (
              <div key={p.id} className="rounded border bg-white p-3 text-sm">
                <div className="font-semibold">{p.name}</div>
                <div className="text-xs text-muted-foreground">
                  {p.class_count} 堂 · ${Number(p.price).toLocaleString()} ·{' '}
                  {p.expires_in_days ? `${p.expires_in_days} 天內` : '永久'}
                </div>
              </div>
            ))}
          </div>
        ) : null}
        <Link
          href={`/${(slot.tenants as { slug: string } | null)?.slug ?? ''}/packages`}
          className="mt-4 inline-block rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
        >
          前往購買 →
        </Link>
      </div>
    </main>
  )
}
```

(You'll need to import `Link` from `next/link` at the top if not already imported; and make sure the existing slot query includes `tenants(slug)` — if not, add it.)

For balance display in the booking form (optional polish, can be added later): include a small "您將消耗 1/N 堂課" hint next to the submit button. Show `activePurchase.classes_total - activePurchase.classes_used` as remaining.

- [ ] **Step 3: typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: clean

- [ ] **Step 4: commit**

```bash
git add src/app/book/[slotId]/actions.ts src/app/book/[slotId]/page.tsx
git commit -m "$(cat <<'EOF'
feat(s4): /book uses book_with_purchase RPC + balance gate (FR-127)

createBookingAction now routes through book_with_purchase, which
atomically picks the oldest-expiring active purchase, increments
classes_used, inserts the booking, and auto-confirms the slot if
post-insert count >= min_attendance. /book/[slotId] page now does a
pre-flight balance check — if the student has no active purchase for
the service, render an amber "needs to purchase" panel with package
list + CTA to /[tenantSlug]/packages.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Service form gains group class fields + soft delete UX

**Files (Modify):**
- `src/app/(tenant)/services/actions.ts`
- `src/app/(tenant)/services/service-form-dialog.tsx`
- `src/app/(tenant)/services/page.tsx`

- [ ] **Step 1: actions.ts — schema 加 group class 欄位 + 改 deactivate 為 softDelete + restore**

Modify `src/app/(tenant)/services/actions.ts`:

Extend `CreateServiceSchema`:

```ts
const CreateServiceSchema = z.object({
  name: z.string().min(1, '請輸入名稱').max(60),
  description: z.string().max(500).optional().nullable(),
  durationMinutes: z.coerce.number().int().positive().max(600),
  price: PriceSchema,
  maxCapacity: z.coerce.number().int().positive().default(1),
  minAttendance: z.coerce.number().int().positive().default(1),
  cancelDeadlineHours: z.coerce.number().int().min(1).default(24),
})
```

Add cross-field refinement:

```ts
const CreateServiceSchemaRefined = CreateServiceSchema.refine(
  (v) => v.minAttendance <= v.maxCapacity,
  { message: '最少人數不能大於最大人數', path: ['minAttendance'] },
)
```

Update `createServiceAction` to:
1. Use the refined schema
2. Include new fields in insert

```ts
.insert({
  tenant_id: session.tenantId,
  name: parsedInput.name,
  description: parsedInput.description ?? null,
  duration_minutes: parsedInput.durationMinutes,
  price: parsedInput.price,
  is_active: true,
  max_capacity: parsedInput.maxCapacity,
  min_attendance: parsedInput.minAttendance,
  cancel_deadline_hours: parsedInput.cancelDeadlineHours,
})
```

Same for `updateServiceAction`. (Use `CreateServiceSchema.extend({ id: ..., isActive: ... }).refine(...)` for the update path.)

Rename `deactivateServiceAction` → `softDeleteServiceAction` (same body, same RPC) and add a new `restoreServiceAction`:

```ts
export const restoreServiceAction = actionClient
  .inputSchema(DeactivateSchema)
  .action(async ({ parsedInput }) => {
    await requireTenantOwner()
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase
      .from('services')
      .update({ is_active: true })
      .eq('id', parsedInput.id)
    if (error) throw new AppError('SERVICE_RESTORE_FAILED', error.message)
    revalidatePath('/services')
    return { ok: true }
  })
```

Keep `deactivateServiceAction` exported as an alias for back-compat if anything imports it; otherwise simply rename to `softDeleteServiceAction`. The form dialog (Task 12 Step 2) will use the new names.

- [ ] **Step 2: service-form-dialog.tsx — 加 group class fields**

In `src/app/(tenant)/services/service-form-dialog.tsx`:

Add state for the 3 new fields after existing state:

```ts
const [maxCapacity, setMaxCapacity] = useState(String(initial?.max_capacity ?? 1))
const [minAttendance, setMinAttendance] = useState(String(initial?.min_attendance ?? 1))
const [cancelDeadlineHours, setCancelDeadlineHours] = useState(
  String(initial?.cancel_deadline_hours ?? 24),
)
```

(Also extend the `Service` type at the top of the file to include the 3 fields, marked optional with defaults if existing rows might not have them — but after migration Task 5, every row has them.)

In the `submit()` payload, add:
```ts
maxCapacity,
minAttendance,
cancelDeadlineHours,
```

Add a new collapsible section "團班設定（選填，預設 1 對 1）" with 3 number inputs. Use existing `Label` / `Input` pattern. Position before the submit button.

```tsx
<div className="space-y-2 rounded border border-dashed p-3">
  <Label className="text-sm font-medium">團班設定（預設 1 對 1）</Label>
  <div className="grid grid-cols-3 gap-2">
    <div className="space-y-1">
      <Label htmlFor="svc-capacity" className="text-xs">
        最大人數
      </Label>
      <Input
        id="svc-capacity"
        type="number"
        min={1}
        value={maxCapacity}
        onChange={(e) => setMaxCapacity(e.target.value)}
      />
    </div>
    <div className="space-y-1">
      <Label htmlFor="svc-min" className="text-xs">
        最少人數
      </Label>
      <Input
        id="svc-min"
        type="number"
        min={1}
        value={minAttendance}
        onChange={(e) => setMinAttendance(e.target.value)}
      />
    </div>
    <div className="space-y-1">
      <Label htmlFor="svc-deadline" className="text-xs">
        取消截止 (小時)
      </Label>
      <Input
        id="svc-deadline"
        type="number"
        min={1}
        value={cancelDeadlineHours}
        onChange={(e) => setCancelDeadlineHours(e.target.value)}
      />
    </div>
  </div>
  <p className="text-xs text-muted-foreground">
    達最少人數時自動確認；過取消截止 (slot 開始前 N 小時) 仍不足、自動取消並退課數。
  </p>
</div>
```

- [ ] **Step 3: services/page.tsx — 加 active/archived tab + 改按鈕語意**

Modify `src/app/(tenant)/services/page.tsx`:

Change the query to support `archived` flag (similar to packages):

```ts
export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>
}) {
  const params = await searchParams
  const showArchived = params.archived === '1'
  // ...
  const { data: services } = await supabase
    .from('services')
    .select(
      'id, name, description, duration_minutes, price, is_active, max_capacity, min_attendance, cancel_deadline_hours, created_at',
    )
    .eq('tenant_id', session.tenantId)
    .eq('is_active', !showArchived)
    .order('created_at', { ascending: false })
```

Add tab toggle in the header:

```tsx
<header className="flex flex-wrap items-start justify-between gap-3">
  <div>
    <h1 className="text-2xl font-bold tracking-tight">服務項目</h1>
    <p className="mt-1 text-sm text-muted-foreground">
      {showArchived ? '已刪除的服務' : '您提供的所有服務'}
    </p>
  </div>
  <div className="flex flex-wrap items-center gap-2">
    <Link
      href={showArchived ? '/services' : '/services?archived=1'}
      className={buttonVariants({ variant: 'outline', size: 'sm' })}
    >
      {showArchived ? '看使用中' : '看已刪除'}
    </Link>
    {canEdit && !showArchived && <ServiceFormDialog mode="create" />}
  </div>
</header>
```

(Import `Link` from `next/link` and `buttonVariants` from `@/components/ui/button` if not already.)

For each service card, replace the existing 「停用」 button (if there is a separate button) with a 「刪除/重新啟用」 button. If `is_active`:
- Show ConfirmDialog with 「刪除」 button → calls `softDeleteServiceAction` (renamed).

If `!is_active`:
- Show 「重新啟用」 button → calls `restoreServiceAction`.

(The current page.tsx only has ServiceFormDialog with mode='edit'; the actual delete affordance is inside the edit dialog as is_active toggle. We need a separate row action — add similar to PackageActionsRow.)

Create `src/app/(tenant)/services/service-actions-row.tsx` similar to `package-actions-row.tsx`:

```tsx
'use client'

import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Trash2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import ConfirmDialog from '@/components/confirm-dialog'
import { softDeleteServiceAction, restoreServiceAction } from './actions'

export default function ServiceActionsRow({
  id,
  isActive,
}: {
  id: string
  isActive: boolean
}) {
  const del = useAction(softDeleteServiceAction, {
    onSuccess: () => toast.success('已刪除'),
    onError: ({ error }) => toast.error(error.serverError?.message ?? '失敗'),
  })
  const restore = useAction(restoreServiceAction, {
    onSuccess: () => toast.success('已重新啟用'),
    onError: ({ error }) => toast.error(error.serverError?.message ?? '失敗'),
  })

  if (!isActive) {
    return (
      <Button variant="outline" size="sm" onClick={() => restore.execute({ id })} disabled={restore.isPending}>
        <RotateCcw className="mr-1 h-3.5 w-3.5" />
        重新啟用
      </Button>
    )
  }
  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline" size="sm">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      }
      title="刪除此服務？"
      description="刪除後學員端不再顯示。既有預約與套裝不受影響。可從『已刪除』分頁重新啟用。"
      confirmLabel="刪除"
      variant="destructive"
      onConfirm={() => del.execute({ id })}
    />
  )
}
```

(File path: `src/app/(tenant)/services/service-actions-row.tsx`.)

In `services/page.tsx`, import this component and render in each service card alongside `ServiceFormDialog mode="edit"`.

- [ ] **Step 4: typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: clean

- [ ] **Step 5: commit**

```bash
git add src/app/(tenant)/services/
git commit -m "$(cat <<'EOF'
feat(s4): service form gains group class fields + soft delete UI (FR-128, FR-130)

ServiceFormDialog now collects max_capacity / min_attendance /
cancel_deadline_hours with refined cross-field validation
(min<=max). /services page gets an active/archived tab toggle and a
new ServiceActionsRow with 刪除/重新啟用 affordance via
softDeleteServiceAction (renamed from deactivateServiceAction) and
new restoreServiceAction.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: Calendar UI — show X/Y for group slots

**Files (Modify):**
- `src/app/(tenant)/calendar/page.tsx`
- `src/app/(tenant)/calendar/calendar-panel.tsx`
- `src/app/(tenant)/calendar/week-grid.tsx`
- `src/app/(tenant)/calendar/list-view.tsx`
- `src/app/(tenant)/calendar/slot-popover.tsx`

- [ ] **Step 1: page.tsx — query 帶 service capacity + bookingsCount**

Modify `src/app/(tenant)/calendar/page.tsx`:

Change the slots query to include `services(max_capacity)`:

```ts
const { data: slots } = await supabase
  .from('availability_slots')
  .select(
    'id, start_at, end_at, status, member_id, service_id, services(name, max_capacity)',
  )
  .in('member_id', effectiveIds)
  .gte('start_at', weekStart.toISOString())
  .lte('start_at', weekEnd.toISOString())
  .order('start_at')
```

After the slots query, count bookings per slot (for slots whose service is a group class). Reuse the bookings query that S2/S3 already does — but augment to count all non-cancelled bookings per slot:

```ts
const slotBookingCounts: Record<string, number> = {}
if (slotIds.length) {
  const { data: bks } = await supabase
    .from('bookings')
    .select('id, slot_id, status, customers(display_name)')
    .in('slot_id', slotIds)
    .neq('status', 'cancelled')
  for (const b of bks ?? []) {
    slotBookingCounts[b.slot_id] = (slotBookingCounts[b.slot_id] ?? 0) + 1
    // existing bookingsBySlot logic remains for status mapping
    ...
  }
}
```

(`slotIds` already exists from S2; reuse it. `bookingsBySlot` already iterates these — extend the same loop to increment a per-slot counter.)

In `slotDisplays` mapping, add `bookingCount` and `maxCapacity`:

```ts
const slotDisplays = (slots ?? []).map((s) => {
  // ... existing fields ...
  const svc = s.services as { name: string; max_capacity: number } | null
  return {
    // ... existing fields ...
    bookingCount: slotBookingCounts[s.id] ?? 0,
    maxCapacity: svc?.max_capacity ?? 1,
  }
})
```

- [ ] **Step 2: calendar-panel.tsx — extend SlotDisplay type**

Add `bookingCount: number` and `maxCapacity: number` to `SlotDisplay` type in `src/app/(tenant)/calendar/calendar-panel.tsx`.

- [ ] **Step 3: week-grid.tsx — show「N/M」 when max_capacity > 1**

Add `bookingCount: number` and `maxCapacity: number` to local `SlotDisplay` type. In the slot button rendering, after the existing title row and before the time row, add:

```tsx
{s.maxCapacity > 1 && (
  <div className="opacity-70">
    {s.bookingCount}/{s.maxCapacity}
  </div>
)}
```

- [ ] **Step 4: list-view.tsx — show「N/M」 when max_capacity > 1**

Same — add the fields to local `SlotDisplay` type. In the `<li>` rendering, add a span showing the count alongside the time label:

```tsx
{s.maxCapacity > 1 && (
  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
    {s.bookingCount}/{s.maxCapacity}
  </span>
)}
```

(Placement: in the `<div className="flex-1 min-w-0">` div after the service name.)

- [ ] **Step 5: slot-popover.tsx — add bookingCount + maxCapacity props + show 列表**

Add `bookingCount: number` and `maxCapacity: number` to the slot prop type.

In the dialog content, after the existing rows (時間 / 負責成員 / 狀態), add a new row when `maxCapacity > 1`:

```tsx
{slot.maxCapacity > 1 && (
  <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
    <span className="text-sm text-muted-foreground">已預約人數</span>
    <span className="text-sm font-medium">
      {slot.bookingCount} / {slot.maxCapacity}
    </span>
  </div>
)}
```

(Listing individual customer names would require additional data; the count is sufficient for V1.)

- [ ] **Step 6: typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: clean

- [ ] **Step 7: commit**

```bash
git add src/app/(tenant)/calendar/
git commit -m "$(cat <<'EOF'
feat(s4): calendar shows X/Y for group slots (FR-128 UI)

Calendar page now joins services.max_capacity and counts non-cancelled
bookings per slot. WeekGrid / ListView / SlotPopover thread through
bookingCount + maxCapacity fields and display "N/M" badges when
maxCapacity > 1. 1-on-1 slots are visually unchanged.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: Auto-cancel cron + vercel.json

**Files:**
- Create: `src/app/api/cron/auto-cancel-group-class/route.ts`
- Modify: `vercel.json`
- Modify: `src/lib/notify-booking.ts` — add `notifyGroupAutoCancel`

- [ ] **Step 1: cron route**

`src/app/api/cron/auto-cancel-group-class/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { notifyGroupAutoCancel } from '@/lib/notify-booking'

export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const admin = createSupabaseAdminClient()
  const now = new Date()
  // Look ahead 48h max; we'll filter per-slot using each service's deadline
  const horizonEnd = new Date(now.getTime() + 48 * 3600 * 1000)

  const { data: slots, error } = await admin
    .from('availability_slots')
    .select(
      'id, service_id, start_at, status, services(min_attendance, cancel_deadline_hours)',
    )
    .gte('start_at', now.toISOString())
    .lt('start_at', horizonEnd.toISOString())
    .neq('status', 'cancelled')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let cancelled = 0
  let evaluated = 0
  for (const slot of slots ?? []) {
    const svc = slot.services as { min_attendance: number; cancel_deadline_hours: number } | null
    if (!svc) continue
    if (svc.min_attendance <= 1) continue // 1-on-1, no auto-cancel logic
    evaluated++

    const hoursToStart =
      (new Date(slot.start_at).getTime() - now.getTime()) / 3600000
    if (hoursToStart > svc.cancel_deadline_hours) continue

    const { count } = await admin
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('slot_id', slot.id)
      .neq('status', 'cancelled')

    if ((count ?? 0) >= svc.min_attendance) continue

    // Cancel via RPC
    const { data: affected, error: cancelErr } = await admin.rpc('auto_cancel_group_slot', {
      p_slot_id: slot.id,
    })
    if (cancelErr) {
      console.error('[auto-cancel]', cancelErr.message, { slotId: slot.id })
      continue
    }
    cancelled++

    // Notify all returned customer IDs + member
    for (const row of (affected ?? []) as Array<{
      affected_customer_id: string
      affected_member_user_id: string | null
      service_name: string
      slot_start_at: string
    }>) {
      void notifyGroupAutoCancel(
        row.affected_customer_id,
        row.affected_member_user_id,
        row.service_name,
        row.slot_start_at,
      )
    }
  }

  return NextResponse.json({
    evaluated,
    cancelled,
    timestamp: now.toISOString(),
  })
}
```

- [ ] **Step 2: notify helper**

Append to `src/lib/notify-booking.ts`:

```ts
export async function notifyGroupAutoCancel(
  customerId: string,
  memberUserId: string | null,
  serviceName: string,
  slotStartAt: string,
): Promise<void> {
  try {
    const admin = createSupabaseAdminClient()
    const startLabel = new Date(
      new Date(slotStartAt).getTime() + 8 * 3600 * 1000,
    ).toLocaleString('zh-TW')
    // Customer notification
    await pushToUser(admin, {
      userId: customerId,
      type: 'booking_status',
      payload: {
        title: '課程取消',
        body: `${serviceName} (${startLabel}) 因人數不足取消。已退還 1 堂課數。`,
        url: '/my-bookings',
        tag: `auto-cancel-${slotStartAt}-${customerId}`,
      },
      relatedId: customerId,
    })
    // Coach notification (one per customer; ideally dedup at caller, but small fan-out OK)
    if (memberUserId) {
      await pushToUser(admin, {
        userId: memberUserId,
        type: 'booking_status',
        payload: {
          title: '團班取消',
          body: `${serviceName} (${startLabel}) 因人數不足，系統已自動取消並退還學員課數。`,
          url: '/calendar',
          tag: `auto-cancel-${slotStartAt}`,
        },
        relatedId: customerId,
      })
    }
  } catch (err) {
    console.error('[notify-group-auto-cancel]', err)
  }
}
```

- [ ] **Step 3: vercel.json — 加 cron entry**

Modify `vercel.json`:

```json
{
  "framework": "nextjs",
  "buildCommand": "next build",
  "installCommand": "npm install",
  "outputDirectory": ".next",
  "crons": [
    {
      "path": "/api/cron/materialize-recurring",
      "schedule": "30 16 * * *"
    },
    {
      "path": "/api/cron/weekly-summary",
      "schedule": "0 12 * * 0"
    },
    {
      "path": "/api/cron/auto-cancel-group-class",
      "schedule": "0 * * * *"
    }
  ]
}
```

(Hourly at minute 0 — UTC, so xx:00 UTC = xx:00+8 = xx+8:00 Taipei time. Cron runs 24×/day.)

- [ ] **Step 4: typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: clean; new cron route in route table

- [ ] **Step 5: commit**

```bash
git add src/app/api/cron/auto-cancel-group-class/route.ts src/lib/notify-booking.ts vercel.json
git commit -m "$(cat <<'EOF'
feat(s4): auto-cancel-group-class cron + notifications (FR-129)

Hourly cron evaluates upcoming slots (48h horizon) against each
service's cancel_deadline_hours; calls auto_cancel_group_slot RPC
when min_attendance not met, then fans out push notifications to all
affected customers and the coach via notifyGroupAutoCancel. 1-on-1
slots (min_attendance=1) are skipped. vercel.json registers the cron
at xx:00 each hour.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 15: Seed enrichment — packages + group class demo for 林教練

**Files:**
- Modify: `scripts/seed-test-data.mjs`

- [ ] **Step 1: 改 bookSlot helper 走 purchase**

In `scripts/seed-test-data.mjs`, the existing `bookSlot` helper inserts directly into bookings without `purchase_id`. After Task 6's migration adds NOT NULL, this seed will fail. Update to create a synthetic 1-class purchase first:

```js
async function bookSlot({ slotId, customerId, notes, status = 'pending' }) {
  const { data: slot } = await admin
    .from('availability_slots')
    .select('tenant_id, service_id')
    .eq('id', slotId)
    .single()
  await admin
    .from('tenant_customers')
    .upsert(
      { tenant_id: slot.tenant_id, customer_id: customerId },
      { onConflict: 'tenant_id,customer_id' },
    )
  // Synthetic 1-class purchase (auto-approved, never expires) — matches the
  // backfill migration pattern
  const { data: purchase } = await admin
    .from('customer_purchases')
    .insert({
      tenant_id: slot.tenant_id,
      customer_id: customerId,
      service_id: slot.service_id,
      package_id: null,
      classes_total: 1,
      classes_used: 1,
      expires_at: null,
      payment_self_reported: 'claimed_paid',
      approval_status: 'confirmed',
      approved_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  const { data: booking } = await admin
    .from('bookings')
    .insert({
      tenant_id: slot.tenant_id,
      slot_id: slotId,
      customer_id: customerId,
      service_id: slot.service_id,
      status,
      customer_notes: notes ?? null,
      purchase_id: purchase.id,
    })
    .select()
    .single()
  const slotStatus =
    status === 'pending' ? 'pending' : status === 'confirmed' ? 'booked' : 'available'
  await admin.from('availability_slots').update({ status: slotStatus }).eq('id', slotId)
  return booking
}
```

- [ ] **Step 2: 加 S4 enrichment 區塊**

After the existing S3 enrichment block (in `main()`), and before the `Seed complete` log, add:

```js
log('\n─── Creating packages (S4) ───')

// 林教練 packages: 網球初級 單堂 + 10 堂套裝
const { data: linInitSinglePkg } = await admin
  .from('service_packages')
  .insert({
    tenant_id: lin.tenant.id,
    service_id: linSvc1.id, // 網球初級
    name: '單堂',
    class_count: 1,
    price: 1200,
    expires_in_days: 30,
  })
  .select('id')
  .single()

const { data: linInit10Pkg } = await admin
  .from('service_packages')
  .insert({
    tenant_id: lin.tenant.id,
    service_id: linSvc1.id,
    name: '10 堂套裝',
    class_count: 10,
    price: 10000,
    expires_in_days: 180,
  })
  .select('id')
  .single()
log(`  ✓ 林教練 packages: 單堂 1200 / 30天 + 10 堂套裝 10000 / 180天`)

// 王教練 + 陳教練 also get a 單堂 package each so their bookings can work
await admin.from('service_packages').insert({
  tenant_id: wang.tenant.id,
  service_id: wangSvc1.id,
  name: '單堂',
  class_count: 1,
  price: 1500,
  expires_in_days: 60,
})
await admin.from('service_packages').insert({
  tenant_id: chen.tenant.id,
  service_id: chenSvc.id,
  name: '單堂',
  class_count: 2,
  price: 2000,
  expires_in_days: 60,
})
log(`  ✓ 王教練 / 陳教練 各 1 個單堂 package`)

log('\n─── Creating purchases (S4) ───')

// 小明 buys 10-class pack from 林 (confirmed)
const { data: minMingPurchase } = await admin
  .from('customer_purchases')
  .insert({
    tenant_id: lin.tenant.id,
    customer_id: minming.id,
    service_id: linSvc1.id,
    package_id: linInit10Pkg.id,
    classes_total: 10,
    classes_used: 1, // already booked one (in S0 seed)
    expires_at: new Date(Date.now() + 180 * 24 * 3600 * 1000).toISOString(),
    payment_self_reported: 'claimed_paid',
    approval_status: 'confirmed',
    approved_at: new Date().toISOString(),
  })
  .select('id')
  .single()
log(`  ✓ 小明 confirmed: 10 堂林教練網球初級 (餘 9)`)

// 小華 pending request from 王教練
await admin.from('customer_purchases').insert({
  tenant_id: wang.tenant.id,
  customer_id: minghua.id,
  service_id: wangSvc1.id,
  package_id: linInitSinglePkg.id, // wrong package_id; just for demo, system allows
  classes_total: 1,
  payment_self_reported: 'awaiting_payment',
  approval_status: 'pending_review',
})
log(`  ✓ 小華 pending request: 王教練單堂 (未付款)`)

log('\n─── Creating group class demo (S4) ───')

// 林教練 加個新 service「網球團體班」, capacity=4 min=3 deadline=24h
const { data: linGroupSvc } = await admin
  .from('services')
  .insert({
    tenant_id: lin.tenant.id,
    name: '網球團體班',
    description: '4 人小班制，須 3 人開課',
    duration_minutes: 90,
    price: 800,
    is_active: true,
    max_capacity: 4,
    min_attendance: 3,
    cancel_deadline_hours: 24,
  })
  .select('id')
  .single()

await admin.from('service_packages').insert({
  tenant_id: lin.tenant.id,
  service_id: linGroupSvc.id,
  name: '單堂',
  class_count: 1,
  price: 800,
  expires_in_days: 60,
})

// 一個 group slot 5 天後
const groupDate = todayStr(5)
const { data: groupSlot } = await admin
  .from('availability_slots')
  .insert({
    tenant_id: lin.tenant.id,
    member_id: lin.member.id,
    service_id: linGroupSvc.id,
    start_at: localIso(groupDate, '15:00'),
    end_at: localIso(groupDate, '16:30'),
    status: 'available',
  })
  .select('id')
  .single()
log(`  ✓ 林教練 group slot: ${groupDate} 15:00-16:30 網球團體班 (4/3, 24h deadline)`)

// 小明 + 小華 book this group slot (only 2/3, will trigger auto-cancel cron if no third before deadline)
for (const student of [minming, minghua]) {
  await admin.from('customer_purchases').insert({
    tenant_id: lin.tenant.id,
    customer_id: student.id,
    service_id: linGroupSvc.id,
    package_id: null,
    classes_total: 1,
    classes_used: 1,
    expires_at: null,
    payment_self_reported: 'claimed_paid',
    approval_status: 'confirmed',
    approved_at: new Date().toISOString(),
  })
  // Then book — but we need a purchase first; the line above creates one auto-used.
  // For atomicity, use bookSlot helper which does both.
}
// Use the standard bookSlot helper for clean attribution (synthetic purchase + booking)
await bookSlot({ slotId: groupSlot.id, customerId: minming.id, status: 'pending' })
await bookSlot({ slotId: groupSlot.id, customerId: minghua.id, status: 'pending' })
log(`  ✓ 小明 + 小華 已預約團體班 slot (2/3 未達 min — 24h 內若無第三人 cron 會 auto-cancel)`)
```

Note: the inserts above create purchases inline AND then `bookSlot` creates additional synthetic purchases. That's intentional for demo — the lin group-class purchases above show "confirmed but unused" state for visualization, and the bookSlot calls actually consume their own synthetic purchases. The duplication is fine for seed.

- [ ] **Step 3: 跑 seed (optional, only if SUPABASE_SERVICE_ROLE_KEY is in .env.local)**

Run: `node scripts/seed-test-data.mjs`
Expected: 「Seed complete」 + new S4 lines

(If the env isn't set up locally, skip; production seed pipeline catches it later.)

- [ ] **Step 4: commit**

```bash
git add scripts/seed-test-data.mjs
git commit -m "$(cat <<'EOF'
feat(s4): seed packages + purchases + group class demo (S4 enrichment)

bookSlot helper now creates a synthetic 1-class purchase before
inserting the booking (matches the backfill migration pattern). Adds
service_packages for 林/王/陳, a confirmed 10-class purchase for 小明,
a pending request for 小華, and a fresh group-class service (網球團體班
4/3, 24h deadline) with 2 bookings to demo the auto-cancel cron path.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 16: README + appendix C + final push

**Files (Modify):**
- `README.md`
- `docs/superpowers/specs/2026-05-21-quickreserve-redesign-design.md`

- [ ] **Step 1: README — 加路由 + 套裝/團班說明**

In `README.md`, find the route map under `(tenant) — 教練後台`. Add 2 lines:

```
  /packages                    套裝管理（每服務的 N 堂方案 CRUD、軟刪除）（S4）
  /packages/pending            待審核購買申請佇列（S4）
```

And under `[tenantSlug] — 公開預約頁`:

```
  /[slug]/packages             可購方案瀏覽 + 申請（S4）
  /[slug]/purchases            學員看自己的餘額（S4）
```

Under cron section:

```
  /api/cron/auto-cancel-group-class  每小時 xx:00（團班人數不足 auto cancel + 退課數）
```

Then add a new section before "## 部署" (i.e., after the 「可用時段」 section from S3):

```markdown
## 套裝 / 課數模型（S4）

QuickReserve 把「單堂課」與「套裝」用同一張表（`customer_purchases`）表達：

- **單堂課** = `classes_total = 1` 的 purchase（class_count=1 package）
- **套裝** = `classes_total > 1` 的 purchase（class_count>1 package）

**購買流程：**
1. 學員瀏覽 `/[slug]/packages` 看可購方案
2. 提交申請（自報已付/未付）→ `customer_purchases` row, `approval_status='pending_review'`
3. 教練於 `/packages/pending` 審核：
   - 確認 → status 變 `confirmed`，`expires_at` = approved_at + `package.expires_in_days * 24h`
   - 拒絕 → status 變 `rejected`，留下 `rejected_reason`
4. 預約消費：`book_with_purchase` RPC 自動找最快過期的 active purchase，increment `classes_used`，attach 到 booking 的 `purchase_id`

**取消：**
- 學員 / 教練取消 booking → purchase.classes_used--（退一堂）
- 團班 auto-cancel → 同上、所有 booking 學員一起退

**過期：**
- `expires_at` 為 null = 永久；非 null = 該時間後不可用於新預約
- 已扣的 classes_used 不退

## 團班（Group Class, S4）

`services` 表有三個欄位控制團班行為：

| 欄位 | 預設 | 意義 |
|---|---|---|
| `max_capacity` | 1 | 此 slot 最多多少人 |
| `min_attendance` | 1 | 要 N 人才開課；達 min 自動 confirm |
| `cancel_deadline_hours` | 24 | 開課前 N 小時若仍不足 min 就 auto-cancel |

**1-on-1（預設）：** capacity=1 min=1 deadline 任意值（無 group 邏輯觸發）

**團班：** capacity=4 min=3 deadline=24h
- 第 3 個學員 book 後 → 所有 pending bookings auto-confirmed
- 開課前 24h 仍 < 3 人 → cron 取消 slot、退課數、通知所有人

Cron 每小時跑一次，最小 `cancel_deadline_hours = 1`。
```

- [ ] **Step 2: Appendix C — 加 FR-125~130**

Get the commit hashes:

```bash
git log --oneline -25 | head -25
```

Find each FR's main commits:
- FR-125: Task 2 commit (service_packages schema) + Task 8 commit (CRUD UI)
- FR-126: Task 3 commit (customer_purchases schema) + Task 9 commit (pending review) + Task 10 commit (student-facing)
- FR-127: Task 4 commit (backfill) + Task 6 commit (book_with_purchase RPC) + Task 11 commit (page wire)
- FR-128: Task 5 commit (services columns) + Task 12 commit (form fields) + Task 13 commit (calendar UI)
- FR-129: Task 6 commit (auto_cancel_group_slot RPC) + Task 14 commit (cron + notify)
- FR-130: Task 12 commit (services soft delete UI) + Task 8 commit (packages soft delete UI)

Append 6 rows to appendix C in the same format as previous FRs:

```
| 2026-05-25 | service_packages schema + CRUD UI + 軟刪除 | FR-125 | `<hash_t2>`, `<hash_t8>` |
| 2026-05-25 | customer_purchases schema + 學員申請 + 教練審核 + 通知 | FR-126 | `<hash_t3>`, `<hash_t9>`, `<hash_t10>` |
| 2026-05-25 | 預約強制經過 purchase + book_with_purchase RPC | FR-127 | `<hash_t1>`, `<hash_t4>`, `<hash_t6>`, `<hash_t11>` |
| 2026-05-25 | services 加 max_capacity/min_attendance/cancel_deadline_hours | FR-128 | `<hash_t5>`, `<hash_t12>`, `<hash_t13>` |
| 2026-05-25 | 團班 auto-confirm + auto-cancel cron + 雙向通知 | FR-129 | `<hash_t6>`, `<hash_t14>` |
| 2026-05-25 | is_active 軟刪除 UX 統一（刪除/重新啟用 + 已刪除分頁） | FR-130 | `<hash_t8>`, `<hash_t12>` |
```

If there's a `**最後更新**` header at the top, update to today's date.

- [ ] **Step 3: typecheck + build (final)**

Run: `npm run typecheck && npm run build`
Expected: clean

- [ ] **Step 4: commit + push**

```bash
git add README.md docs/superpowers/specs/2026-05-21-quickreserve-redesign-design.md
git commit -m "$(cat <<'EOF'
docs(s4): README 套裝/團班 sections + appendix C FR-125~130

Wraps S4: README documents the punch-card purchases model
(single class = 1-class purchase, packages = N-class purchase),
the approval/expiry/refund flows, and the group-class
capacity/min/deadline semantics + hourly auto-cancel cron.
Appendix C links each FR to its implementing commits.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push origin master
```

- [ ] **Step 5: Verify push + wait Vercel READY**

Push output should show `master -> master`. After push, check Vercel deployment status — should reach READY in ~3 minutes.

- [ ] **Step 6: 收工**

Report back: S4 完成 with N commits; remind user to re-run seed (`node scripts/seed-test-data.mjs`) post-deploy if they want fresh demo data with packages + group class.

---

## Acceptance Summary

完成所有 task 後，spec §2.3 的 8 條驗收 gate：

1. ✅ 教練可在 `/packages` 為「網球初級」建立兩個 package（單堂 / 10 堂套裝）
2. ✅ 學員可在 `/[tenantSlug]/packages` 提交購買申請、自報已付款
3. ✅ 教練於 `/packages/pending` 看到請求、確認後學員 balance = 10
4. ✅ 學員預約 slot：自動扣 1 堂、balance = 9
5. ✅ 學員無 balance 時、`/book/[slotId]` 顯示「需購買套裝」CTA
6. ✅ 教練設 service 為團班：第 4 個學員 book 後前 3 個 booking 全部 confirmed + 通知
7. ✅ 同 slot 若預約截止前不足 min：cron auto-cancel + 退課數 + 通知
8. ✅ 教練「刪除」服務後學員端不見、教練端「已刪除」分頁仍可 restore

Plus：
- FR-125 ~ FR-130 commit hash 全部回填附錄 C
- README 有 S4 兩個新章節
- 全 commits push origin master、Vercel READY

---

## Self-Review Checklist

- [x] Spec §2.1 in scope 全覆蓋（套裝 → Tasks 2/3/4/6/7/8/9/10/11、團班 → Tasks 5/6/13/14、軟刪除 → Tasks 8/12）
- [x] Spec §3 套裝資料模型 → Task 2 (packages) + Task 3 (purchases) + Task 4 (bookings.purchase_id + backfill)
- [x] Spec §4 團班 → Task 5 (columns + unique index) + Task 6 (RPCs) + Task 13 (UI) + Task 14 (cron)
- [x] Spec §5 軟刪除 → Task 8 (packages tab) + Task 12 (services tab + actions)
- [x] Spec §6 預約 flow → Task 11 (book.tsx 改造) + Task 6 (book_with_purchase) + Task 7 (helper)
- [x] Spec §7 UI 改動 → Tasks 8/9/10/12/13 全覆蓋
- [x] Spec §8 file list → 對得起 file map
- [x] Spec §10 FR 編號 → Task 16 回寫附錄 C
- [x] 無 TBD / TODO / placeholder（除一處 step 2 中標示「TODO: push notify coach」這是 future enhancement, 不阻塞 spec gate）
- [x] 跨 task type 一致：`CustomerPurchase`、`ApprovalStatus`、`PaymentSelfReport`、`SlotDisplay.bookingCount/maxCapacity`、`book_with_purchase` 回傳 shape
- [x] RPC 參數 / 回傳列在 SQL 中、JS 呼叫端對齊
