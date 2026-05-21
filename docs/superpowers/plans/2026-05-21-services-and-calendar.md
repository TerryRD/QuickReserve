# Plan 2: Services & Calendar Core

> **For agentic workers:** Builds on Plan 1's foundation. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tenant owner can define service catalog, manually create availability slots, see them on a week-view calendar; the database enforces no-overlap via PostgreSQL EXCLUDE constraint; conflicting inserts produce structured errors the UI can show.

**Architecture:** Continue with Next.js App Router + Server Actions + Supabase RLS. Add 2 tables (`services`, `availability_slots`) with policies. Slot conflicts use `EXCLUDE USING gist` on `tstzrange`, caught in a wrapper that re-queries for the conflicting rows and throws `SlotConflictError`. Calendar UI is a server-rendered week grid with a client dialog for slot creation.

**Tech Stack:** unchanged from Plan 1 (Next.js 15, Supabase, shadcn/ui, next-safe-action, Vitest). Adds `date-fns` for week math.

**Spec reference:** [spec §4.2 / §4.3 / §7.2 / §9.3](../specs/2026-05-21-quickreserve-redesign-design.md). FR-010..012 (services), FR-020 (single slot create), FR-026 (delete single slot), FR-027 (no overlap), FR-028 (structured conflict info).

**Out of scope for Plan 2:**
- Batch creation (FR-021) → Plan 3
- Recurring rules (FR-022-025) → Plan 3
- Conflict-jump UI navigation (FR-028 part 2) → Plan 3
- Bookings (FR-030+) → Plan 4
- Staff management (FR-040+) → Plan 5

---

## File Map

**Migrations**
- `supabase/migrations/<ts>_services_schema.sql`
- `supabase/migrations/<ts>_services_rls.sql`
- `supabase/migrations/<ts>_slots_schema.sql`
- `supabase/migrations/<ts>_slots_rls.sql`

**Server library**
- `src/lib/conflicts.ts` — `extractSlotConflict()` helper that classifies a Postgres error and re-queries

**Services (CRUD)**
- `src/app/(tenant)/services/page.tsx` — list + “Add service” form opens dialog
- `src/app/(tenant)/services/actions.ts` — `createService`, `updateService`, `deactivateService`
- `src/app/(tenant)/services/service-form-dialog.tsx` — modal form (create or edit)

**Calendar**
- `src/app/(tenant)/calendar/page.tsx` — server page, takes `?week=YYYY-MM-DD`, loads slots for that week
- `src/app/(tenant)/calendar/actions.ts` — `createSlot`, `deleteSlot`
- `src/app/(tenant)/calendar/week-grid.tsx` — server component, 7 columns × time rows
- `src/app/(tenant)/calendar/new-slot-dialog.tsx` — client dialog launched from grid

**Tests**
- `tests/unit/conflicts.test.ts`
- `tests/integration/exclude-constraint.test.ts`

---

## Task 1: Services schema + RLS

**Files:**
- Create: `supabase/migrations/<ts>_services_schema.sql`
- Create: `supabase/migrations/<ts>_services_rls.sql`

- [ ] **Step 1** — `npx supabase migration new services_schema`. Write contents:

```sql
create table public.services (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  description text,
  duration_minutes int not null check (duration_minutes > 0),
  price numeric(10, 2),
  is_active boolean not null default true,
  extended_properties jsonb default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_services_tenant on public.services(tenant_id, is_active);
create trigger services_set_updated_at
  before update on public.services
  for each row execute function public.set_updated_at();
```

- [ ] **Step 2** — `npx supabase migration new services_rls`. Write:

```sql
alter table public.services enable row level security;

-- Tenant members (owner + staff) can read their own services
create policy services_select_member on public.services for select
  using (tenant_id in (select current_user_tenant_ids()));

-- Public booking page can read active services of an active tenant
create policy services_select_public on public.services for select
  using (
    is_active = true
    and tenant_id in (select id from public.tenants where status = 'active')
  );

-- Platform admin can read all
create policy services_select_admin on public.services for select using (is_platform_admin());

-- Only owners can write
create policy services_insert_owner on public.services for insert
  with check (tenant_id in (select current_user_owner_tenant_ids()));
create policy services_update_owner on public.services for update
  using (tenant_id in (select current_user_owner_tenant_ids()));
create policy services_delete_owner on public.services for delete
  using (tenant_id in (select current_user_owner_tenant_ids()));
```

- [ ] **Step 3** — `npm run db:push` (yes to apply).
- [ ] **Step 4** — `npm run db:types` to regenerate `src/lib/supabase/types.ts`.
- [ ] **Step 5** — Commit:

```
git commit -m "feat(plan-2): add services schema + RLS

services table with tenant_id FK, name, description, duration_minutes,
price, is_active, extended_properties jsonb. RLS: members read own,
public reads active-on-active-tenant, owners can write.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Services CRUD Server Actions

**Files:** `src/app/(tenant)/services/actions.ts`

- [ ] **Step 1** — Write the file:

```ts
'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { actionClient } from '@/lib/safe-action'
import { requireTenantOwner } from '@/lib/auth/get-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AppError, NotFoundError } from '@/lib/errors'

const PriceSchema = z.coerce.number().nonnegative().nullable()

const CreateServiceSchema = z.object({
  name: z.string().min(1, '請輸入名稱').max(60),
  description: z.string().max(500).optional().nullable(),
  durationMinutes: z.coerce.number().int().positive().max(600),
  price: PriceSchema,
})

export const createServiceAction = actionClient
  .inputSchema(CreateServiceSchema)
  .action(async ({ parsedInput }) => {
    const session = await requireTenantOwner()
    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase
      .from('services')
      .insert({
        tenant_id: session.tenantId,
        name: parsedInput.name,
        description: parsedInput.description ?? null,
        duration_minutes: parsedInput.durationMinutes,
        price: parsedInput.price,
        is_active: true,
      })
      .select('id')
      .single()
    if (error || !data) throw new AppError('SERVICE_CREATE_FAILED', error?.message ?? '建立失敗')
    revalidatePath('/services')
    return { id: data.id }
  })

const UpdateServiceSchema = CreateServiceSchema.extend({
  id: z.string().uuid(),
  isActive: z.boolean().optional(),
})

export const updateServiceAction = actionClient
  .inputSchema(UpdateServiceSchema)
  .action(async ({ parsedInput }) => {
    const session = await requireTenantOwner()
    const supabase = await createSupabaseServerClient()
    // RLS will scope to tenant; but be defensive:
    const { data: existing } = await supabase
      .from('services')
      .select('tenant_id')
      .eq('id', parsedInput.id)
      .maybeSingle()
    if (!existing) throw new NotFoundError('服務')
    if (existing.tenant_id !== session.tenantId) throw new NotFoundError('服務')

    const { error } = await supabase
      .from('services')
      .update({
        name: parsedInput.name,
        description: parsedInput.description ?? null,
        duration_minutes: parsedInput.durationMinutes,
        price: parsedInput.price,
        is_active: parsedInput.isActive ?? true,
      })
      .eq('id', parsedInput.id)
    if (error) throw new AppError('SERVICE_UPDATE_FAILED', error.message)
    revalidatePath('/services')
    return { id: parsedInput.id }
  })

const DeactivateSchema = z.object({ id: z.string().uuid() })

export const deactivateServiceAction = actionClient
  .inputSchema(DeactivateSchema)
  .action(async ({ parsedInput }) => {
    await requireTenantOwner()
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase
      .from('services')
      .update({ is_active: false })
      .eq('id', parsedInput.id)
    if (error) throw new AppError('SERVICE_DEACTIVATE_FAILED', error.message)
    revalidatePath('/services')
    return { ok: true }
  })
```

- [ ] **Step 2** — `npm run typecheck` (pass).
- [ ] **Step 3** — Commit.

---

## Task 3: Services list page + form dialog

**Files:**
- `src/app/(tenant)/services/page.tsx`
- `src/app/(tenant)/services/service-form-dialog.tsx`

- [ ] **Step 1** — Install shadcn dialog if not present:

```
npx --yes shadcn@latest add dialog --yes
```

- [ ] **Step 2** — Write `page.tsx`:

```tsx
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { requireTenantMember } from '@/lib/auth/get-session'
import ServiceFormDialog from './service-form-dialog'

export default async function ServicesPage() {
  const session = await requireTenantMember()
  const supabase = await createSupabaseServerClient()
  const { data: services } = await supabase
    .from('services')
    .select('id, name, description, duration_minutes, price, is_active, created_at')
    .order('created_at', { ascending: false })

  const canEdit = session.role === 'tenant_owner'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">服務項目</h1>
        {canEdit && <ServiceFormDialog mode="create" />}
      </div>
      <table className="w-full bg-white">
        <thead>
          <tr className="border-b text-left text-sm text-slate-600">
            <th className="p-3">名稱</th>
            <th className="p-3">時長</th>
            <th className="p-3">價格</th>
            <th className="p-3">狀態</th>
            <th className="p-3" />
          </tr>
        </thead>
        <tbody>
          {services?.map((s) => (
            <tr key={s.id} className="border-b text-sm">
              <td className="p-3">{s.name}</td>
              <td className="p-3">{s.duration_minutes} 分</td>
              <td className="p-3">{s.price ?? '—'}</td>
              <td className="p-3">{s.is_active ? '啟用' : '停用'}</td>
              <td className="p-3 text-right">
                {canEdit && <ServiceFormDialog mode="edit" service={s} />}
              </td>
            </tr>
          ))}
          {!services?.length && (
            <tr>
              <td colSpan={5} className="p-6 text-center text-slate-400">
                尚無服務，請新增
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 3** — Write `service-form-dialog.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
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
import { createServiceAction, updateServiceAction } from './actions'

type Service = {
  id: string
  name: string
  description: string | null
  duration_minutes: number
  price: number | null
  is_active: boolean
}

type Props =
  | { mode: 'create'; service?: undefined }
  | { mode: 'edit'; service: Service }

export default function ServiceFormDialog(props: Props) {
  const isEdit = props.mode === 'edit'
  const initial = props.service
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [durationMinutes, setDurationMinutes] = useState(String(initial?.duration_minutes ?? 60))
  const [price, setPrice] = useState(initial?.price !== undefined && initial?.price !== null ? String(initial.price) : '')

  const action = isEdit ? updateServiceAction : createServiceAction
  const { execute, isPending } = useAction(action, {
    onSuccess: () => {
      toast.success(isEdit ? '已更新' : '已新增')
      setOpen(false)
    },
    onError: ({ error }) => toast.error(error.serverError?.message ?? '失敗'),
  })

  function submit() {
    const payload = {
      name,
      description: description || null,
      durationMinutes,
      price: price === '' ? null : price,
    }
    if (isEdit) execute({ ...payload, id: initial!.id, isActive: initial!.is_active })
    else execute(payload)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={isEdit ? 'ghost' : 'default'} size={isEdit ? 'sm' : 'default'}>
          {isEdit ? '編輯' : '+ 新增服務'}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? '編輯服務' : '新增服務'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">名稱</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">描述</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="duration">時長 (分)</Label>
              <Input
                id="duration"
                type="number"
                min={1}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="price">價格 (可空)</Label>
              <Input
                id="price"
                type="number"
                min={0}
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button onClick={submit} disabled={isPending}>
            {isPending ? '儲存中...' : '儲存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 4** — `npm run build` to verify.
- [ ] **Step 5** — Commit + push (manual smoke test by user later: create service from /services page).

---

## Task 4: Slots schema + RLS + EXCLUDE constraint

**Files:**
- `supabase/migrations/<ts>_slots_schema.sql`
- `supabase/migrations/<ts>_slots_rls.sql`

- [ ] **Step 1** — `npx supabase migration new slots_schema`. Write:

```sql
create extension if not exists btree_gist;

create table public.availability_slots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  member_id uuid not null references public.tenant_members(id) on delete cascade,
  service_id uuid not null references public.services(id),
  recurring_rule_id uuid,  -- FK added in Plan 3
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null default 'available'
    check (status in ('available', 'pending', 'booked', 'cancelled')),
  extended_properties jsonb default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_at < end_at)
);

create index idx_slots_tenant_member_start
  on public.availability_slots(tenant_id, member_id, start_at);
create index idx_slots_start_status
  on public.availability_slots(start_at, status);

create trigger slots_set_updated_at
  before update on public.availability_slots
  for each row execute function public.set_updated_at();

-- The key safety net: same member cannot have overlapping non-cancelled slots
alter table public.availability_slots
  add constraint availability_slots_no_overlap
  exclude using gist (
    member_id with =,
    tstzrange(start_at, end_at) with &&
  ) where (status <> 'cancelled');
```

- [ ] **Step 2** — `npx supabase migration new slots_rls`. Write:

```sql
alter table public.availability_slots enable row level security;

-- Tenant members read slots in their tenant
create policy slots_select_member on public.availability_slots for select
  using (tenant_id in (select current_user_tenant_ids()));

-- Public reads available slots from active tenants (for booking page)
create policy slots_select_public on public.availability_slots for select
  using (
    status = 'available'
    and tenant_id in (select id from public.tenants where status = 'active')
  );

-- Platform admin sees all
create policy slots_select_admin on public.availability_slots for select using (is_platform_admin());

-- Tenant members can create slots for themselves (member_id must equal their own id)
create policy slots_insert_self on public.availability_slots for insert
  with check (
    tenant_id in (select current_user_tenant_ids())
    and member_id in (
      select id from public.tenant_members
      where user_id = auth.uid() and status = 'active'
    )
  );

-- Tenant owner can create slots for any member of their tenant
create policy slots_insert_owner on public.availability_slots for insert
  with check (
    tenant_id in (select current_user_owner_tenant_ids())
  );

-- Update / delete: self or owner
create policy slots_update_self on public.availability_slots for update
  using (
    member_id in (
      select id from public.tenant_members
      where user_id = auth.uid() and status = 'active'
    )
  );
create policy slots_update_owner on public.availability_slots for update
  using (tenant_id in (select current_user_owner_tenant_ids()));
create policy slots_delete_self on public.availability_slots for delete
  using (
    member_id in (
      select id from public.tenant_members
      where user_id = auth.uid() and status = 'active'
    )
  );
create policy slots_delete_owner on public.availability_slots for delete
  using (tenant_id in (select current_user_owner_tenant_ids()));
```

- [ ] **Step 3** — `npm run db:push` then `npm run db:types`.
- [ ] **Step 4** — Commit.

---

## Task 5: Conflict extraction helper with TDD

**Files:**
- `src/lib/conflicts.ts`
- `tests/unit/conflicts.test.ts`

- [ ] **Step 1** — Failing test `tests/unit/conflicts.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { isExclusionViolation } from '@/lib/conflicts'

describe('isExclusionViolation', () => {
  it('returns true for Postgres 23P01 errors', () => {
    expect(isExclusionViolation({ code: '23P01', message: 'conflicting key value violates exclusion constraint' })).toBe(true)
  })

  it('returns false for other errors', () => {
    expect(isExclusionViolation({ code: '23505', message: 'duplicate key' })).toBe(false)
    expect(isExclusionViolation(null)).toBe(false)
    expect(isExclusionViolation(undefined)).toBe(false)
    expect(isExclusionViolation({ message: 'random' })).toBe(false)
  })
})
```

- [ ] **Step 2** — Run `npm run test`, see fail.
- [ ] **Step 3** — Implement `src/lib/conflicts.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import type { ConflictSlot } from '@/lib/errors'

/** Postgres exclusion_violation = 23P01 */
export function isExclusionViolation(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const code = (err as { code?: string }).code
  return code === '23P01'
}

/**
 * Given a tenant member and a desired time range, find the slots that conflict.
 * Used after an EXCLUDE constraint violation to build a friendly error message.
 */
export async function findConflictingSlots(
  supabase: SupabaseClient<Database>,
  args: { memberId: string; startAt: string; endAt: string },
): Promise<ConflictSlot[]> {
  // Postgres operator && for tstzrange overlap; we approximate via two predicates
  const { data } = await supabase
    .from('availability_slots')
    .select('id, start_at, end_at, status, services(name)')
    .eq('member_id', args.memberId)
    .lt('start_at', args.endAt)
    .gt('end_at', args.startAt)
    .neq('status', 'cancelled')
  return (data ?? []).map((row) => ({
    id: row.id,
    startAt: row.start_at,
    endAt: row.end_at,
    serviceName: (row.services as { name: string } | null)?.name ?? undefined,
    hasBooking: row.status === 'pending' || row.status === 'booked',
    bookingId: null, // filled in Plan 4 when bookings exist
  }))
}
```

- [ ] **Step 4** — Tests green.
- [ ] **Step 5** — Commit.

---

## Task 6: Slot create / delete Server Actions

**Files:** `src/app/(tenant)/calendar/actions.ts`

- [ ] **Step 1** — Write:

```ts
'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { actionClient } from '@/lib/safe-action'
import { requireTenantMember } from '@/lib/auth/get-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AppError, SlotConflictError } from '@/lib/errors'
import { findConflictingSlots, isExclusionViolation } from '@/lib/conflicts'

const CreateSlotSchema = z.object({
  serviceId: z.string().uuid(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
})

export const createSlotAction = actionClient
  .inputSchema(CreateSlotSchema)
  .action(async ({ parsedInput }) => {
    const session = await requireTenantMember()
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase.from('availability_slots').insert({
      tenant_id: session.tenantId,
      member_id: session.memberId,
      service_id: parsedInput.serviceId,
      start_at: parsedInput.startAt,
      end_at: parsedInput.endAt,
      status: 'available',
    })
    if (error) {
      if (isExclusionViolation(error)) {
        const conflicts = await findConflictingSlots(supabase, {
          memberId: session.memberId,
          startAt: parsedInput.startAt,
          endAt: parsedInput.endAt,
        })
        throw new SlotConflictError(conflicts)
      }
      throw new AppError('SLOT_CREATE_FAILED', error.message)
    }
    revalidatePath('/calendar')
    return { ok: true }
  })

const DeleteSlotSchema = z.object({ id: z.string().uuid() })

export const deleteSlotAction = actionClient
  .inputSchema(DeleteSlotSchema)
  .action(async ({ parsedInput }) => {
    await requireTenantMember()
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase
      .from('availability_slots')
      .delete()
      .eq('id', parsedInput.id)
    if (error) throw new AppError('SLOT_DELETE_FAILED', error.message)
    revalidatePath('/calendar')
    return { ok: true }
  })
```

- [ ] **Step 2** — Typecheck. Commit.

---

## Task 7: Calendar week view (server-rendered)

**Files:**
- `src/app/(tenant)/calendar/page.tsx`
- `src/app/(tenant)/calendar/week-grid.tsx`
- Install: `date-fns`

- [ ] **Step 1** — Install: `npm install date-fns`
- [ ] **Step 2** — `page.tsx`:

```tsx
import Link from 'next/link'
import { addWeeks, endOfWeek, format, parseISO, startOfWeek, subWeeks } from 'date-fns'
import { requireTenantMember } from '@/lib/auth/get-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { buttonVariants } from '@/components/ui/button'
import WeekGrid from './week-grid'
import NewSlotDialog from './new-slot-dialog'

const TZ_OFFSET_HOURS = 8 // Asia/Taipei (single-tz MVP)

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>
}) {
  const session = await requireTenantMember()
  const params = await searchParams
  const anchor = params.week ? parseISO(params.week) : new Date()
  // Week starts Monday in zh-Hant convention
  const weekStart = startOfWeek(anchor, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(anchor, { weekStartsOn: 1 })

  const supabase = await createSupabaseServerClient()
  const { data: slots } = await supabase
    .from('availability_slots')
    .select('id, start_at, end_at, status, service_id, services(name)')
    .eq('member_id', session.memberId)
    .gte('start_at', weekStart.toISOString())
    .lte('start_at', weekEnd.toISOString())
    .order('start_at')

  const { data: services } = await supabase
    .from('services')
    .select('id, name, duration_minutes')
    .eq('is_active', true)
    .order('name')

  const prevWeek = format(subWeeks(weekStart, 1), 'yyyy-MM-dd')
  const nextWeek = format(addWeeks(weekStart, 1), 'yyyy-MM-dd')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">行事曆</h1>
        <NewSlotDialog services={services ?? []} weekStart={weekStart.toISOString()} />
      </div>
      <div className="flex items-center gap-3 text-sm">
        <Link href={`/calendar?week=${prevWeek}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          ◄
        </Link>
        <div className="min-w-48 text-center font-medium">
          {format(weekStart, 'yyyy/MM/dd')} – {format(weekEnd, 'MM/dd')}
        </div>
        <Link href={`/calendar?week=${nextWeek}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          ►
        </Link>
        <Link href="/calendar" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          回本週
        </Link>
      </div>

      <WeekGrid
        weekStart={weekStart}
        slots={(slots ?? []).map((s) => ({
          id: s.id,
          startAt: s.start_at,
          endAt: s.end_at,
          status: s.status as 'available' | 'pending' | 'booked' | 'cancelled',
          serviceName: (s.services as { name: string } | null)?.name ?? null,
        }))}
        tzOffsetHours={TZ_OFFSET_HOURS}
      />
    </div>
  )
}
```

- [ ] **Step 3** — `week-grid.tsx`:

```tsx
import { addDays, format } from 'date-fns'

type SlotDisplay = {
  id: string
  startAt: string
  endAt: string
  status: 'available' | 'pending' | 'booked' | 'cancelled'
  serviceName: string | null
}

const STATUS_BG: Record<SlotDisplay['status'], string> = {
  available: 'bg-blue-50 border-l-blue-500',
  pending: 'bg-amber-50 border-l-amber-500',
  booked: 'bg-emerald-50 border-l-emerald-500',
  cancelled: 'bg-slate-100 border-l-slate-400 opacity-60',
}

const HOURS = Array.from({ length: 14 }, (_, i) => i + 8) // 08:00 .. 21:00

export default function WeekGrid({
  weekStart,
  slots,
  tzOffsetHours,
}: {
  weekStart: Date
  slots: SlotDisplay[]
  tzOffsetHours: number
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const slotsByDay: Record<string, SlotDisplay[]> = {}
  for (const s of slots) {
    // Convert to display tz
    const utc = new Date(s.startAt)
    const local = new Date(utc.getTime() + tzOffsetHours * 60 * 60 * 1000)
    const key = local.toISOString().slice(0, 10)
    slotsByDay[key] = slotsByDay[key] ?? []
    slotsByDay[key].push(s)
  }

  return (
    <div className="overflow-x-auto rounded border bg-white">
      <div className="grid grid-cols-[60px_repeat(7,1fr)] gap-px bg-slate-200 text-xs">
        <div className="bg-white p-2" />
        {days.map((d) => (
          <div key={d.toISOString()} className="bg-white p-2 text-center font-medium">
            {format(d, 'EEE')}<br />
            {format(d, 'MM/dd')}
          </div>
        ))}
        {HOURS.map((h) => (
          <Row key={h} hour={h} days={days} slotsByDay={slotsByDay} tzOffsetHours={tzOffsetHours} />
        ))}
      </div>
    </div>
  )
}

function Row({
  hour,
  days,
  slotsByDay,
  tzOffsetHours,
}: {
  hour: number
  days: Date[]
  slotsByDay: Record<string, SlotDisplay[]>
  tzOffsetHours: number
}) {
  return (
    <>
      <div className="bg-white p-2 text-right text-slate-500">
        {String(hour).padStart(2, '0')}:00
      </div>
      {days.map((d) => {
        const key = format(d, 'yyyy-MM-dd')
        const cellSlots = (slotsByDay[key] ?? []).filter((s) => {
          const utc = new Date(s.startAt)
          const local = new Date(utc.getTime() + tzOffsetHours * 60 * 60 * 1000)
          return local.getUTCHours() === hour
        })
        return (
          <div key={key + hour} className="bg-white p-1 min-h-12">
            {cellSlots.map((s) => (
              <div
                key={s.id}
                className={`text-[10px] px-1 py-0.5 border-l-2 rounded-sm mb-0.5 ${STATUS_BG[s.status]}`}
                title={`${s.serviceName ?? ''} ${format(new Date(new Date(s.startAt).getTime() + tzOffsetHours * 3600 * 1000), 'HH:mm')}-${format(new Date(new Date(s.endAt).getTime() + tzOffsetHours * 3600 * 1000), 'HH:mm')}`}
              >
                {s.serviceName ?? '時段'}
              </div>
            ))}
          </div>
        )
      })}
    </>
  )
}
```

- [ ] **Step 4** — Build to verify.

---

## Task 8: New-slot dialog (client)

**Files:** `src/app/(tenant)/calendar/new-slot-dialog.tsx`

- [ ] **Step 1**:

```tsx
'use client'

import { useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
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
import { createSlotAction } from './actions'

type Service = { id: string; name: string; duration_minutes: number }

export default function NewSlotDialog({
  services,
  weekStart,
}: {
  services: Service[]
  weekStart: string
}) {
  const defaultDate = weekStart.slice(0, 10)
  const [open, setOpen] = useState(false)
  const [serviceId, setServiceId] = useState(services[0]?.id ?? '')
  const [date, setDate] = useState(defaultDate)
  const [startTime, setStartTime] = useState('19:00')
  const [endTime, setEndTime] = useState('20:00')
  const [conflicts, setConflicts] = useState<
    { id: string; startAt: string; endAt: string; serviceName?: string }[]
  >([])

  const { execute, isPending } = useAction(createSlotAction, {
    onSuccess: () => {
      toast.success('已新增時段')
      setConflicts([])
      setOpen(false)
    },
    onError: ({ error }) => {
      const code = error.serverError?.code
      if (code === 'SLOT_CONFLICT') {
        setConflicts((error.serverError?.details ?? []) as never)
        toast.error('與既有時段衝突')
      } else {
        toast.error(error.serverError?.message ?? '新增失敗')
      }
    },
  })

  function submit() {
    // Build ISO with Asia/Taipei offset
    const startAt = `${date}T${startTime}:00+08:00`
    const endAt = `${date}T${endTime}:00+08:00`
    execute({ serviceId, startAt: new Date(startAt).toISOString(), endAt: new Date(endAt).toISOString() })
  }

  if (services.length === 0) {
    return (
      <Button disabled title="請先新增服務">
        + 新增時段
      </Button>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>+ 新增時段</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新增可預約時段</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="service">服務</Label>
            <select
              id="service"
              className="w-full rounded border p-2 text-sm"
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
            >
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.duration_minutes} 分)
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="date">日期</Label>
            <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="start">開始</Label>
              <Input
                id="start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end">結束</Label>
              <Input
                id="end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>
          {conflicts.length > 0 && (
            <div className="rounded border border-red-300 bg-red-50 p-3 text-xs">
              <p className="mb-2 font-semibold text-red-700">與以下時段衝突：</p>
              <ul className="space-y-1">
                {conflicts.map((c) => (
                  <li key={c.id}>
                    {new Date(c.startAt).toLocaleString('zh-TW')} —{' '}
                    {new Date(c.endAt).toLocaleString('zh-TW')}
                    {c.serviceName ? ` (${c.serviceName})` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button onClick={submit} disabled={isPending}>
            {isPending ? '新增中...' : '新增'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2** — Build + commit.

---

## Task 9: EXCLUDE integration test

**Files:** `tests/integration/exclude-constraint.test.ts`

- [ ] **Step 1**:

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

const ctx: {
  userId?: string
  tenantId?: string
  memberId?: string
  serviceId?: string
} = {}

describe('availability_slots EXCLUDE constraint', () => {
  beforeAll(async () => {
    const ts = Date.now()
    const { data: user } = await admin.auth.admin.createUser({
      email: `excl-${ts}@example.com`,
      password: 'TestPass123!',
      email_confirm: true,
    })
    ctx.userId = user!.user!.id
    const { data: tenant } = await admin
      .from('tenants')
      .insert({ slug: `excl-${ts}`, name: 'EXCL test' })
      .select()
      .single()
    ctx.tenantId = tenant!.id
    const { data: member } = await admin
      .from('tenant_members')
      .insert({ tenant_id: tenant!.id, user_id: user!.user!.id, role: 'owner', status: 'active' })
      .select()
      .single()
    ctx.memberId = member!.id
    const { data: svc } = await admin
      .from('services')
      .insert({ tenant_id: tenant!.id, name: 'svc', duration_minutes: 60 })
      .select()
      .single()
    ctx.serviceId = svc!.id
  }, 30_000)

  afterAll(async () => {
    if (ctx.tenantId) await admin.from('tenants').delete().eq('id', ctx.tenantId)
    if (ctx.userId) await admin.auth.admin.deleteUser(ctx.userId)
  }, 30_000)

  it('allows non-overlapping slots', async () => {
    const { error: a } = await admin.from('availability_slots').insert({
      tenant_id: ctx.tenantId!,
      member_id: ctx.memberId!,
      service_id: ctx.serviceId!,
      start_at: '2026-06-01T08:00:00Z',
      end_at: '2026-06-01T09:00:00Z',
    })
    expect(a).toBeNull()
    const { error: b } = await admin.from('availability_slots').insert({
      tenant_id: ctx.tenantId!,
      member_id: ctx.memberId!,
      service_id: ctx.serviceId!,
      start_at: '2026-06-01T09:00:00Z',
      end_at: '2026-06-01T10:00:00Z',
    })
    expect(b).toBeNull()
  })

  it('rejects overlapping slot with 23P01', async () => {
    const { error } = await admin.from('availability_slots').insert({
      tenant_id: ctx.tenantId!,
      member_id: ctx.memberId!,
      service_id: ctx.serviceId!,
      start_at: '2026-06-01T08:30:00Z',
      end_at: '2026-06-01T09:30:00Z',
    })
    expect(error).not.toBeNull()
    expect(error?.code).toBe('23P01')
  })
})
```

- [ ] **Step 2** — `npm run test:integration` → 2 tests pass.
- [ ] **Step 3** — Commit.

---

## Task 10: Push + verify

- [ ] All commits pushed; CI green; Vercel preview deploys.
- [ ] Manual smoke test: tenant owner creates service, then creates two non-overlapping slots, then tries to create a third overlapping slot and sees the conflict modal.
- [ ] Tag: `git tag -a plan-2-services-and-calendar -m "Plan 2 complete"`.

---

## Self-Review

- Spec mapping: §4.2 (services CRUD) ✓ via Tasks 2-3. §4.3 FR-020/026/027/028 (single slot + EXCLUDE + structured conflict) ✓ via Tasks 4-6, 8. §9.3 (conflict detection algorithm) ✓ via Task 5 + 6.
- Deferred: batch/recurring (Plan 3), conflict-jump UI (Plan 3), bookings (Plan 4).
- All types match across tasks (Service shape consistent, ConflictSlot from `lib/errors`).
- No placeholders, all code blocks complete.
