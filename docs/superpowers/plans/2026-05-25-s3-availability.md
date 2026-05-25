# S3 — Availability + Unavailable Events Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 引入作息模板（per-member、weekly windows、多版本切換）、unavailable events（任意時間區段不可用）、與「effective availability」純函式，並把這套限制套到 slot 建立、recurring rule 建立與 cron materialize 三條寫入路徑。/calendar 主畫面對撞 event 的 slot 顯示警示徽章。林教練 seed 補齊以演示新功能。

**Architecture:** 四張新表（templates / windows / assignments / unavailable_events）+ 一支純函式 `effectiveAvailability` + 一支 DB-aware helper `validateInEffectiveRange`。寫入路徑（createSlot / createRecurringRule / cron）呼叫 helper 過濾；讀取路徑（公開頁）不改 — 既有 slot 是已過濾結果。新增 `/calendar/availability` segment 給教練管理模板與 events。

**Tech Stack:** Next.js 15 App Router, TypeScript strict, Supabase (PostgreSQL + RLS), Vitest (unit + integration), next-safe-action + Zod, Tailwind + shadcn/ui (base-ui), date-fns.

**Spec reference:** [`docs/superpowers/specs/2026-05-25-s3-availability-design.md`](../specs/2026-05-25-s3-availability-design.md)

**Out of scope:** 公開頁 date strip 灰底「休」、模板 → recurring rule 自動產生、撞 event 自動取消 booking、Owner 代 staff 改模板的 UI、Holiday API、設計系統。

---

## File Map

**Create**

- `supabase/migrations/20260525100000_availability_templates_schema.sql`
- `supabase/migrations/20260525100001_availability_templates_rls.sql`
- `supabase/migrations/20260525100002_unavailable_events_schema.sql`
- `supabase/migrations/20260525100003_unavailable_events_rls.sql`
- `src/lib/availability.ts` — `Range`, `TemplateWindow`, `subtractRanges`, `effectiveAvailability` 純函式
- `src/lib/availability-server.ts` — `validateInEffectiveRange`、`fetchActiveTemplate`、`fetchUnavailableEvents`（DB-aware）
- `tests/unit/availability.test.ts` — `subtractRanges` + `effectiveAvailability` TDD
- `src/app/(tenant)/calendar/availability/page.tsx`
- `src/app/(tenant)/calendar/availability/loading.tsx`
- `src/app/(tenant)/calendar/availability/actions.ts` — createTemplate / updateWindows / rename / deleteTemplate / assignTemplate
- `src/app/(tenant)/calendar/availability/unavailable-actions.ts` — createEvent / deleteEvent
- `src/app/(tenant)/calendar/availability/templates-section.tsx` — server component
- `src/app/(tenant)/calendar/availability/template-editor.tsx` — client component (dialog)
- `src/app/(tenant)/calendar/availability/events-section.tsx` — server component
- `src/app/(tenant)/calendar/availability/unavailable-event-dialog.tsx` — client component
- `src/app/(tenant)/calendar/availability/effective-preview.tsx` — server component (next 2 weeks mini calendar)

**Modify**

- `src/lib/supabase/types.ts` — regenerate after migration
- `src/app/(tenant)/sidebar-nav.tsx` — 加「可用時段」連結
- `src/app/(tenant)/calendar/actions.ts` — createSlotAction 開頭加 `validateInEffectiveRange`
- `src/app/(tenant)/calendar/recurring-actions.ts` — `toInsert` 過濾掉超界 occurrences；return `skippedAvailability` 計數
- `src/app/api/cron/materialize-recurring/route.ts` — occurrence filter
- `src/app/(tenant)/calendar/page.tsx` — 多查 unavailable_events、passed down
- `src/app/(tenant)/calendar/calendar-panel.tsx` — receive `unavailableEvents` prop
- `src/app/(tenant)/calendar/week-grid.tsx` — slot 撞 event 顯示 ⚠ 徽章
- `src/app/(tenant)/calendar/list-view.tsx` — 同上
- `src/app/(tenant)/calendar/slot-popover.tsx` — 撞 event 顯示衝突提示
- `scripts/seed-test-data.mjs` — 林 + 阿明模板 + rule + events
- `README.md` — 路由地圖加 `/calendar/availability`、加可用時段一節
- `docs/superpowers/specs/2026-05-21-quickreserve-redesign-design.md` 附錄 C — 加 FR-120~124

---

## Conventions

- 直接在 `master` 分支工作（專案慣例）
- 每 task 收尾 commit 一次，HEREDOC commit message，末尾掛 `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`
- Pure function 走 TDD（Tasks 1-2）
- 改 schema 需 `npx supabase db push` 推 Supabase；產 types `npm run db:types`
- 各 task 跑 `npm run typecheck` + `npm run build` 作為機器驗證
- 不 push origin 直到最後一個 task；最後一次 push 後等 Vercel READY

---

## Task 1: `subtractRanges` pure function (TDD)

**Files:**
- Create: `src/lib/availability.ts` (partial — types + subtractRanges)
- Create: `tests/unit/availability.test.ts` (subtractRanges test block)

- [ ] **Step 1: 寫失敗測試**

`tests/unit/availability.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { subtractRanges, type Range } from '@/lib/availability'

const r = (start: string, end: string): Range => ({
  start: new Date(start),
  end: new Date(end),
})

describe('subtractRanges', () => {
  it('returns base when no cuts', () => {
    const base = [r('2026-05-25T09:00:00Z', '2026-05-25T17:00:00Z')]
    expect(subtractRanges(base, [])).toEqual(base)
  })

  it('returns [] when cut fully covers base', () => {
    const base = [r('2026-05-25T09:00:00Z', '2026-05-25T17:00:00Z')]
    const cuts = [r('2026-05-25T08:00:00Z', '2026-05-25T18:00:00Z')]
    expect(subtractRanges(base, cuts)).toEqual([])
  })

  it('cuts middle of base into two ranges', () => {
    const base = [r('2026-05-25T09:00:00Z', '2026-05-25T17:00:00Z')]
    const cuts = [r('2026-05-25T12:00:00Z', '2026-05-25T13:00:00Z')]
    expect(subtractRanges(base, cuts)).toEqual([
      r('2026-05-25T09:00:00Z', '2026-05-25T12:00:00Z'),
      r('2026-05-25T13:00:00Z', '2026-05-25T17:00:00Z'),
    ])
  })

  it('clips leading edge', () => {
    const base = [r('2026-05-25T09:00:00Z', '2026-05-25T17:00:00Z')]
    const cuts = [r('2026-05-25T08:00:00Z', '2026-05-25T10:00:00Z')]
    expect(subtractRanges(base, cuts)).toEqual([r('2026-05-25T10:00:00Z', '2026-05-25T17:00:00Z')])
  })

  it('clips trailing edge', () => {
    const base = [r('2026-05-25T09:00:00Z', '2026-05-25T17:00:00Z')]
    const cuts = [r('2026-05-25T16:00:00Z', '2026-05-25T18:00:00Z')]
    expect(subtractRanges(base, cuts)).toEqual([r('2026-05-25T09:00:00Z', '2026-05-25T16:00:00Z')])
  })

  it('handles multiple cuts in sequence', () => {
    const base = [r('2026-05-25T09:00:00Z', '2026-05-25T17:00:00Z')]
    const cuts = [
      r('2026-05-25T10:00:00Z', '2026-05-25T11:00:00Z'),
      r('2026-05-25T14:00:00Z', '2026-05-25T15:00:00Z'),
    ]
    expect(subtractRanges(base, cuts)).toEqual([
      r('2026-05-25T09:00:00Z', '2026-05-25T10:00:00Z'),
      r('2026-05-25T11:00:00Z', '2026-05-25T14:00:00Z'),
      r('2026-05-25T15:00:00Z', '2026-05-25T17:00:00Z'),
    ])
  })

  it('handles two separate base windows', () => {
    const base = [
      r('2026-05-25T09:00:00Z', '2026-05-25T12:00:00Z'),
      r('2026-05-25T14:00:00Z', '2026-05-25T17:00:00Z'),
    ]
    const cuts = [r('2026-05-25T10:00:00Z', '2026-05-25T15:00:00Z')]
    expect(subtractRanges(base, cuts)).toEqual([
      r('2026-05-25T09:00:00Z', '2026-05-25T10:00:00Z'),
      r('2026-05-25T15:00:00Z', '2026-05-25T17:00:00Z'),
    ])
  })

  it('non-overlapping cut leaves base intact', () => {
    const base = [r('2026-05-25T09:00:00Z', '2026-05-25T12:00:00Z')]
    const cuts = [r('2026-05-25T14:00:00Z', '2026-05-25T15:00:00Z')]
    expect(subtractRanges(base, cuts)).toEqual(base)
  })
})
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npm run test -- tests/unit/availability.test.ts`
Expected: FAIL — module not found `@/lib/availability`

- [ ] **Step 3: 實作最小通過**

`src/lib/availability.ts`:

```ts
export type Range = { start: Date; end: Date }

export type TemplateWindow = {
  weekday: number // ISO 1=Mon..7=Sun
  start_time: string // 'HH:MM' or 'HH:MM:SS'
  end_time: string
}

export function subtractRanges(base: Range[], cuts: Range[]): Range[] {
  let result = base.slice()
  for (const cut of cuts) {
    const next: Range[] = []
    for (const piece of result) {
      // No overlap
      if (cut.end <= piece.start || cut.start >= piece.end) {
        next.push(piece)
        continue
      }
      // Cut covers entire piece — drop it
      if (cut.start <= piece.start && cut.end >= piece.end) {
        continue
      }
      // Leading portion survives
      if (cut.start > piece.start) {
        next.push({ start: piece.start, end: cut.start })
      }
      // Trailing portion survives
      if (cut.end < piece.end) {
        next.push({ start: cut.end, end: piece.end })
      }
    }
    result = next
  }
  return result
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npm run test -- tests/unit/availability.test.ts`
Expected: 8 tests PASS (subtractRanges block)

- [ ] **Step 5: typecheck**

Run: `npm run typecheck`
Expected: no errors

- [ ] **Step 6: commit**

```bash
git add src/lib/availability.ts tests/unit/availability.test.ts
git commit -m "$(cat <<'EOF'
feat(s3): subtractRanges pure function (FR-122 part)

Set subtraction for time ranges — used by effectiveAvailability to
remove unavailable_events from a template's daily windows. Eight test
cases cover full cover, partial cover (leading/trailing/middle), and
multi-base / multi-cut combinations.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `effectiveAvailability` pure function (TDD)

**Files:**
- Modify: `src/lib/availability.ts` (add `effectiveAvailability` + helpers)
- Modify: `tests/unit/availability.test.ts` (add effectiveAvailability test block)

- [ ] **Step 1: 寫失敗測試**

Append to `tests/unit/availability.test.ts`:

```ts
import { effectiveAvailability } from '@/lib/availability'

const TZ_OFFSET_HOURS = 8

// helper: build a Date at given Taipei local time
const tpe = (yyyymmdd: string, hhmm: string): Date => {
  return new Date(`${yyyymmdd}T${hhmm}:00+08:00`)
}

describe('effectiveAvailability', () => {
  it('returns full day when no active template', () => {
    const date = tpe('2026-05-25', '12:00') // 2026-05-25 (Mon) in Taipei
    const result = effectiveAvailability({
      date,
      activeTemplate: null,
      unavailableEvents: [],
      tzOffsetHours: TZ_OFFSET_HOURS,
    })
    expect(result).toHaveLength(1)
    expect(result[0]!.start.toISOString()).toBe('2026-05-24T16:00:00.000Z') // Taipei 00:00 = UTC 16:00 previous day
    expect(result[0]!.end.toISOString()).toBe('2026-05-25T16:00:00.000Z')
  })

  it('uses windows matching weekday from template', () => {
    const date = tpe('2026-05-25', '12:00') // Mon
    const result = effectiveAvailability({
      date,
      activeTemplate: {
        windows: [
          { weekday: 1, start_time: '09:00', end_time: '12:00' },
          { weekday: 1, start_time: '14:00', end_time: '17:00' },
          { weekday: 2, start_time: '09:00', end_time: '17:00' }, // Tue — should be ignored
        ],
      },
      unavailableEvents: [],
      tzOffsetHours: TZ_OFFSET_HOURS,
    })
    expect(result).toHaveLength(2)
    expect(result[0]!.start).toEqual(tpe('2026-05-25', '09:00'))
    expect(result[0]!.end).toEqual(tpe('2026-05-25', '12:00'))
    expect(result[1]!.start).toEqual(tpe('2026-05-25', '14:00'))
    expect(result[1]!.end).toEqual(tpe('2026-05-25', '17:00'))
  })

  it('returns empty array when weekday has no windows', () => {
    const date = tpe('2026-05-30', '12:00') // Sat (ISO weekday 6)
    const result = effectiveAvailability({
      date,
      activeTemplate: {
        windows: [{ weekday: 1, start_time: '09:00', end_time: '17:00' }],
      },
      unavailableEvents: [],
      tzOffsetHours: TZ_OFFSET_HOURS,
    })
    expect(result).toEqual([])
  })

  it('subtracts unavailable events from template windows', () => {
    const date = tpe('2026-05-25', '12:00') // Mon
    const result = effectiveAvailability({
      date,
      activeTemplate: {
        windows: [{ weekday: 1, start_time: '09:00', end_time: '17:00' }],
      },
      unavailableEvents: [
        { start: tpe('2026-05-25', '14:00'), end: tpe('2026-05-25', '15:00') },
      ],
      tzOffsetHours: TZ_OFFSET_HOURS,
    })
    expect(result).toEqual([
      { start: tpe('2026-05-25', '09:00'), end: tpe('2026-05-25', '14:00') },
      { start: tpe('2026-05-25', '15:00'), end: tpe('2026-05-25', '17:00') },
    ])
  })

  it('handles ISO weekday 7 (Sunday)', () => {
    const date = tpe('2026-05-31', '12:00') // Sun
    const result = effectiveAvailability({
      date,
      activeTemplate: {
        windows: [{ weekday: 7, start_time: '10:00', end_time: '14:00' }],
      },
      unavailableEvents: [],
      tzOffsetHours: TZ_OFFSET_HOURS,
    })
    expect(result).toHaveLength(1)
    expect(result[0]!.start).toEqual(tpe('2026-05-31', '10:00'))
    expect(result[0]!.end).toEqual(tpe('2026-05-31', '14:00'))
  })

  it('event spanning past midnight is clipped to current day only', () => {
    const date = tpe('2026-05-25', '12:00')
    const result = effectiveAvailability({
      date,
      activeTemplate: {
        windows: [{ weekday: 1, start_time: '00:00', end_time: '23:59' }],
      },
      unavailableEvents: [
        // Sunday 22:00 → Monday 02:00 — should only cut Mon 00:00 → 02:00
        { start: tpe('2026-05-24', '22:00'), end: tpe('2026-05-25', '02:00') },
      ],
      tzOffsetHours: TZ_OFFSET_HOURS,
    })
    // First survivor starts at Monday 02:00
    expect(result[0]!.start).toEqual(tpe('2026-05-25', '02:00'))
  })
})
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npm run test -- tests/unit/availability.test.ts`
Expected: FAIL — `effectiveAvailability` not exported

- [ ] **Step 3: 實作 `effectiveAvailability` + helpers**

Append to `src/lib/availability.ts`:

```ts
function isoWeekday(date: Date, tzOffsetHours: number): number {
  const shifted = new Date(date.getTime() + tzOffsetHours * 3600 * 1000)
  const jsDay = shifted.getUTCDay() // 0=Sun..6=Sat
  return ((jsDay + 6) % 7) + 1 // 1=Mon..7=Sun
}

function localDayStart(date: Date, tzOffsetHours: number): Date {
  const shifted = new Date(date.getTime() + tzOffsetHours * 3600 * 1000)
  const y = shifted.getUTCFullYear()
  const m = shifted.getUTCMonth()
  const d = shifted.getUTCDate()
  // Reconstruct as UTC midnight then shift back by tz offset to get local midnight as UTC
  return new Date(Date.UTC(y, m, d) - tzOffsetHours * 3600 * 1000)
}

function applyWindow(dayStart: Date, time: string, tzOffsetHours: number): Date {
  const [h, m] = time.split(':').map(Number) as [number, number]
  return new Date(dayStart.getTime() + (h * 60 + m) * 60 * 1000)
}

export function effectiveAvailability(args: {
  date: Date
  activeTemplate: { windows: TemplateWindow[] } | null
  unavailableEvents: Range[]
  tzOffsetHours: number
}): Range[] {
  const { date, activeTemplate, unavailableEvents, tzOffsetHours } = args
  const dayStart = localDayStart(date, tzOffsetHours)
  const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000)

  let base: Range[]
  if (activeTemplate === null) {
    base = [{ start: dayStart, end: dayEnd }]
  } else {
    const weekday = isoWeekday(date, tzOffsetHours)
    base = activeTemplate.windows
      .filter((w) => w.weekday === weekday)
      .map((w) => ({
        start: applyWindow(dayStart, w.start_time, tzOffsetHours),
        end: applyWindow(dayStart, w.end_time, tzOffsetHours),
      }))
      .sort((a, b) => a.start.getTime() - b.start.getTime())
  }

  if (base.length === 0) return []

  const cuts = unavailableEvents
    .filter((e) => e.end > dayStart && e.start < dayEnd)
    .map((e) => ({
      start: e.start < dayStart ? dayStart : e.start,
      end: e.end > dayEnd ? dayEnd : e.end,
    }))

  return subtractRanges(base, cuts)
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npm run test -- tests/unit/availability.test.ts`
Expected: 14 tests PASS total (8 subtractRanges + 6 effectiveAvailability)

- [ ] **Step 5: typecheck**

Run: `npm run typecheck`
Expected: no errors

- [ ] **Step 6: commit**

```bash
git add src/lib/availability.ts tests/unit/availability.test.ts
git commit -m "$(cat <<'EOF'
feat(s3): effectiveAvailability pure function (FR-122)

Composes template windows + unavailable_events into the actual available
ranges for a given local day. Null template = unconstrained (full day);
empty windows for weekday = day off. Six test cases cover the matrix:
no template, weekday match, weekday miss, event subtraction, ISO weekday
7 (Sunday), and event clipping at midnight boundary.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Migrations — 4 SQL files (schema + RLS)

**Files (Create):**
- `supabase/migrations/20260525100000_availability_templates_schema.sql`
- `supabase/migrations/20260525100001_availability_templates_rls.sql`
- `supabase/migrations/20260525100002_unavailable_events_schema.sql`
- `supabase/migrations/20260525100003_unavailable_events_rls.sql`

- [ ] **Step 1: 寫 templates schema**

`supabase/migrations/20260525100000_availability_templates_schema.sql`:

```sql
-- 作息模板：教練 / 助教設定每週固定可上課時段
create table public.availability_templates (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.tenant_members(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_availability_templates_member on public.availability_templates(member_id);

-- 模板每週時段（多 row × weekday × 多段；不列出 = 該日休）
create table public.availability_template_windows (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.availability_templates(id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),  -- ISO 1=Mon..7=Sun
  start_time time not null,
  end_time time not null check (end_time > start_time)
);
create index idx_template_windows_template on public.availability_template_windows(template_id);

-- 模板生效歷史（時間軸 versioning）
create table public.availability_template_assignments (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.tenant_members(id) on delete cascade,
  template_id uuid not null references public.availability_templates(id) on delete restrict,
  effective_from date not null,
  created_at timestamptz not null default now()
);
create index idx_template_assignments_member_effective on
  public.availability_template_assignments(member_id, effective_from desc);
```

- [ ] **Step 2: 寫 templates RLS**

`supabase/migrations/20260525100001_availability_templates_rls.sql`:

```sql
alter table public.availability_templates enable row level security;
alter table public.availability_template_windows enable row level security;
alter table public.availability_template_assignments enable row level security;

-- templates: member can CRUD own; tenant owner can CRUD any in their tenant
create policy templates_select_member on public.availability_templates for select
  using (
    member_id in (
      select id from public.tenant_members
      where user_id = auth.uid() and status = 'active'
    )
  );

create policy templates_select_owner on public.availability_templates for select
  using (
    member_id in (
      select id from public.tenant_members
      where tenant_id in (select current_user_owner_tenant_ids())
    )
  );

create policy templates_select_admin on public.availability_templates for select
  using (is_platform_admin());

create policy templates_modify_member on public.availability_templates for all
  using (
    member_id in (
      select id from public.tenant_members
      where user_id = auth.uid() and status = 'active'
    )
  )
  with check (
    member_id in (
      select id from public.tenant_members
      where user_id = auth.uid() and status = 'active'
    )
  );

create policy templates_modify_owner on public.availability_templates for all
  using (
    member_id in (
      select id from public.tenant_members
      where tenant_id in (select current_user_owner_tenant_ids())
    )
  )
  with check (
    member_id in (
      select id from public.tenant_members
      where tenant_id in (select current_user_owner_tenant_ids())
    )
  );

-- template_windows: follow parent template
create policy template_windows_select on public.availability_template_windows for select
  using (
    template_id in (
      select id from public.availability_templates
    )
  );

create policy template_windows_modify_member on public.availability_template_windows for all
  using (
    template_id in (
      select id from public.availability_templates
      where member_id in (
        select id from public.tenant_members
        where user_id = auth.uid() and status = 'active'
      )
    )
  )
  with check (
    template_id in (
      select id from public.availability_templates
      where member_id in (
        select id from public.tenant_members
        where user_id = auth.uid() and status = 'active'
      )
    )
  );

create policy template_windows_modify_owner on public.availability_template_windows for all
  using (
    template_id in (
      select id from public.availability_templates
      where member_id in (
        select id from public.tenant_members
        where tenant_id in (select current_user_owner_tenant_ids())
      )
    )
  )
  with check (
    template_id in (
      select id from public.availability_templates
      where member_id in (
        select id from public.tenant_members
        where tenant_id in (select current_user_owner_tenant_ids())
      )
    )
  );

-- assignments: same pattern (member or owner of their tenant)
create policy assignments_select_member on public.availability_template_assignments for select
  using (
    member_id in (
      select id from public.tenant_members
      where user_id = auth.uid() and status = 'active'
    )
  );

create policy assignments_select_owner on public.availability_template_assignments for select
  using (
    member_id in (
      select id from public.tenant_members
      where tenant_id in (select current_user_owner_tenant_ids())
    )
  );

create policy assignments_select_admin on public.availability_template_assignments for select
  using (is_platform_admin());

create policy assignments_modify_member on public.availability_template_assignments for all
  using (
    member_id in (
      select id from public.tenant_members
      where user_id = auth.uid() and status = 'active'
    )
  )
  with check (
    member_id in (
      select id from public.tenant_members
      where user_id = auth.uid() and status = 'active'
    )
  );

create policy assignments_modify_owner on public.availability_template_assignments for all
  using (
    member_id in (
      select id from public.tenant_members
      where tenant_id in (select current_user_owner_tenant_ids())
    )
  )
  with check (
    member_id in (
      select id from public.tenant_members
      where tenant_id in (select current_user_owner_tenant_ids())
    )
  );
```

- [ ] **Step 3: 寫 events schema**

`supabase/migrations/20260525100002_unavailable_events_schema.sql`:

```sql
-- 不可用事件：教練 / 助教任意時間區段不可用
create table public.unavailable_events (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.tenant_members(id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null check (end_at > start_at),
  reason text,
  created_at timestamptz not null default now()
);
create index idx_unavailable_events_member_range on
  public.unavailable_events(member_id, start_at, end_at);
```

- [ ] **Step 4: 寫 events RLS**

`supabase/migrations/20260525100003_unavailable_events_rls.sql`:

```sql
alter table public.unavailable_events enable row level security;

-- Member can read/write own; tenant owners read/write any in their tenant
create policy events_select_member on public.unavailable_events for select
  using (
    member_id in (
      select id from public.tenant_members
      where user_id = auth.uid() and status = 'active'
    )
  );

create policy events_select_owner on public.unavailable_events for select
  using (
    member_id in (
      select id from public.tenant_members
      where tenant_id in (select current_user_owner_tenant_ids())
    )
  );

create policy events_select_admin on public.unavailable_events for select
  using (is_platform_admin());

create policy events_modify_member on public.unavailable_events for all
  using (
    member_id in (
      select id from public.tenant_members
      where user_id = auth.uid() and status = 'active'
    )
  )
  with check (
    member_id in (
      select id from public.tenant_members
      where user_id = auth.uid() and status = 'active'
    )
  );

create policy events_modify_owner on public.unavailable_events for all
  using (
    member_id in (
      select id from public.tenant_members
      where tenant_id in (select current_user_owner_tenant_ids())
    )
  )
  with check (
    member_id in (
      select id from public.tenant_members
      where tenant_id in (select current_user_owner_tenant_ids())
    )
  );
```

- [ ] **Step 5: 推 migrations 到 Supabase**

Run: `npm run db:push`
Expected: 4 migrations applied successfully

- [ ] **Step 6: 重新產生 types**

Run: `npm run db:types`
Expected: `src/lib/supabase/types.ts` updated with the 4 new tables

- [ ] **Step 7: typecheck**

Run: `npm run typecheck`
Expected: no errors

- [ ] **Step 8: commit**

```bash
git add supabase/migrations/20260525100000_availability_templates_schema.sql supabase/migrations/20260525100001_availability_templates_rls.sql supabase/migrations/20260525100002_unavailable_events_schema.sql supabase/migrations/20260525100003_unavailable_events_rls.sql src/lib/supabase/types.ts
git commit -m "$(cat <<'EOF'
feat(s3): availability templates + unavailable events schema (FR-120/121)

Four new tables: availability_templates (named container),
availability_template_windows (weekly slot definitions, multi-row per
day), availability_template_assignments (time-axis versioning of which
template is active), and unavailable_events (per-member time range
blocks). RLS allows member self-CRUD; tenant owner can manage any
member in their tenant; admin select. Schema is additive — no changes
to availability_slots.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `availability-server.ts` helper

**Files:**
- Create: `src/lib/availability-server.ts`

- [ ] **Step 1: 寫 helper**

`src/lib/availability-server.ts`:

```ts
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { effectiveAvailability, type Range, type TemplateWindow } from './availability'
import type { Database } from './supabase/types'

const TZ_OFFSET_HOURS = 8

type Client = SupabaseClient<Database>

export async function fetchActiveTemplate(
  supabase: Client,
  memberId: string,
  asOf: Date,
): Promise<{ windows: TemplateWindow[] } | null> {
  const asOfDate = new Date(asOf.getTime() + TZ_OFFSET_HOURS * 3600 * 1000)
    .toISOString()
    .slice(0, 10)

  const { data: assignment } = await supabase
    .from('availability_template_assignments')
    .select('template_id')
    .eq('member_id', memberId)
    .lte('effective_from', asOfDate)
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!assignment) return null

  const { data: windows } = await supabase
    .from('availability_template_windows')
    .select('weekday, start_time, end_time')
    .eq('template_id', assignment.template_id)

  return { windows: (windows ?? []) as TemplateWindow[] }
}

export async function fetchUnavailableEvents(
  supabase: Client,
  memberId: string,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<Range[]> {
  const { data } = await supabase
    .from('unavailable_events')
    .select('start_at, end_at')
    .eq('member_id', memberId)
    .lt('start_at', rangeEnd.toISOString())
    .gt('end_at', rangeStart.toISOString())

  return (data ?? []).map((e) => ({
    start: new Date(e.start_at),
    end: new Date(e.end_at),
  }))
}

/**
 * Returns true if [startAt, endAt] is fully covered by an active-template
 * window AND does not overlap any unavailable_event. Null template = no
 * constraint = always true.
 */
export async function validateInEffectiveRange(
  supabase: Client,
  memberId: string,
  startAt: Date,
  endAt: Date,
): Promise<boolean> {
  const template = await fetchActiveTemplate(supabase, memberId, startAt)
  if (!template) return true // unconstrained

  const events = await fetchUnavailableEvents(supabase, memberId, startAt, endAt)
  const effective = effectiveAvailability({
    date: startAt,
    activeTemplate: template,
    unavailableEvents: events,
    tzOffsetHours: TZ_OFFSET_HOURS,
  })

  // The slot must be FULLY contained in at least one effective range
  return effective.some((r) => r.start <= startAt && r.end >= endAt)
}
```

- [ ] **Step 2: typecheck**

Run: `npm run typecheck`
Expected: no errors

- [ ] **Step 3: commit**

```bash
git add src/lib/availability-server.ts
git commit -m "$(cat <<'EOF'
feat(s3): availability-server helper for DB-aware validation

Three exports: fetchActiveTemplate, fetchUnavailableEvents,
validateInEffectiveRange. The validator returns true when no template
is active (unconstrained behavior preserved). When constrained, the
slot must be FULLY contained in at least one effective range. Used by
createSlot, createRecurringRule, and the materialize-recurring cron.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `/calendar/availability` segment scaffold

**Files:**
- Create: `src/app/(tenant)/calendar/availability/page.tsx`
- Create: `src/app/(tenant)/calendar/availability/loading.tsx`
- Modify: `src/app/(tenant)/sidebar-nav.tsx`

- [ ] **Step 1: 加 sidebar 連結**

`src/app/(tenant)/sidebar-nav.tsx`:
- Add `CalendarClock` to lucide imports
- Add new item under `/calendar` route. Replace the items array to:

```tsx
const items: Item[] = [
  { href: '/dashboard', label: '儀表板', icon: LayoutDashboard },
  { href: '/calendar', label: '行事曆', icon: Calendar },
  { href: '/calendar/availability', label: '可用時段', icon: CalendarClock },
  { href: '/bookings', label: '預約管理', icon: ClipboardList },
  { href: '/customers', label: '學員', icon: Contact },
  { href: '/services', label: '服務項目', icon: Package },
  ...(isOwner ? [{ href: '/staff', label: '助教管理', icon: Users }] : []),
  ...(isOwner ? [{ href: '/settings/profile', label: '租戶資料', icon: UserCog }] : []),
  { href: '/notifications', label: '通知設定', icon: Settings },
]
```

The `CalendarClock` import goes alphabetically: between `Calendar` and `ClipboardList`.

Note: the existing active-route logic `pathname === it.href || pathname.startsWith(it.href + '/')` will mark BOTH `/calendar` and `/calendar/availability` active when on `/calendar/availability`. To fix this, change the active check to:

```tsx
const active =
  pathname === it.href || (pathname.startsWith(it.href + '/') && !items.some((other) => other !== it && pathname.startsWith(other.href + '/') && other.href.length > it.href.length))
```

Simpler: prefer exact match, fall back to prefix only for items without more-specific siblings. Even simpler — explicit exact-only for `/calendar`:

```tsx
const active = it.href === '/calendar'
  ? pathname === '/calendar'
  : pathname === it.href || pathname.startsWith(it.href + '/')
```

Apply this exact-match exception for `/calendar` only.

- [ ] **Step 2: 寫 page scaffold**

`src/app/(tenant)/calendar/availability/page.tsx`:

```tsx
import { Suspense } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import PageSkeleton from '@/components/ui/page-skeleton'
import TemplatesSection from './templates-section'
import EventsSection from './events-section'
import EffectivePreview from './effective-preview'

export default function AvailabilityPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/calendar"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          回行事曆
        </Link>
        <h1 className="font-display text-3xl tracking-tight">
          <span className="italic">可用時段</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          設定每週固定可上課時段（作息模板）+ 臨時不可用區段（看醫生 / 休假 / 隨機事件）
        </p>
      </div>

      <section>
        <h2 className="mb-2 font-display text-xl">作息模板</h2>
        <Suspense fallback={<PageSkeleton rows={2} withHeader={false} />}>
          <TemplatesSection />
        </Suspense>
      </section>

      <section>
        <h2 className="mb-2 font-display text-xl">不可用事件</h2>
        <Suspense fallback={<PageSkeleton rows={3} withHeader={false} />}>
          <EventsSection />
        </Suspense>
      </section>

      <section>
        <h2 className="mb-2 font-display text-xl">未來 2 週生效摘要</h2>
        <Suspense fallback={<PageSkeleton rows={2} withHeader={false} />}>
          <EffectivePreview />
        </Suspense>
      </section>
    </div>
  )
}
```

- [ ] **Step 3: 寫 loading.tsx**

`src/app/(tenant)/calendar/availability/loading.tsx`:

```tsx
import PageSkeleton from '@/components/ui/page-skeleton'
export default function Loading() {
  return <PageSkeleton rows={6} />
}
```

- [ ] **Step 4: 寫三個 section placeholder**

Three minimal server components so build succeeds; real content comes in later tasks.

`src/app/(tenant)/calendar/availability/templates-section.tsx`:

```tsx
export default async function TemplatesSection() {
  return (
    <div className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
      模板列表將於 Task 6 加入
    </div>
  )
}
```

`src/app/(tenant)/calendar/availability/events-section.tsx`:

```tsx
export default async function EventsSection() {
  return (
    <div className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
      不可用事件列表將於 Task 8 加入
    </div>
  )
}
```

`src/app/(tenant)/calendar/availability/effective-preview.tsx`:

```tsx
export default async function EffectivePreview() {
  return (
    <div className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
      生效摘要將於 Task 9 加入
    </div>
  )
}
```

- [ ] **Step 5: typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: build success; `/calendar/availability` appears in route table

- [ ] **Step 6: commit**

```bash
git add src/app/(tenant)/sidebar-nav.tsx src/app/(tenant)/calendar/availability/
git commit -m "$(cat <<'EOF'
feat(s3): /calendar/availability segment scaffold + sidebar link

Adds the new "可用時段" navigation entry under the calendar group, with
a page shell wrapping three Suspense-streamed sections (templates,
events, effective preview). Section contents are placeholders to be
filled in by Tasks 6, 8, and 9. Also tightens the sidebar active-state
check so /calendar doesn't double-highlight when /calendar/availability
is open.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Templates section + create / rename / delete

**Files:**
- Create: `src/app/(tenant)/calendar/availability/actions.ts`
- Modify: `src/app/(tenant)/calendar/availability/templates-section.tsx`
- Create: `src/app/(tenant)/calendar/availability/template-editor.tsx`

- [ ] **Step 1: 寫 actions**

`src/app/(tenant)/calendar/availability/actions.ts`:

```ts
'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { actionClient } from '@/lib/safe-action'
import { requireTenantMember } from '@/lib/auth/get-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AppError } from '@/lib/errors'

const WindowSchema = z.object({
  weekday: z.number().int().min(1).max(7),
  start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
})

const CreateTemplateSchema = z.object({
  name: z.string().min(1).max(50),
  windows: z.array(WindowSchema),
})

export const createTemplateAction = actionClient
  .inputSchema(CreateTemplateSchema)
  .action(async ({ parsedInput }) => {
    const session = await requireTenantMember()
    const supabase = await createSupabaseServerClient()

    const { data: template, error: tErr } = await supabase
      .from('availability_templates')
      .insert({ member_id: session.memberId, name: parsedInput.name })
      .select('id')
      .single()
    if (tErr || !template) throw new AppError('TEMPLATE_CREATE_FAILED', tErr?.message ?? '建立失敗')

    if (parsedInput.windows.length > 0) {
      const rows = parsedInput.windows.map((w) => ({
        template_id: template.id,
        weekday: w.weekday,
        start_time: w.start_time,
        end_time: w.end_time,
      }))
      const { error: wErr } = await supabase.from('availability_template_windows').insert(rows)
      if (wErr) {
        await supabase.from('availability_templates').delete().eq('id', template.id)
        throw new AppError('TEMPLATE_WINDOWS_FAILED', wErr.message)
      }
    }

    revalidatePath('/calendar/availability')
    return { templateId: template.id }
  })

const UpdateWindowsSchema = z.object({
  templateId: z.string().uuid(),
  windows: z.array(WindowSchema),
})

export const updateTemplateWindowsAction = actionClient
  .inputSchema(UpdateWindowsSchema)
  .action(async ({ parsedInput }) => {
    await requireTenantMember()
    const supabase = await createSupabaseServerClient()

    await supabase.from('availability_template_windows').delete().eq('template_id', parsedInput.templateId)

    if (parsedInput.windows.length > 0) {
      const rows = parsedInput.windows.map((w) => ({
        template_id: parsedInput.templateId,
        weekday: w.weekday,
        start_time: w.start_time,
        end_time: w.end_time,
      }))
      const { error } = await supabase.from('availability_template_windows').insert(rows)
      if (error) throw new AppError('TEMPLATE_WINDOWS_FAILED', error.message)
    }

    await supabase
      .from('availability_templates')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', parsedInput.templateId)

    revalidatePath('/calendar/availability')
    return { ok: true }
  })

const RenameSchema = z.object({
  templateId: z.string().uuid(),
  name: z.string().min(1).max(50),
})

export const renameTemplateAction = actionClient
  .inputSchema(RenameSchema)
  .action(async ({ parsedInput }) => {
    await requireTenantMember()
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase
      .from('availability_templates')
      .update({ name: parsedInput.name })
      .eq('id', parsedInput.templateId)
    if (error) throw new AppError('RENAME_FAILED', error.message)
    revalidatePath('/calendar/availability')
    return { ok: true }
  })

const DeleteSchema = z.object({ templateId: z.string().uuid() })

export const deleteTemplateAction = actionClient
  .inputSchema(DeleteSchema)
  .action(async ({ parsedInput }) => {
    await requireTenantMember()
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase
      .from('availability_templates')
      .delete()
      .eq('id', parsedInput.templateId)
    if (error) {
      // FK restrict from assignments → caller must remove assignments first
      if (error.message?.includes('foreign key'))
        throw new AppError('TEMPLATE_IN_USE', '此模板正在使用中，請先切換為其他模板')
      throw new AppError('DELETE_FAILED', error.message)
    }
    revalidatePath('/calendar/availability')
    return { ok: true }
  })

const AssignSchema = z.object({
  templateId: z.string().uuid(),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export const assignTemplateAction = actionClient
  .inputSchema(AssignSchema)
  .action(async ({ parsedInput }) => {
    const session = await requireTenantMember()
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase.from('availability_template_assignments').insert({
      member_id: session.memberId,
      template_id: parsedInput.templateId,
      effective_from: parsedInput.effectiveFrom,
    })
    if (error) throw new AppError('ASSIGN_FAILED', error.message)
    revalidatePath('/calendar/availability')
    return { ok: true }
  })
```

- [ ] **Step 2: 替換 templates-section**

`src/app/(tenant)/calendar/availability/templates-section.tsx`:

```tsx
import { requireTenantMember } from '@/lib/auth/get-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import TemplateEditor from './template-editor'

export default async function TemplatesSection() {
  const session = await requireTenantMember()
  const supabase = await createSupabaseServerClient()

  const { data: templates } = await supabase
    .from('availability_templates')
    .select('id, name, created_at')
    .eq('member_id', session.memberId)
    .order('created_at', { ascending: true })

  const templateIds = (templates ?? []).map((t) => t.id)
  const { data: windows } =
    templateIds.length === 0
      ? { data: [] }
      : await supabase
          .from('availability_template_windows')
          .select('template_id, weekday, start_time, end_time')
          .in('template_id', templateIds)

  const windowsByTemplate: Record<
    string,
    Array<{ weekday: number; start_time: string; end_time: string }>
  > = {}
  for (const w of windows ?? []) {
    windowsByTemplate[w.template_id] = windowsByTemplate[w.template_id] ?? []
    windowsByTemplate[w.template_id]!.push({
      weekday: w.weekday,
      start_time: w.start_time,
      end_time: w.end_time,
    })
  }

  const { data: activeAssign } = await supabase
    .from('availability_template_assignments')
    .select('template_id, effective_from')
    .eq('member_id', session.memberId)
    .lte('effective_from', new Date().toISOString().slice(0, 10))
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle()
  const activeTemplateId = activeAssign?.template_id ?? null

  return (
    <div className="space-y-3">
      {(templates ?? []).map((t) => (
        <TemplateEditor
          key={t.id}
          template={{
            id: t.id,
            name: t.name,
            windows: windowsByTemplate[t.id] ?? [],
          }}
          isActive={t.id === activeTemplateId}
        />
      ))}
      <TemplateEditor template={null} isActive={false} />
      {(templates ?? []).length === 0 && (
        <p className="text-xs text-muted-foreground">
          尚無模板。建立第一個模板後，可指定生效日期、批量設定每週可上課時段。
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 3: 寫 TemplateEditor client component**

`src/app/(tenant)/calendar/availability/template-editor.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2 } from 'lucide-react'
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
import ConfirmDialog from '@/components/confirm-dialog'
import {
  createTemplateAction,
  updateTemplateWindowsAction,
  renameTemplateAction,
  deleteTemplateAction,
  assignTemplateAction,
} from './actions'

type Window = { weekday: number; start_time: string; end_time: string }

type Props =
  | { template: { id: string; name: string; windows: Window[] }; isActive: boolean }
  | { template: null; isActive: false }

const WEEKDAY_LABELS = ['', '週一', '週二', '週三', '週四', '週五', '週六', '週日']

export default function TemplateEditor(props: Props) {
  const isNew = props.template === null
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(isNew ? '' : props.template.name)
  const [windows, setWindows] = useState<Window[]>(isNew ? [] : props.template.windows)
  const today = new Date().toISOString().slice(0, 10)
  const [effectiveFrom, setEffectiveFrom] = useState(today)

  const create = useAction(createTemplateAction, {
    onSuccess: () => {
      toast.success('模板已建立')
      setOpen(false)
    },
    onError: ({ error }) => toast.error(error.serverError?.message ?? '建立失敗'),
  })
  const updateWindows = useAction(updateTemplateWindowsAction, {
    onSuccess: () => {
      toast.success('模板已更新')
      setOpen(false)
    },
    onError: ({ error }) => toast.error(error.serverError?.message ?? '更新失敗'),
  })
  const rename = useAction(renameTemplateAction, {
    onError: ({ error }) => toast.error(error.serverError?.message ?? '改名失敗'),
  })
  const del = useAction(deleteTemplateAction, {
    onSuccess: () => toast.success('模板已刪除'),
    onError: ({ error }) => toast.error(error.serverError?.message ?? '刪除失敗'),
  })
  const assign = useAction(assignTemplateAction, {
    onSuccess: () => toast.success('模板已切換為生效'),
    onError: ({ error }) => toast.error(error.serverError?.message ?? '切換失敗'),
  })

  function addWindow(weekday: number) {
    setWindows((cur) => [...cur, { weekday, start_time: '09:00', end_time: '17:00' }])
  }

  function removeWindow(idx: number) {
    setWindows((cur) => cur.filter((_, i) => i !== idx))
  }

  function updateWindow(idx: number, field: keyof Window, value: string | number) {
    setWindows((cur) => cur.map((w, i) => (i === idx ? { ...w, [field]: value } : w)))
  }

  function submit() {
    if (isNew) {
      create.execute({ name, windows })
    } else {
      const renamed = name !== props.template.name
      if (renamed) rename.execute({ templateId: props.template.id, name })
      updateWindows.execute({ templateId: props.template.id, windows })
    }
  }

  const pending = create.isPending || updateWindows.isPending || rename.isPending

  if (isNew) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          render={
            <Button variant="outline">
              <Plus className="mr-1 h-3.5 w-3.5" />
              新增模板
            </Button>
          }
        />
        <DialogContent className="max-w-2xl">{renderEditor()}</DialogContent>
      </Dialog>
    )
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-xl italic">{props.template.name}</h3>
            {props.isActive && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
                生效中
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {props.template.windows.length === 0
              ? '尚未設定任何時段（全週休）'
              : summarizeWindows(props.template.windows)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!props.isActive && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                assign.execute({ templateId: props.template!.id, effectiveFrom: today })
              }
              disabled={assign.isPending}
            >
              切換為生效
            </Button>
          )}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger
              render={
                <Button variant="outline" size="sm">
                  <Pencil className="mr-1 h-3.5 w-3.5" />
                  編輯
                </Button>
              }
            />
            <DialogContent className="max-w-2xl">{renderEditor()}</DialogContent>
          </Dialog>
          <ConfirmDialog
            trigger={
              <Button variant="outline" size="sm">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            }
            title={`刪除模板「${props.template.name}」？`}
            description="刪除後無法復原。若此模板被任何 assignment 引用，需先切換到其他模板才能刪除。"
            confirmLabel="刪除"
            variant="destructive"
            onConfirm={() => del.execute({ templateId: props.template!.id })}
          />
        </div>
      </div>
    </div>
  )

  function renderEditor() {
    return (
      <>
        <DialogHeader>
          <DialogTitle>{isNew ? '新增模板' : `編輯模板「${props.template.name}」`}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tmpl-name">模板名稱</Label>
            <Input
              id="tmpl-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="日常作息 / 夏季作息 / 週末班"
            />
          </div>

          <div className="space-y-2">
            <Label>每週時段（可同一天多段）</Label>
            <div className="space-y-2">
              {[1, 2, 3, 4, 5, 6, 7].map((wd) => {
                const dayWindows = windows
                  .map((w, idx) => ({ ...w, idx }))
                  .filter((w) => w.weekday === wd)
                return (
                  <div key={wd} className="flex flex-wrap items-center gap-2 rounded border p-2">
                    <div className="w-12 text-sm font-medium">{WEEKDAY_LABELS[wd]}</div>
                    <div className="flex flex-1 flex-wrap items-center gap-2">
                      {dayWindows.length === 0 ? (
                        <span className="text-xs text-muted-foreground">休</span>
                      ) : (
                        dayWindows.map((w) => (
                          <span
                            key={w.idx}
                            className="inline-flex items-center gap-1 rounded bg-muted px-2 py-1 text-xs"
                          >
                            <Input
                              type="time"
                              value={w.start_time.slice(0, 5)}
                              onChange={(e) =>
                                updateWindow(w.idx, 'start_time', e.target.value)
                              }
                              className="h-7 w-24"
                            />
                            <span>–</span>
                            <Input
                              type="time"
                              value={w.end_time.slice(0, 5)}
                              onChange={(e) => updateWindow(w.idx, 'end_time', e.target.value)}
                              className="h-7 w-24"
                            />
                            <button
                              type="button"
                              onClick={() => removeWindow(w.idx)}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              ✕
                            </button>
                          </span>
                        ))
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addWindow(wd)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {isNew && (
            <div className="space-y-2">
              <Label htmlFor="eff-from">建立後是否立即設為生效？</Label>
              <Input
                id="eff-from"
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                className="w-48"
              />
              <p className="text-xs text-muted-foreground">
                建立模板後請至列表點「切換為生效」；此處設定生效日期僅紀錄、不自動套用。
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button onClick={submit} disabled={pending || !name.trim()}>
            {pending ? '處理中...' : isNew ? '建立' : '儲存'}
          </Button>
        </DialogFooter>
      </>
    )
  }
}

function summarizeWindows(windows: Window[]): string {
  const byDay = new Map<number, Window[]>()
  for (const w of windows) {
    const arr = byDay.get(w.weekday) ?? []
    arr.push(w)
    byDay.set(w.weekday, arr)
  }
  const labels: string[] = []
  for (const wd of [1, 2, 3, 4, 5, 6, 7]) {
    const arr = byDay.get(wd)
    if (!arr || arr.length === 0) continue
    const segments = arr
      .map((w) => `${w.start_time.slice(0, 5)}–${w.end_time.slice(0, 5)}`)
      .join(', ')
    labels.push(`${WEEKDAY_LABELS[wd]} ${segments}`)
  }
  return labels.join('；')
}
```

- [ ] **Step 4: typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: build success

- [ ] **Step 5: commit**

```bash
git add src/app/(tenant)/calendar/availability/actions.ts src/app/(tenant)/calendar/availability/templates-section.tsx src/app/(tenant)/calendar/availability/template-editor.tsx
git commit -m "$(cat <<'EOF'
feat(s3): availability template CRUD + editor UI (FR-120)

Templates section lists the member's templates with active badge + per
template actions (edit windows, rename inline, delete, switch to
active). Editor dialog supports multi-window per weekday. Five server
actions: create, update windows (full replace), rename, delete (FK
restrict surfaces as user-friendly error), assign (creates a new
effective_from row in assignments).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Unavailable events section + dialog

**Files:**
- Create: `src/app/(tenant)/calendar/availability/unavailable-actions.ts`
- Modify: `src/app/(tenant)/calendar/availability/events-section.tsx`
- Create: `src/app/(tenant)/calendar/availability/unavailable-event-dialog.tsx`

- [ ] **Step 1: 寫 unavailable actions**

`src/app/(tenant)/calendar/availability/unavailable-actions.ts`:

```ts
'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { actionClient } from '@/lib/safe-action'
import { requireTenantMember } from '@/lib/auth/get-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AppError } from '@/lib/errors'

const CreateEventSchema = z
  .object({
    startAt: z.string().datetime(),
    endAt: z.string().datetime(),
    reason: z.string().max(200).optional().nullable(),
  })
  .refine((v) => new Date(v.endAt) > new Date(v.startAt), {
    message: '結束時間需晚於開始時間',
    path: ['endAt'],
  })

export const createUnavailableEventAction = actionClient
  .inputSchema(CreateEventSchema)
  .action(async ({ parsedInput }) => {
    const session = await requireTenantMember()
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase.from('unavailable_events').insert({
      member_id: session.memberId,
      start_at: parsedInput.startAt,
      end_at: parsedInput.endAt,
      reason: parsedInput.reason ?? null,
    })
    if (error) throw new AppError('EVENT_CREATE_FAILED', error.message)
    revalidatePath('/calendar/availability')
    revalidatePath('/calendar')
    return { ok: true }
  })

const DeleteSchema = z.object({ eventId: z.string().uuid() })

export const deleteUnavailableEventAction = actionClient
  .inputSchema(DeleteSchema)
  .action(async ({ parsedInput }) => {
    await requireTenantMember()
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase
      .from('unavailable_events')
      .delete()
      .eq('id', parsedInput.eventId)
    if (error) throw new AppError('EVENT_DELETE_FAILED', error.message)
    revalidatePath('/calendar/availability')
    revalidatePath('/calendar')
    return { ok: true }
  })
```

- [ ] **Step 2: 替換 events-section**

`src/app/(tenant)/calendar/availability/events-section.tsx`:

```tsx
import { format } from 'date-fns'
import { requireTenantMember } from '@/lib/auth/get-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import UnavailableEventDialog from './unavailable-event-dialog'
import { DeleteEventButton } from './unavailable-event-dialog'

const TZ_OFFSET_HOURS = 8
const toLocal = (iso: string) =>
  new Date(new Date(iso).getTime() + TZ_OFFSET_HOURS * 3600 * 1000)

export default async function EventsSection() {
  const session = await requireTenantMember()
  const supabase = await createSupabaseServerClient()

  const now = new Date().toISOString()
  const { data: events } = await supabase
    .from('unavailable_events')
    .select('id, start_at, end_at, reason')
    .eq('member_id', session.memberId)
    .gte('end_at', now)
    .order('start_at', { ascending: true })

  return (
    <div className="space-y-3">
      <UnavailableEventDialog />

      {(events ?? []).length === 0 ? (
        <p className="text-xs text-muted-foreground">尚無未來不可用事件</p>
      ) : (
        <div className="divide-y rounded-xl border bg-card">
          {(events ?? []).map((e) => {
            const s = toLocal(e.start_at)
            const en = toLocal(e.end_at)
            const sameDay = format(s, 'yyyy-MM-dd') === format(en, 'yyyy-MM-dd')
            const label = sameDay
              ? `${format(s, 'yyyy/MM/dd HH:mm')}–${format(en, 'HH:mm')}`
              : `${format(s, 'yyyy/MM/dd HH:mm')} – ${format(en, 'yyyy/MM/dd HH:mm')}`
            return (
              <div key={e.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="font-medium">{label}</div>
                  {e.reason && (
                    <div className="text-xs text-muted-foreground">{e.reason}</div>
                  )}
                </div>
                <DeleteEventButton eventId={e.id} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: 寫 dialog client component**

`src/app/(tenant)/calendar/availability/unavailable-event-dialog.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'
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
import ConfirmDialog from '@/components/confirm-dialog'
import {
  createUnavailableEventAction,
  deleteUnavailableEventAction,
} from './unavailable-actions'

type Preset = 'full' | 'half-am' | 'half-pm' | 'custom'

export default function UnavailableEventDialog() {
  const [open, setOpen] = useState(false)
  const today = new Date().toISOString().slice(0, 10)
  const [preset, setPreset] = useState<Preset>('full')
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(today)
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('17:00')
  const [reason, setReason] = useState('')

  const { execute, isPending } = useAction(createUnavailableEventAction, {
    onSuccess: () => {
      toast.success('已新增不可用事件')
      setOpen(false)
      setReason('')
    },
    onError: ({ error }) => toast.error(error.serverError?.message ?? '建立失敗'),
  })

  function submit() {
    let startAt: string
    let endAt: string
    if (preset === 'full') {
      startAt = new Date(`${startDate}T00:00:00+08:00`).toISOString()
      endAt = new Date(`${endDate}T23:59:59+08:00`).toISOString()
    } else if (preset === 'half-am') {
      startAt = new Date(`${startDate}T00:00:00+08:00`).toISOString()
      endAt = new Date(`${startDate}T12:00:00+08:00`).toISOString()
    } else if (preset === 'half-pm') {
      startAt = new Date(`${startDate}T12:00:00+08:00`).toISOString()
      endAt = new Date(`${startDate}T23:59:59+08:00`).toISOString()
    } else {
      startAt = new Date(`${startDate}T${startTime}:00+08:00`).toISOString()
      endAt = new Date(`${endDate}T${endTime}:00+08:00`).toISOString()
    }
    execute({ startAt, endAt, reason: reason.trim() || null })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline">
            <Plus className="mr-1 h-3.5 w-3.5" />
            新增不可用事件
          </Button>
        }
      />
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>新增不可用事件</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>類型</Label>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {(
                [
                  ['full', '全日休（可跨多日）'],
                  ['half-am', '半日休（上午）'],
                  ['half-pm', '半日休（下午）'],
                  ['custom', '自訂時間'],
                ] as const
              ).map(([val, label]) => (
                <button
                  type="button"
                  key={val}
                  onClick={() => setPreset(val)}
                  className={`rounded border p-2 ${
                    preset === val
                      ? 'border-blue-500 bg-blue-50 font-medium'
                      : 'border-slate-300 bg-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {preset === 'full' ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="from">起始日</Label>
                <Input
                  id="from"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="to">結束日</Label>
                <Input
                  id="to"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          ) : preset === 'custom' ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="cs-date">起始日</Label>
                <Input
                  id="cs-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cs-time">起始時間</Label>
                <Input
                  id="cs-time"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ce-date">結束日</Label>
                <Input
                  id="ce-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ce-time">結束時間</Label>
                <Input
                  id="ce-time"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="half-date">日期</Label>
              <Input
                id="half-date"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value)
                  setEndDate(e.target.value)
                }}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="reason">原因（選填）</Label>
            <Input
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="看醫生 / 休假 / 開會"
            />
          </div>

          <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            ℹ️ 若此時段內已有學員預約，建立後不會自動取消；行事曆會顯示 ⚠ 警示徽章，請自行決定是否取消。
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button onClick={submit} disabled={isPending}>
            {isPending ? '建立中...' : '建立'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function DeleteEventButton({ eventId }: { eventId: string }) {
  const { execute, isPending } = useAction(deleteUnavailableEventAction, {
    onSuccess: () => toast.success('已刪除'),
    onError: ({ error }) => toast.error(error.serverError?.message ?? '刪除失敗'),
  })
  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline" size="sm" disabled={isPending}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      }
      title="刪除此不可用事件？"
      description="刪除後該時段重新允許接受預約。"
      confirmLabel="刪除"
      variant="destructive"
      onConfirm={() => execute({ eventId })}
    />
  )
}
```

- [ ] **Step 4: typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: build success

- [ ] **Step 5: commit**

```bash
git add src/app/(tenant)/calendar/availability/unavailable-actions.ts src/app/(tenant)/calendar/availability/events-section.tsx src/app/(tenant)/calendar/availability/unavailable-event-dialog.tsx
git commit -m "$(cat <<'EOF'
feat(s3): unavailable events CRUD + dialog UI (FR-121)

Events section lists upcoming unavailable events with per-row delete.
Create dialog supports four presets (full multi-day, half AM, half PM,
custom datetime range) and an optional reason. Server actions
revalidate both /calendar/availability and /calendar so the warning
badge (FR-123) sees the new events immediately.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Effective preview mini-calendar

**Files:**
- Modify: `src/app/(tenant)/calendar/availability/effective-preview.tsx`

- [ ] **Step 1: 替換 effective-preview**

`src/app/(tenant)/calendar/availability/effective-preview.tsx`:

```tsx
import { addDays, format, startOfDay } from 'date-fns'
import { requireTenantMember } from '@/lib/auth/get-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  fetchActiveTemplate,
  fetchUnavailableEvents,
} from '@/lib/availability-server'
import { effectiveAvailability } from '@/lib/availability'

const TZ_OFFSET_HOURS = 8
const PREVIEW_DAYS = 14

const WEEKDAY_LABEL = ['日', '一', '二', '三', '四', '五', '六']

export default async function EffectivePreview() {
  const session = await requireTenantMember()
  const supabase = await createSupabaseServerClient()

  const today = startOfDay(new Date())
  const rangeEnd = addDays(today, PREVIEW_DAYS)

  const template = await fetchActiveTemplate(supabase, session.memberId, today)
  const events = await fetchUnavailableEvents(supabase, session.memberId, today, rangeEnd)

  const days = Array.from({ length: PREVIEW_DAYS }, (_, i) => addDays(today, i))

  return (
    <div className="rounded-xl border bg-card p-4">
      {template === null ? (
        <p className="text-xs text-muted-foreground">
          目前未指定生效模板。所有時段不受作息限制；學員端只看實際存在的 slot。
        </p>
      ) : (
        <div className="space-y-2">
          {days.map((d) => {
            const ranges = effectiveAvailability({
              date: d,
              activeTemplate: template,
              unavailableEvents: events,
              tzOffsetHours: TZ_OFFSET_HOURS,
            })
            const jsDay = d.getDay()
            return (
              <div key={d.toISOString()} className="flex items-center gap-3 text-sm">
                <div className="w-24 shrink-0 font-mono text-xs">
                  {format(d, 'MM/dd')}（{WEEKDAY_LABEL[jsDay]}）
                </div>
                <div className="flex-1">
                  {ranges.length === 0 ? (
                    <span className="text-xs text-muted-foreground">休</span>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {ranges.map((r, idx) => (
                        <span
                          key={idx}
                          className="rounded bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800"
                        >
                          {format(r.start, 'HH:mm')}–{format(r.end, 'HH:mm')}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: build success

- [ ] **Step 3: commit**

```bash
git add src/app/(tenant)/calendar/availability/effective-preview.tsx
git commit -m "$(cat <<'EOF'
feat(s3): effective availability preview (next 14 days)

Renders the composed effective ranges for the next two weeks. If no
template is active, shows the unconstrained message. Otherwise lists
each day's effective windows (empty = 休) computed by the
effectiveAvailability pure function — giving the coach a visual
sanity-check before students see the schedule.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Wire `validateInEffectiveRange` into write paths

**Files:**
- Modify: `src/app/(tenant)/calendar/actions.ts`
- Modify: `src/app/(tenant)/calendar/recurring-actions.ts`

- [ ] **Step 1: 修 createSlotAction**

In `src/app/(tenant)/calendar/actions.ts`, after `const supabase = await createSupabaseServerClient()`, add the validation call. Replace the `createSlotAction` body to:

```ts
export const createSlotAction = actionClient
  .inputSchema(CreateSlotSchema)
  .action(async ({ parsedInput }) => {
    const session = await requireTenantMember()
    const supabase = await createSupabaseServerClient()

    const startAt = new Date(parsedInput.startAt)
    const endAt = new Date(parsedInput.endAt)
    const inRange = await validateInEffectiveRange(
      supabase,
      session.memberId,
      startAt,
      endAt,
    )
    if (!inRange) {
      throw new AppError(
        'OUT_OF_AVAILABILITY',
        '時段超出可上課時段範圍（檢查作息模板與不可用事件）',
      )
    }

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
    revalidateTag(publicSlotsTag(session.tenantId))
    return { ok: true }
  })
```

Add the import at the top:

```ts
import { validateInEffectiveRange } from '@/lib/availability-server'
```

Note: the `revalidateTag` import is already there from S2. Confirm.

- [ ] **Step 2: 修 createRecurringRuleAction — filter occurrences**

In `src/app/(tenant)/calendar/recurring-actions.ts`, modify the action. After step 4 (split occurrences into to-insert vs conflicts), add a second filter pass:

Find the block after step 4 that looks like:

```ts
// 5. If conflicts and not skipping → return conflicts without writing anything
if (conflicts.length > 0 && !parsedInput.skipConflicts) {
  return { ruleId: null, created: 0, skipped: 0, conflicts }
}
```

Insert a new step 4.5 BEFORE step 5 to filter `toInsert` by effective availability:

```ts
// 4.5. Filter out occurrences that fall outside effective availability
const template = await fetchActiveTemplate(supabase, session.memberId, startDate)
let availabilityFiltered: Occurrence[] = toInsert
let skippedAvailability = 0
if (template !== null) {
  const events = await fetchUnavailableEvents(
    supabase,
    session.memberId,
    new Date(toInsert[0]!.startAt),
    new Date(toInsert[toInsert.length - 1]!.endAt),
  )
  const passed: Occurrence[] = []
  for (const occ of toInsert) {
    const start = new Date(occ.startAt)
    const end = new Date(occ.endAt)
    const dayRanges = effectiveAvailability({
      date: start,
      activeTemplate: template,
      unavailableEvents: events,
      tzOffsetHours: 8,
    })
    if (dayRanges.some((r) => r.start <= start && r.end >= end)) {
      passed.push(occ)
    } else {
      skippedAvailability++
    }
  }
  availabilityFiltered = passed
}
```

Then change the existing slot insert and return:

```ts
// 7. Batch insert the non-conflicting, in-availability slots
if (availabilityFiltered.length > 0) {
  const rows = availabilityFiltered.map((o) => ({
    tenant_id: session.tenantId,
    member_id: session.memberId,
    service_id: parsedInput.serviceId,
    recurring_rule_id: rule.id,
    start_at: o.startAt,
    end_at: o.endAt,
    status: 'available' as const,
  }))
  const { error: insertErr } = await supabase.from('availability_slots').insert(rows)
  if (insertErr) {
    await supabase.from('recurring_rules').delete().eq('id', rule.id)
    throw new AppError('SLOTS_BATCH_INSERT_FAILED', insertErr.message)
  }
}

revalidatePath('/calendar')
revalidateTag(publicSlotsTag(session.tenantId))
return {
  ruleId: rule.id,
  created: availabilityFiltered.length,
  skipped: conflicts.length,
  skippedAvailability,
  conflicts: parsedInput.skipConflicts ? conflicts : [],
}
```

Update `CreateResult` type to include the new field:

```ts
type CreateResult = {
  ruleId: string | null
  created: number
  skipped: number
  skippedAvailability: number
  conflicts: ConflictSlot[]
}
```

And the early return for conflicts also needs the new field:

```ts
if (conflicts.length > 0 && !parsedInput.skipConflicts) {
  return { ruleId: null, created: 0, skipped: 0, skippedAvailability: 0, conflicts }
}
```

Add the imports at the top:

```ts
import { fetchActiveTemplate, fetchUnavailableEvents } from '@/lib/availability-server'
import { effectiveAvailability } from '@/lib/availability'
```

- [ ] **Step 3: 修 recurring-rule-dialog 顯示 skippedAvailability**

In `src/app/(tenant)/calendar/recurring-rule-dialog.tsx`, update the `onSuccess` handler so the user sees how many occurrences were skipped due to availability:

Find:

```tsx
} else {
  toast.success(
    `已建立 ${data.created} 個時段${data.skipped > 0 ? `（略過 ${data.skipped} 個衝突）` : ''}`,
  )
```

Replace with:

```tsx
} else {
  const parts = [`已建立 ${data.created} 個時段`]
  if (data.skipped > 0) parts.push(`略過 ${data.skipped} 個衝突`)
  if (data.skippedAvailability > 0)
    parts.push(`略過 ${data.skippedAvailability} 個不在作息時段內`)
  toast.success(parts.length > 1 ? `${parts[0]}（${parts.slice(1).join('、')}）` : parts[0]!)
```

- [ ] **Step 4: typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: clean

- [ ] **Step 5: commit**

```bash
git add src/app/(tenant)/calendar/actions.ts src/app/(tenant)/calendar/recurring-actions.ts src/app/(tenant)/calendar/recurring-rule-dialog.tsx
git commit -m "$(cat <<'EOF'
feat(s3): wire validateInEffectiveRange into slot + rule writes (FR-122)

createSlotAction throws OUT_OF_AVAILABILITY when the slot doesn't fit
the member's active template (or overlaps an unavailable_event).
createRecurringRuleAction filters generated occurrences by the same
predicate and reports skippedAvailability in the result so the dialog
can show "建立 X 個（略過 Y 個衝突、略過 Z 個不在作息時段內）".

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Cron materialize-recurring — filter occurrences

**Files:**
- Modify: `src/app/api/cron/materialize-recurring/route.ts`

- [ ] **Step 1: 加 filter 邏輯**

Modify `src/app/api/cron/materialize-recurring/route.ts`. Add the imports at the top:

```ts
import { fetchActiveTemplate, fetchUnavailableEvents } from '@/lib/availability-server'
import { effectiveAvailability } from '@/lib/availability'
```

Inside the per-rule loop, after `const toTry = occurrences.filter((o) => !existingSet.has(o.startAt))`, add:

```ts
// Filter out occurrences outside the member's active template / inside events
let outOfAvailabilityCount = 0
let filtered: typeof toTry = toTry
const template = await fetchActiveTemplate(admin, rule.member_id, windowStart)
if (template !== null) {
  const events = await fetchUnavailableEvents(
    admin,
    rule.member_id,
    windowStart,
    windowEnd,
  )
  const passed: typeof toTry = []
  for (const occ of toTry) {
    const start = new Date(occ.startAt)
    const end = new Date(occ.endAt)
    const dayRanges = effectiveAvailability({
      date: start,
      activeTemplate: template,
      unavailableEvents: events,
      tzOffsetHours: 8,
    })
    if (dayRanges.some((r) => r.start <= start && r.end >= end)) {
      passed.push(occ)
    } else {
      outOfAvailabilityCount++
    }
  }
  filtered = passed
}
totalOutOfAvailability += outOfAvailabilityCount
if (filtered.length === 0) continue
```

And replace the existing `for (const occ of toTry)` insert loop with `for (const occ of filtered)`.

Add at the top of the function (alongside `totalCreated` etc.):

```ts
let totalOutOfAvailability = 0
```

And include it in the final NextResponse:

```ts
return NextResponse.json({
  rules: rules?.length ?? 0,
  considered: totalConsidered,
  created: totalCreated,
  skipped: totalSkipped,
  out_of_availability: totalOutOfAvailability,
  timestamp: now.toISOString(),
})
```

The existing `affectedTenants` Set should still be populated only on successful insert (already correct from S2).

- [ ] **Step 2: typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: clean

- [ ] **Step 3: commit**

```bash
git add src/app/api/cron/materialize-recurring/route.ts
git commit -m "$(cat <<'EOF'
feat(s3): cron materialize-recurring skips out-of-availability occurrences (FR-122)

Per-rule occurrences that fall outside the member's active template
or inside an unavailable_event are no longer inserted. Skipped count
is returned in the cron JSON body as out_of_availability for
observability. revalidateTag wiring from S2 is preserved.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: /calendar warning badge for slots colliding with events

**Files:**
- Modify: `src/app/(tenant)/calendar/page.tsx`
- Modify: `src/app/(tenant)/calendar/calendar-panel.tsx`
- Modify: `src/app/(tenant)/calendar/week-grid.tsx`
- Modify: `src/app/(tenant)/calendar/list-view.tsx`
- Modify: `src/app/(tenant)/calendar/slot-popover.tsx`

- [ ] **Step 1: page.tsx 查 unavailable_events 並 pass down**

In `src/app/(tenant)/calendar/page.tsx`, after the slots query and before constructing `slotDisplays`, add:

```ts
// Fetch unavailable events for the week range (per effective member set)
const { data: rawEvents } = await supabase
  .from('unavailable_events')
  .select('id, member_id, start_at, end_at, reason')
  .in('member_id', effectiveIds)
  .gte('end_at', weekStart.toISOString())
  .lte('start_at', weekEnd.toISOString())
const unavailableEvents = (rawEvents ?? []).map((e) => ({
  id: e.id,
  memberId: e.member_id,
  startAt: e.start_at,
  endAt: e.end_at,
  reason: e.reason,
}))
```

Enrich `slotDisplays` with a `conflictingEvent` field:

```ts
const slotDisplays = (slots ?? []).map((s) => {
  const member = allMembers.find((m) => m.id === s.member_id)
  const booking = bookingsBySlot[s.id]
  const conflict = unavailableEvents.find(
    (e) =>
      e.memberId === s.member_id && e.startAt < s.end_at && e.endAt > s.start_at,
  )
  return {
    id: s.id,
    startAt: s.start_at,
    endAt: s.end_at,
    status: s.status as 'available' | 'pending' | 'booked' | 'cancelled',
    serviceName: (s.services as { name: string } | null)?.name ?? null,
    memberLabel: member?.label ?? '',
    memberId: s.member_id,
    isOwn: s.member_id === session.memberId,
    customerName: booking?.customerName ?? null,
    bookingId: booking?.id ?? null,
    conflictReason: conflict?.reason ?? (conflict ? '不可用事件' : null),
  }
})
```

(The `conflictReason: string | null` field travels through to slot-popover for display.)

- [ ] **Step 2: calendar-panel.tsx — extend SlotDisplay type**

In `src/app/(tenant)/calendar/calendar-panel.tsx`, find the `SlotDisplay` type and add the new field:

```ts
type SlotDisplay = {
  id: string
  startAt: string
  endAt: string
  status: 'available' | 'pending' | 'booked' | 'cancelled'
  serviceName: string | null
  memberLabel: string
  memberId: string
  isOwn: boolean
  customerName: string | null
  bookingId: string | null
  conflictReason: string | null
}
```

(no other change needed here; types flow through to children)

- [ ] **Step 3: week-grid.tsx — show ⚠ badge**

In `src/app/(tenant)/calendar/week-grid.tsx`, update the `SlotDisplay` type at the top to include `conflictReason: string | null`. Then in the slot rendering inside `<SlotPopover>`, modify the button JSX to include a warning badge when `conflictReason` is truthy. Find:

```tsx
<button
  type="button"
  className={`group w-full rounded-sm border-l-2 px-1 py-0.5 text-left text-[10px] mb-0.5 transition hover:shadow-sm ${STATUS_BG[s.status]} ${!s.isOwn ? 'border-dashed opacity-90' : ''}`}
>
  <div className="flex items-center gap-1">
    {showMemberLabel && (
      <span className="rounded bg-white/60 px-1 font-semibold">
        {s.memberLabel}
      </span>
    )}
    <span className="truncate">{s.serviceName ?? '時段'}</span>
  </div>
  <div className="opacity-70">{format(ls, 'HH:mm')}</div>
</button>
```

Replace with:

```tsx
<button
  type="button"
  className={`group w-full rounded-sm border-l-2 px-1 py-0.5 text-left text-[10px] mb-0.5 transition hover:shadow-sm ${STATUS_BG[s.status]} ${!s.isOwn ? 'border-dashed opacity-90' : ''} ${s.conflictReason ? 'ring-1 ring-amber-400' : ''}`}
>
  <div className="flex items-center gap-1">
    {s.conflictReason && <span title={s.conflictReason}>⚠</span>}
    {showMemberLabel && (
      <span className="rounded bg-white/60 px-1 font-semibold">
        {s.memberLabel}
      </span>
    )}
    <span className="truncate">{s.serviceName ?? '時段'}</span>
  </div>
  <div className="opacity-70">{format(ls, 'HH:mm')}</div>
</button>
```

- [ ] **Step 4: list-view.tsx — show ⚠ badge**

In `src/app/(tenant)/calendar/list-view.tsx`, update the `SlotDisplay` type to include `conflictReason: string | null`. Then in the list item rendering, find the `<li>` block and add a warning indicator. Find:

```tsx
<li className="flex cursor-pointer items-center gap-3 px-4 py-2.5 transition hover:bg-muted/30">
  <div className="w-24 font-mono text-xs text-muted-foreground">
    {timeLabel}
  </div>
  <div className="min-w-0 flex-1">
    <div className="truncate text-sm font-medium">
      {s.serviceName ?? '時段'}
    </div>
    ...
```

Replace with:

```tsx
<li className={`flex cursor-pointer items-center gap-3 px-4 py-2.5 transition hover:bg-muted/30 ${s.conflictReason ? 'bg-amber-50/40' : ''}`}>
  <div className="w-24 font-mono text-xs text-muted-foreground">
    {timeLabel}
  </div>
  <div className="min-w-0 flex-1">
    <div className="flex items-center gap-1 truncate text-sm font-medium">
      {s.conflictReason && <span title={s.conflictReason}>⚠</span>}
      {s.serviceName ?? '時段'}
    </div>
    ...
```

- [ ] **Step 5: slot-popover.tsx — show conflict message**

In `src/app/(tenant)/calendar/slot-popover.tsx`, update the slot prop type to include `conflictReason: string | null`:

```ts
slot: {
  id: string
  status: string
  serviceName: string | null
  customerName: string | null
  bookingId: string | null
  memberLabel: string
  isOwn: boolean
  conflictReason: string | null
}
```

Add a conflict warning panel in the dialog content (after the existing rows, before the booking-warning panel). Find the section:

```tsx
{(slot.status === 'pending' || slot.status === 'booked') && (
  <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
    此時段已有預約，請至「預約管理」操作確認 / 取消。
  </div>
)}
```

Add ABOVE it:

```tsx
{slot.conflictReason && (
  <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
    ⚠ 此時段與「不可用事件」衝突（{slot.conflictReason}）。學員端不會看到新預約落進此時段，但既有預約仍會保留 — 請自行決定是否取消。
  </div>
)}
```

- [ ] **Step 6: typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: clean

- [ ] **Step 7: commit**

```bash
git add src/app/(tenant)/calendar/page.tsx src/app/(tenant)/calendar/calendar-panel.tsx src/app/(tenant)/calendar/week-grid.tsx src/app/(tenant)/calendar/list-view.tsx src/app/(tenant)/calendar/slot-popover.tsx
git commit -m "$(cat <<'EOF'
feat(s3): slot vs unavailable_event conflict badges (FR-123)

Calendar page now joins unavailable_events for the visible member set
and threads a per-slot conflictReason field through CalendarPanel →
WeekGrid / ListView. Slots overlapping an event get ⚠ + ring/bg
treatment; SlotPopover shows a yellow panel explaining the conflict
and reminding the coach to decide what to do with existing bookings.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: 林教練 seed enrichment

**Files:**
- Modify: `scripts/seed-test-data.mjs`

- [ ] **Step 1: 加 seed helpers**

In `scripts/seed-test-data.mjs`, near the top (after `bookSlot`), add helpers:

```js
async function createTemplate({ memberId, name, windows }) {
  const { data: tmpl, error } = await admin
    .from('availability_templates')
    .insert({ member_id: memberId, name })
    .select('id')
    .single()
  if (error) fail(`template ${name}: ${error.message}`)
  if (windows.length > 0) {
    const { error: wErr } = await admin
      .from('availability_template_windows')
      .insert(windows.map((w) => ({ template_id: tmpl.id, ...w })))
    if (wErr) fail(`template windows: ${wErr.message}`)
  }
  return tmpl
}

async function assignTemplate({ memberId, templateId, effectiveFrom }) {
  const { error } = await admin
    .from('availability_template_assignments')
    .insert({ member_id: memberId, template_id: templateId, effective_from: effectiveFrom })
  if (error) fail(`assignment: ${error.message}`)
}

async function createUnavailableEvent({ memberId, startAt, endAt, reason }) {
  const { data, error } = await admin
    .from('unavailable_events')
    .insert({ member_id: memberId, start_at: startAt, end_at: endAt, reason })
    .select('id')
    .single()
  if (error) fail(`event: ${error.message}`)
  return data
}
```

- [ ] **Step 2: 在 `main()` 加 enrichment 區塊**

After the existing `─── Creating bookings ───` block, add:

```js
log('\n─── Creating availability templates (S3) ───')

// 林教練「日常作息」: per S3 spec
const linDaily = await createTemplate({
  memberId: lin.member.id,
  name: '日常作息',
  windows: [
    { weekday: 1, start_time: '09:00', end_time: '12:00' },
    { weekday: 1, start_time: '14:00', end_time: '17:00' },
    { weekday: 2, start_time: '14:00', end_time: '20:00' },
    { weekday: 3, start_time: '09:00', end_time: '12:00' },
    { weekday: 3, start_time: '14:00', end_time: '17:00' },
    { weekday: 4, start_time: '14:00', end_time: '20:00' },
    { weekday: 5, start_time: '09:00', end_time: '17:00' },
  ],
})
await assignTemplate({
  memberId: lin.member.id,
  templateId: linDaily.id,
  effectiveFrom: todayStr(),
})
log(`  ✓ 林教練 模板「日常作息」+ 生效中`)

// 林教練「假期作息」: 不生效（demo 有多模板）
await createTemplate({
  memberId: lin.member.id,
  name: '假期作息',
  windows: [
    { weekday: 6, start_time: '09:00', end_time: '12:00' },
    { weekday: 7, start_time: '09:00', end_time: '12:00' },
  ],
})
log(`  ✓ 林教練 模板「假期作息」（未生效）`)

// 阿明助教「週末班」
const mingTmpl = await createTemplate({
  memberId: ming.member.id,
  name: '週末班',
  windows: [
    { weekday: 6, start_time: '09:00', end_time: '17:00' },
    { weekday: 7, start_time: '09:00', end_time: '12:00' },
  ],
})
await assignTemplate({
  memberId: ming.member.id,
  templateId: mingTmpl.id,
  effectiveFrom: todayStr(),
})
log(`  ✓ 阿明助教 模板「週末班」+ 生效中`)

log('\n─── Creating 林教練 recurring rule (S3) ───')
const { data: linRule } = await admin
  .from('recurring_rules')
  .insert({
    tenant_id: lin.tenant.id,
    member_id: lin.member.id,
    service_id: linSvc2.id, // 網球進階班
    freq: 'weekly',
    interval_n: 1,
    by_weekday: [2], // 週二
    start_time: '14:00:00',
    end_time: '15:00:00',
    start_date: todayStr(),
    end_condition: 'count',
    end_count: 12,
    is_active: true,
  })
  .select()
  .single()
log(`  ✓ 林教練 rule: 每週二 14:00-15:00 網球進階班 共 12 次`)

log('\n─── Creating unavailable events (S3) ───')

// 林：下下週四 14-15 看醫生 (將剛好撞 rule 的一個 occurrence — cron 應跳過)
const linEvtDate = todayStr(((4 - new Date().getDay()) + 14) % 7 + 7)
await createUnavailableEvent({
  memberId: lin.member.id,
  startAt: localIso(linEvtDate, '14:00'),
  endAt: localIso(linEvtDate, '15:00'),
  reason: '看醫生',
})
log(`  ✓ 林教練 event: ${linEvtDate} 14-15 看醫生`)

// 林：建立一個故意撞 既有 slot 的 event (demo collision)
const collisionEvtDate = todayStr(5)
await createUnavailableEvent({
  memberId: lin.member.id,
  startAt: localIso(collisionEvtDate, '10:00'),
  endAt: localIso(collisionEvtDate, '11:00'),
  reason: 'Demo collision（會跟既有 slot 重疊，看 ⚠ 徽章）',
})
log(`  ✓ 林教練 event: ${collisionEvtDate} 10-11 故意撞 (demo collision)`)
```

The variable `linRule` is unused after insertion — that's OK; it's just for testing the cron filter on later runs.

- [ ] **Step 3: dry-run seed (optional, only if SUPABASE_SERVICE_ROLE_KEY is in .env.local)**

If env is set up:
```bash
node scripts/seed-test-data.mjs
```
Expected: prints all the new log lines successfully. If you don't have the service role key locally, skip — production seed pipeline will pick it up.

- [ ] **Step 4: commit**

```bash
git add scripts/seed-test-data.mjs
git commit -m "$(cat <<'EOF'
feat(s3): seed 林教練 + 阿明助教 availability data (FR-124)

Adds two active templates (林's 日常作息 with multi-segment days + 阿明's
週末班), one inactive demo template (林's 假期作息), one recurring rule
for 林 (週二 14-15 網球進階班 ×12), and two unavailable events: one
that will collide with a cron-generated occurrence (so we can see the
out_of_availability skip in cron logs) and one that intentionally
overlaps an existing slot (so we can see the ⚠ badge in /calendar).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: README + appendix C + final push

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-05-21-quickreserve-redesign-design.md`

- [ ] **Step 1: README 路由地圖 + 概念說明**

Open `README.md`. Find the route map section. Under `(tenant) — 教練後台`, after the `/calendar?member=<id>` line, add:

```
  /calendar/availability       作息模板 + 不可用事件管理（S3）
```

Then in the README's body sections, add a new section between the existing "效能 playbook" section and "## 部署" section:

```markdown
## 可用時段（Availability）

教練可選擇性地設定：

### 作息模板（templates）

- 每位 member 可有多個命名模板（「日常作息」「夏季作息」…）
- 每模板含 7 天 × 任意段數的 `start_time`–`end_time`
- 同一時刻只有一個模板「生效」（透過 `availability_template_assignments` 表的 `effective_from` 排序）
- 切換生效 = insert 新一筆 assignment，**不**刪歷史

### 不可用事件（unavailable_events）

- 每位 member 可任意時間區段標記為不可用（看醫生、休假、隨機）
- 與作息模板正交：模板給「日常可上課時段」，event 是「臨時打洞」

### Effective availability

`src/lib/availability.ts` 的 `effectiveAvailability` 純函式：

```
effectiveAvailability(date, template, events) =
  template.windowsFor(weekday)  // 該日 windows
  - events overlapping that day // 集合減法
```

- 無 template → 不限制（current behavior）
- Server actions (`createSlotAction` / `createRecurringRuleAction`) 與 cron `materialize-recurring` 都用此函式過濾
- 公開頁 `/api/public/slots` 不用：slot 是已過濾結果

### 撞 event 的既有 slot

教練建立 event 撞到既有 slot（含 pending/booked）時：
- Event 直接建立、不動 slot
- /calendar 主畫面該 slot 顯示 ⚠ 徽章；SlotPopover 紅黃提示
- 教練自行決定是否取消那些既有預約
```

- [ ] **Step 2: Appendix C — 加 FR-120~124**

Open `docs/superpowers/specs/2026-05-21-quickreserve-redesign-design.md`. Find Appendix C (the FR changelog table). Append 5 rows (use the same format as FR-115~119). The exact format should match what's already there — typically:

```
| 2026-05-25 | 作息模板 schema + 編輯 UI | FR-120 | `<commit_3>`, `<commit_6>` |
| 2026-05-25 | 不可用事件 schema + UI | FR-121 | `<commit_3>`, `<commit_7>` |
| 2026-05-25 | effectiveAvailability 純函式 + server / cron 過濾 | FR-122 | `<commit_1>`, `<commit_2>`, `<commit_4>`, `<commit_9>`, `<commit_10>` |
| 2026-05-25 | /calendar slot vs event collision badge | FR-123 | `<commit_11>` |
| 2026-05-25 | 林教練 seed enrichment | FR-124 | `<commit_12>` |
```

Look up actual commit hashes with `git log --oneline -20` and substitute. The header line `**最後更新**` (if it exists) should also be updated to today's date.

- [ ] **Step 3: typecheck + build (final)**

Run: `npm run typecheck && npm run build`
Expected: clean

- [ ] **Step 4: commit + push**

```bash
git add README.md docs/superpowers/specs/2026-05-21-quickreserve-redesign-design.md
git commit -m "$(cat <<'EOF'
docs(s3): README 可用時段 section + appendix C FR-120~124

Wraps S3: README documents the templates / events / effective
availability model and the badge convention. Appendix C links each FR
to its implementing commits.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push origin master
```

- [ ] **Step 5: 等 Vercel READY**

Check https://vercel.com/[team]/quickreserve/deployments — the final commit's deployment should reach READY in ≤ 3 minutes.

- [ ] **Step 6: 收工**

回報使用者：S3 完成，commit hashes，提醒：
- 跑一次 `node scripts/seed-test-data.mjs` 重建測試資料（如果想看新功能）
- /calendar/availability 可以設定模板
- /calendar 看 ⚠ 徽章效果（如果 seed 跑了）

---

## Acceptance Summary

完成所有 task 後，應滿足 spec §2.3 的六條驗收 gate：

1. ✅ 教練可在 `/calendar/availability` 建立模板、設為生效、編輯
2. ✅ 教練可建立 unavailable_event（含半小時級的非整日 range）並從列表撤銷
3. ✅ 模板生效後，slot 建立 form 落在 range 外會被 server 拒絕並顯示 `OUT_OF_AVAILABILITY` error
4. ✅ Cron `materialize-recurring` 在跑下一輪時自動跳過超出 effective range 或撞 unavailable_event 的 occurrence
5. ✅ /calendar 主畫面，撞 event 的 slot 顯示 ⚠ 警示徽章；點開 SlotPopover 看得到衝突提示
6. ✅ 林教練的 seed 資料包含模板、rule、events、collision demo

Plus：
- FR-120 ~ FR-124 全部回填 appendix C
- README 有 Availability 一節
- 全部 commit push origin master，Vercel READY

---

## Self-Review Checklist

- [x] Spec §2.1 in scope 全覆蓋（templates → Task 6 + 8、events → Task 7、effective fn → Task 1+2+4、validation wiring → Task 9 + 10、collision badge → Task 11、seed → Task 12）
- [x] Spec §3 資料模型 → Task 3 含四張新表 schema + RLS
- [x] Spec §4 algorithm → Task 2 effectiveAvailability 純函式涵蓋所有列出的邊界 case（跨午夜 event、空 window、ISO weekday）
- [x] Spec §5 UI 範圍 → Task 5 scaffold + Task 6/7/8 三個 section + Task 11 行事曆徽章
- [x] Spec §6 server actions + cron → Task 6/7 actions + Task 9 wire + Task 10 cron
- [x] Spec §7 seed → Task 12 涵蓋四項（兩 active template、非生效 demo template、rule、兩 event）
- [x] Spec §10 FR 編號 → Task 13 回寫附錄 C 全 5 條
- [x] Spec §11 doc 更新 → Task 13 README 改動 + appendix C
- [x] 無 TBD / TODO / placeholder（migration timestamps 是固定值；commit hash 在 Task 13 內查 git log）
- [x] 跨 task type 一致：`Range` / `TemplateWindow` (Task 1)、`SlotDisplay.conflictReason: string | null` (Task 11 各 client 元件統一加)
- [x] Tasks 互相 reference 用對的命名（`validateInEffectiveRange`、`fetchActiveTemplate`、`fetchUnavailableEvents`、`effectiveAvailability` 全 codebase 一致）
