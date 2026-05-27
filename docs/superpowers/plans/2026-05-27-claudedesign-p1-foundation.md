# claudeDesign UI Alignment · Plan 1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lay the foundation for 17-page UI alignment — finish remaining schema migrations, write comprehensive dev seed, and ship 10 new primitives + 1 button extension that downstream page work depends on.

**Architecture:** Schema-audit-first (most spec-listed migrations are already done in S5/S6 — confirm and write only the gaps); then build primitives TDD-style; finally seed comprehensive demo data so subsequent page work has live content.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind v4, base-ui (shadcn), Vitest + RTL (happy-dom), Supabase migrations (`supabase db push`), TypeScript strict.

**Spec:** `docs/superpowers/specs/2026-05-27-claudedesign-ui-alignment-design.md` (commit `4f7e89e`)

---

## Phase A — Schema Audit (read-only)

### Task A1: Confirm current schema state and finalize migration list

**Files:** none (read-only)

- [ ] **Step 1:** Use Supabase MCP `list_tables` (schemas `["public"]`) and confirm the following findings (from spec writing pass on 2026-05-27):

  | Spec asks for | Status | Action |
  |---|---|---|
  | `tenants.years_exp`, `tenants.established_year`, `tenants.city` | **missing** | write migration |
  | `tenants.contact_email/phone/line_id/note` | ✅ exists (migration `20260521152213`) | none |
  | `tenants.bio_html`, `tenants.intro_video_url` | ✅ exists (migration `20260526100000`) | none |
  | `services.max_capacity`, `min_attendance`, `cancel_deadline_hours` | ✅ exists (`20260525200007`) | none |
  | `service_packages.is_popular` | **missing** | write migration |
  | `notification_preferences` event×channel matrix (web_push + in_app) | **partial** — has per-event booleans, no per-channel split | write migration |
  | `notification_preferences.quiet_hours_start/end` | **missing** | write migration |

- [ ] **Step 2:** If the audit reveals anything different (e.g. some columns already added in a later commit), update the migration plan below accordingly.

- [ ] **Step 3:** No commit (read-only audit).

---

## Phase B — Migrations

### Task B1: Add tenant hero meta columns (years_exp, established_year, city)

**Files:**
- Create: `supabase/migrations/<TS>_tenants_hero_meta_columns.sql`

- [ ] **Step 1:** Generate the timestamped filename. Run:

```bash
node -e "console.log(new Date().toISOString().replace(/[-:T]/g,'').slice(0,14))"
```

Use the printed `YYYYMMDDHHMMSS` as the prefix (e.g. `20260527150000`).

- [ ] **Step 2:** Create the migration file with content:

```sql
-- Add tenant hero meta fields used by /<slug> public page.
alter table public.tenants
  add column if not exists years_exp int check (years_exp >= 0),
  add column if not exists established_year int check (established_year between 1900 and 2100),
  add column if not exists city text;

comment on column public.tenants.years_exp is 'Years of coaching experience displayed on public page hero (e.g. "7 YRS").';
comment on column public.tenants.established_year is 'Studio establishment year displayed on public page hero (e.g. "EST 2018").';
comment on column public.tenants.city is 'Free-form city/area label displayed on public page hero (e.g. "TAIPEI 內湖").';
```

- [ ] **Step 3:** No new RLS needed — existing `tenants_update` Owner policy already covers these. Verify by reading `supabase/migrations/20260521110654_identity_rls.sql` — confirm there's an `update on public.tenants` policy that gates by tenant_member owner role.

- [ ] **Step 4:** Apply locally (or against linked project) and verify:

```bash
npx supabase db push
```

Expected: migration applies cleanly, no diff drift.

- [ ] **Step 5:** Commit:

```bash
git add supabase/migrations/<TS>_tenants_hero_meta_columns.sql
git commit -m "feat(schema): add tenants.years_exp/established_year/city for public page hero

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task B2: Add service_packages.is_popular flag

**Files:**
- Create: `supabase/migrations/<TS>_service_packages_is_popular.sql`

- [ ] **Step 1:** Generate timestamp prefix (same as B1, ≥1 second after B1).

- [ ] **Step 2:** Create the migration:

```sql
-- Add is_popular flag for /<slug>/packages "popular" yellow Pill marker.
alter table public.service_packages
  add column if not exists is_popular boolean not null default false;

comment on column public.service_packages.is_popular is 'When true, show "POPULAR" yellow Pill badge on /<slug>/packages cards.';
```

- [ ] **Step 3:** Verify existing RLS on `service_packages` covers updates by Owner (open `supabase/migrations/20260525200001_service_packages_rls.sql`, look for `update` policy gated by tenant_member). No new policy needed.

- [ ] **Step 4:** Apply:

```bash
npx supabase db push
```

Expected: clean apply.

- [ ] **Step 5:** Commit:

```bash
git add supabase/migrations/<TS>_service_packages_is_popular.sql
git commit -m "feat(schema): add service_packages.is_popular for public packages page

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task B3: Refactor notification_preferences for event×channel matrix + quiet hours

**Files:**
- Create: `supabase/migrations/<TS>_notification_prefs_matrix_and_quiet_hours.sql`

- [ ] **Step 1:** Generate timestamp prefix (≥1 second after B2).

- [ ] **Step 2:** Create the migration. Strategy: add a `channels` jsonb column with per-event-per-channel toggles + quiet hours. Existing booleans (weekly_summary_enabled, daily_reminder_enabled, etc.) are kept as the source of truth for the legacy cron paths and treated as the "web_push" channel; new `channels` jsonb defaults mirror them; `in_app` defaults to true.

```sql
-- Add per-channel toggle matrix and quiet-hours window to notification_preferences.
-- Email channel is intentionally not included (cost / rate-limit considerations).
alter table public.notification_preferences
  add column if not exists channels jsonb not null default jsonb_build_object(
    'web_push', jsonb_build_object(
      'booking_created', true,
      'booking_confirmed', true,
      'booking_cancelled', true,
      'booking_rescheduled', true,
      'package_request', true,
      'package_approved', true,
      'pre_event', true,
      'daily_reminder', true,
      'weekly_summary', true
    ),
    'in_app', jsonb_build_object(
      'booking_created', true,
      'booking_confirmed', true,
      'booking_cancelled', true,
      'booking_rescheduled', true,
      'package_request', true,
      'package_approved', true,
      'pre_event', true,
      'daily_reminder', true,
      'weekly_summary', true
    )
  ),
  add column if not exists quiet_hours_start time,
  add column if not exists quiet_hours_end time;

comment on column public.notification_preferences.channels is
  'Per-channel-per-event toggle matrix. Top-level keys: web_push, in_app. Email intentionally omitted.';
comment on column public.notification_preferences.quiet_hours_start is
  'Local-time start of do-not-disturb window (null = disabled). Inclusive.';
comment on column public.notification_preferences.quiet_hours_end is
  'Local-time end of do-not-disturb window (null = disabled). Exclusive. Wraps midnight if end < start.';
```

- [ ] **Step 3:** Existing RLS on `notification_preferences` (self-only) covers the new columns. Verify by reading `supabase/migrations/20260521120722_notifications_rls.sql`. If the policies are `using (user_id = auth.uid())` style, nothing to add.

- [ ] **Step 4:** Apply:

```bash
npx supabase db push
```

Expected: clean apply.

- [ ] **Step 5:** Commit:

```bash
git add supabase/migrations/<TS>_notification_prefs_matrix_and_quiet_hours.sql
git commit -m "feat(schema): notification_preferences event×channel matrix + quiet hours

Adds jsonb 'channels' (web_push + in_app per event type) and quiet_hours_start/end. Email channel intentionally omitted — cost/quota TBD, tracked as Phase 2 backlog.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase C — Primitives

> Test convention: place component tests at `tests/unit/components/<area>/<name>.test.tsx`. Each test imports the component under test, renders via `@testing-library/react`, and asserts on rendered DOM. Vitest globals are enabled (`describe`/`it`/`expect`).

### Task C1: Extend Button — `withArrow` and `fullWidth`

**Files:**
- Modify: `src/components/ui/button.tsx`
- Test: `tests/unit/components/ui/button.test.tsx`

- [ ] **Step 1:** Write the failing tests. Create `tests/unit/components/ui/button.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Button } from '@/components/ui/button'

describe('Button extensions', () => {
  it('renders fullWidth class when fullWidth prop set', () => {
    render(<Button fullWidth>Go</Button>)
    expect(screen.getByRole('button')).toHaveClass('w-full')
  })

  it('renders arrow circle indicator when withArrow="circle"', () => {
    render(<Button withArrow="circle">Go</Button>)
    expect(screen.getByTestId('btn-arrow-circle')).toBeInTheDocument()
  })

  it('renders inline arrow indicator when withArrow="inline"', () => {
    render(<Button withArrow="inline">Go</Button>)
    expect(screen.getByTestId('btn-arrow-inline')).toBeInTheDocument()
  })

  it('does not render arrow when withArrow not provided', () => {
    render(<Button>Go</Button>)
    expect(screen.queryByTestId('btn-arrow-circle')).not.toBeInTheDocument()
    expect(screen.queryByTestId('btn-arrow-inline')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2:** Run, expect FAIL.

```bash
npm run test -- tests/unit/components/ui/button.test.tsx
```

Expected: 4 tests fail (component doesn't yet support these props).

- [ ] **Step 3:** Update `src/components/ui/button.tsx`:

```tsx
import { Button as ButtonPrimitive } from '@base-ui/react/button'
import { cva, type VariantProps } from 'class-variance-authority'
import { ArrowRight } from 'lucide-react'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  /* keep existing base classes */
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        /* keep existing variants verbatim */
        default: 'bg-primary text-primary-foreground [a]:hover:bg-primary/80',
        outline:
          'border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground',
        ghost:
          'hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50',
        destructive:
          'bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40',
        link: 'text-primary underline-offset-4 hover:underline',
        accent: 'bg-accent text-accent-foreground hover:bg-accent/85',
        'pill-outline': 'rounded-full border-border bg-transparent text-foreground hover:bg-muted',
      },
      size: {
        default:
          'h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2',
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: 'h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2',
        xl: 'h-11 gap-2 px-5 text-sm has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4',
        pill: 'h-11 gap-2 rounded-full px-5 text-sm',
        icon: 'size-8',
        'icon-xs':
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        'icon-sm':
          'size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg',
        'icon-lg': 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

type ButtonExtraProps = {
  fullWidth?: boolean
  withArrow?: 'circle' | 'inline'
}

function Button({
  className,
  variant = 'default',
  size = 'default',
  fullWidth,
  withArrow,
  children,
  ...props
}: ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants> &
  ButtonExtraProps) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(
        buttonVariants({ variant, size, className }),
        fullWidth && 'w-full',
      )}
      {...props}
    >
      {children}
      {withArrow === 'inline' && (
        <ArrowRight
          data-testid="btn-arrow-inline"
          className="ml-0.5 size-[14px]"
          aria-hidden
        />
      )}
      {withArrow === 'circle' && (
        <span
          data-testid="btn-arrow-circle"
          aria-hidden
          className="ml-1.5 inline-flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground"
        >
          <ArrowRight className="size-[13px]" />
        </span>
      )}
    </ButtonPrimitive>
  )
}

export { Button, buttonVariants }
```

- [ ] **Step 4:** Run, expect PASS.

```bash
npm run test -- tests/unit/components/ui/button.test.tsx
```

Expected: 4 pass.

- [ ] **Step 5:** Commit:

```bash
git add src/components/ui/button.tsx tests/unit/components/ui/button.test.tsx
git commit -m "feat(ui): extend Button with fullWidth and withArrow (circle|inline)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task C2: `Kicker` component

**Files:**
- Create: `src/components/ui/kicker.tsx`
- Test: `tests/unit/components/ui/kicker.test.tsx`

- [ ] **Step 1:** Create failing test:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Kicker } from '@/components/ui/kicker'

describe('Kicker', () => {
  it('renders children with mono uppercase tracking', () => {
    render(<Kicker>DASHBOARD · OVERVIEW</Kicker>)
    const el = screen.getByText('DASHBOARD · OVERVIEW')
    expect(el).toHaveClass('font-mono')
    expect(el.className).toMatch(/tracking-\[0\.18em\]/)
    expect(el.className).toMatch(/uppercase/)
  })
  it('merges className prop', () => {
    render(<Kicker className="custom-x">KICK</Kicker>)
    expect(screen.getByText('KICK')).toHaveClass('custom-x')
  })
})
```

- [ ] **Step 2:** Run, expect FAIL: `Cannot find module '@/components/ui/kicker'`.

- [ ] **Step 3:** Implement:

```tsx
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Kicker({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground',
        className,
      )}
    >
      {children}
    </div>
  )
}
```

- [ ] **Step 4:** Run, expect PASS.

- [ ] **Step 5:** Commit:

```bash
git add src/components/ui/kicker.tsx tests/unit/components/ui/kicker.test.tsx
git commit -m "feat(ui): add Kicker primitive (mono uppercase tracking-0.18em)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task C3: `EmptyState` component

**Files:**
- Create: `src/components/ui/empty-state.tsx`
- Test: `tests/unit/components/ui/empty-state.test.tsx`

- [ ] **Step 1:** Create failing test:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Calendar } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'

describe('EmptyState', () => {
  it('renders title and optional hint', () => {
    render(
      <EmptyState
        icon={<Calendar data-testid="es-icon" />}
        title="NO BOOKINGS"
        hint="尚無預約"
      />,
    )
    expect(screen.getByText('NO BOOKINGS')).toBeInTheDocument()
    expect(screen.getByText('尚無預約')).toBeInTheDocument()
    expect(screen.getByTestId('es-icon')).toBeInTheDocument()
  })

  it('renders cta when provided', () => {
    render(
      <EmptyState
        icon={<Calendar />}
        title="EMPTY"
        cta={<button>action</button>}
      />,
    )
    expect(screen.getByRole('button', { name: 'action' })).toBeInTheDocument()
  })

  it('has dashed border style', () => {
    const { container } = render(<EmptyState icon={<Calendar />} title="EMPTY" />)
    expect(container.firstChild).toHaveClass('border-dashed')
  })
})
```

- [ ] **Step 2:** Run, expect FAIL.

- [ ] **Step 3:** Implement `src/components/ui/empty-state.tsx`:

```tsx
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function EmptyState({
  icon,
  title,
  hint,
  cta,
  className,
}: {
  icon: ReactNode
  title: string
  hint?: string
  cta?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-2xl border-[1.5px] border-dashed border-border bg-muted/40 p-10 text-center',
        className,
      )}
    >
      <div className="grid size-12 place-items-center rounded-full bg-secondary text-muted-foreground">
        {icon}
      </div>
      <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        {title}
      </div>
      {hint && <p className="font-cjk text-sm text-muted-foreground">{hint}</p>}
      {cta && <div className="mt-2">{cta}</div>}
    </div>
  )
}
```

- [ ] **Step 4:** Run, expect PASS.

- [ ] **Step 5:** Commit:

```bash
git add src/components/ui/empty-state.tsx tests/unit/components/ui/empty-state.test.tsx
git commit -m "feat(ui): add EmptyState primitive (dashed icon + title + hint + cta)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task C4: `KpiCard` component

**Files:**
- Create: `src/components/ui/kpi-card.tsx`
- Test: `tests/unit/components/ui/kpi-card.test.tsx`

- [ ] **Step 1:** Create failing test:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Clock } from 'lucide-react'
import { KpiCard } from '@/components/ui/kpi-card'

describe('KpiCard', () => {
  it('renders label / value / optional unit and hint', () => {
    render(
      <KpiCard
        label="本週待確認"
        value={5}
        unit="筆"
        hint="教練核可中"
        icon={<Clock data-testid="kpi-icon" />}
      />,
    )
    expect(screen.getByText('本週待確認')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('筆')).toBeInTheDocument()
    expect(screen.getByText('教練核可中')).toBeInTheDocument()
    expect(screen.getByTestId('kpi-icon')).toBeInTheDocument()
  })

  it('applies accent border when accent prop true', () => {
    const { container } = render(<KpiCard label="x" value={1} accent />)
    expect(container.firstChild).toHaveClass('border-accent')
  })
})
```

- [ ] **Step 2:** Run, expect FAIL.

- [ ] **Step 3:** Implement `src/components/ui/kpi-card.tsx`:

```tsx
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function KpiCard({
  label,
  value,
  unit,
  hint,
  icon,
  accent,
  className,
}: {
  label: string
  value: number | string
  unit?: string
  hint?: string
  icon?: ReactNode
  accent?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border bg-card p-5 shadow-[0_8px_24px_-18px_rgba(0,0,0,0.18)]',
        accent ? 'border-accent' : 'border-border',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.15em] text-muted-foreground">
          {label}
        </div>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="font-display text-4xl leading-none">{value}</span>
        {unit && (
          <span className="font-cjk text-sm text-muted-foreground">{unit}</span>
        )}
      </div>
      {hint && (
        <div className="font-cjk mt-2 text-xs text-muted-foreground">
          {hint}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4:** Run, expect PASS.

- [ ] **Step 5:** Commit:

```bash
git add src/components/ui/kpi-card.tsx tests/unit/components/ui/kpi-card.test.tsx
git commit -m "feat(ui): add KpiCard primitive

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task C5: `SubNav` component (settings segmented control)

**Files:**
- Create: `src/components/shell/sub-nav.tsx`
- Test: `tests/unit/components/shell/sub-nav.test.tsx`

- [ ] **Step 1:** Create failing test:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { SubNav } from '@/components/shell/sub-nav'

const ITEMS = [
  { href: '/settings/profile', label: '公開頁', eng: 'PROFILE' },
  { href: '/settings/notifications', label: '通知', eng: 'NOTIF' },
]

describe('SubNav', () => {
  it('renders all items', () => {
    render(<SubNav items={ITEMS} active="/settings/profile" />)
    expect(screen.getByText('PROFILE')).toBeInTheDocument()
    expect(screen.getByText('NOTIF')).toBeInTheDocument()
  })

  it('marks the active item with aria-current', () => {
    render(<SubNav items={ITEMS} active="/settings/notifications" />)
    const active = screen.getByText('NOTIF').closest('a')
    expect(active).toHaveAttribute('aria-current', 'page')
  })
})
```

- [ ] **Step 2:** Run, expect FAIL.

- [ ] **Step 3:** Implement `src/components/shell/sub-nav.tsx`:

```tsx
import Link from 'next/link'
import { cn } from '@/lib/utils'

type SubNavItem = { href: string; label: string; eng: string }

export function SubNav({
  items,
  active,
  className,
}: {
  items: SubNavItem[]
  active: string
  className?: string
}) {
  return (
    <nav
      className={cn(
        'inline-flex rounded-full border border-border bg-card p-1 shadow-[0_8px_24px_-18px_rgba(0,0,0,0.18)]',
        className,
      )}
    >
      {items.map((it) => {
        const isActive = it.href === active
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'flex items-baseline gap-2 rounded-full px-4 py-2 text-sm transition',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <span className="font-cjk">{it.label}</span>
            <span className="font-mono text-[10px] tracking-[0.15em] opacity-70">
              {it.eng}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
```

- [ ] **Step 4:** Run, expect PASS.

- [ ] **Step 5:** Commit:

```bash
git add src/components/shell/sub-nav.tsx tests/unit/components/shell/sub-nav.test.tsx
git commit -m "feat(shell): add SubNav segmented control for settings

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task C6: `AppShell` component

**Files:**
- Create: `src/components/shell/app-shell.tsx`
- Test: `tests/unit/components/shell/app-shell.test.tsx`

- [ ] **Step 1:** Create failing test:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { AppShell } from '@/components/shell/app-shell'

describe('AppShell', () => {
  it('renders title and children', () => {
    render(
      <AppShell title="總覽" kicker="DASHBOARD · 2026.05.27">
        <div>page-content</div>
      </AppShell>,
    )
    expect(screen.getByText('總覽')).toBeInTheDocument()
    expect(screen.getByText('DASHBOARD · 2026.05.27')).toBeInTheDocument()
    expect(screen.getByText('page-content')).toBeInTheDocument()
  })

  it('renders subnav slot when provided', () => {
    render(
      <AppShell title="X" subnav={<nav>SUB</nav>}>
        <div>c</div>
      </AppShell>,
    )
    expect(screen.getByText('SUB')).toBeInTheDocument()
  })

  it('renders actions slot when provided', () => {
    render(
      <AppShell title="X" actions={<button>ACT</button>}>
        <div>c</div>
      </AppShell>,
    )
    expect(screen.getByRole('button', { name: 'ACT' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2:** Run, expect FAIL.

- [ ] **Step 3:** Implement `src/components/shell/app-shell.tsx`:

```tsx
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function AppShell({
  title,
  kicker,
  subnav,
  actions,
  children,
  className,
}: {
  title: string
  kicker?: string
  subnav?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('space-y-7', className)}>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          {kicker && (
            <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {kicker}
            </div>
          )}
          <h1 className="font-display text-3xl uppercase leading-tight tracking-tight sm:text-4xl">
            <span className="font-cjk">{title}</span>
          </h1>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </header>
      {subnav && <div>{subnav}</div>}
      <div>{children}</div>
    </div>
  )
}
```

- [ ] **Step 4:** Run, expect PASS.

- [ ] **Step 5:** Commit:

```bash
git add src/components/shell/app-shell.tsx tests/unit/components/shell/app-shell.test.tsx
git commit -m "feat(shell): add AppShell page wrapper with title/kicker/subnav/actions

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task C7: `DateRibbon` component

**Files:**
- Create: `src/components/booking/date-ribbon.tsx`
- Test: `tests/unit/components/booking/date-ribbon.test.tsx`

- [ ] **Step 1:** Create failing test:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { DateRibbon } from '@/components/booking/date-ribbon'

const DATES = ['2026-05-27', '2026-05-28', '2026-05-29']

describe('DateRibbon', () => {
  it('renders all dates as buttons', () => {
    render(
      <DateRibbon
        dates={DATES}
        selected="2026-05-27"
        onSelect={() => {}}
        slotCountByDate={{ '2026-05-27': 5, '2026-05-28': 0, '2026-05-29': 3 }}
      />,
    )
    expect(screen.getAllByRole('button')).toHaveLength(3)
  })

  it('marks selected date with aria-pressed', () => {
    render(
      <DateRibbon
        dates={DATES}
        selected="2026-05-28"
        onSelect={() => {}}
        slotCountByDate={{}}
      />,
    )
    const sel = screen.getAllByRole('button').find((b) => b.getAttribute('aria-pressed') === 'true')
    expect(sel).toBeDefined()
    expect(sel).toHaveTextContent('28')
  })

  it('calls onSelect with date on click', () => {
    const onSelect = vi.fn()
    render(
      <DateRibbon
        dates={DATES}
        selected="2026-05-27"
        onSelect={onSelect}
        slotCountByDate={{}}
      />,
    )
    fireEvent.click(screen.getAllByRole('button')[1])
    expect(onSelect).toHaveBeenCalledWith('2026-05-28')
  })

  it('shows slot count when > 0', () => {
    render(
      <DateRibbon
        dates={DATES}
        selected="2026-05-27"
        onSelect={() => {}}
        slotCountByDate={{ '2026-05-27': 5 }}
      />,
    )
    expect(screen.getByText('5')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2:** Run, expect FAIL.

- [ ] **Step 3:** Implement `src/components/booking/date-ribbon.tsx`:

```tsx
'use client'
import { format, parseISO } from 'date-fns'
import { cn } from '@/lib/utils'

export function DateRibbon({
  dates,
  selected,
  onSelect,
  slotCountByDate,
  className,
}: {
  dates: string[]
  selected: string
  onSelect: (date: string) => void
  slotCountByDate: Record<string, number>
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
    >
      {dates.map((d) => {
        const dt = parseISO(d)
        const isSelected = d === selected
        const count = slotCountByDate[d] ?? 0
        const disabled = count === 0
        return (
          <button
            key={d}
            type="button"
            aria-pressed={isSelected}
            disabled={disabled}
            onClick={() => onSelect(d)}
            className={cn(
              'group flex min-w-[68px] shrink-0 flex-col items-center gap-1 rounded-2xl border px-3 py-3 transition',
              isSelected
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-foreground hover:border-foreground/40',
              disabled && 'opacity-40 cursor-not-allowed',
            )}
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] opacity-70">
              {format(dt, 'EEE')}
            </span>
            <span className="font-display text-2xl leading-none">
              {format(dt, 'd')}
            </span>
            {count > 0 && (
              <span
                className={cn(
                  'font-mono text-[10px] tracking-wider',
                  isSelected ? 'opacity-80' : 'text-muted-foreground',
                )}
              >
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4:** Run, expect PASS.

- [ ] **Step 5:** Commit:

```bash
git add src/components/booking/date-ribbon.tsx tests/unit/components/booking/date-ribbon.test.tsx
git commit -m "feat(booking): add DateRibbon date picker with slot counts

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task C8: `TimeChip` component

**Files:**
- Create: `src/components/booking/time-chip.tsx`
- Test: `tests/unit/components/booking/time-chip.test.tsx`

- [ ] **Step 1:** Create failing test:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { TimeChip } from '@/components/booking/time-chip'

describe('TimeChip', () => {
  it('renders time in open state', () => {
    render(<TimeChip time="16:00" state="open" onSelect={() => {}} />)
    expect(screen.getByText('16:00')).toBeInTheDocument()
    expect(screen.getByRole('button')).not.toBeDisabled()
  })

  it('full state is disabled', () => {
    render(<TimeChip time="16:00" state="full" onSelect={() => {}} />)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('group state shows filled/capacity badge', () => {
    render(
      <TimeChip
        time="16:00"
        state="group"
        group={{ filled: 3, capacity: 4 }}
        onSelect={() => {}}
      />,
    )
    expect(screen.getByText('3/4')).toBeInTheDocument()
  })

  it('selected state has aria-pressed=true', () => {
    render(<TimeChip time="16:00" state="selected" onSelect={() => {}} />)
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true')
  })

  it('calls onSelect on click for open state', () => {
    const onSelect = vi.fn()
    render(<TimeChip time="16:00" state="open" onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onSelect).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2:** Run, expect FAIL.

- [ ] **Step 3:** Implement `src/components/booking/time-chip.tsx`:

```tsx
'use client'
import { cn } from '@/lib/utils'

export type TimeChipState = 'open' | 'full' | 'group' | 'selected'

export function TimeChip({
  time,
  state,
  group,
  onSelect,
  className,
}: {
  time: string
  state: TimeChipState
  group?: { filled: number; capacity: number }
  onSelect: () => void
  className?: string
}) {
  const disabled = state === 'full'
  const isSelected = state === 'selected'
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={isSelected}
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-4 py-2 font-mono text-sm tracking-wider transition',
        isSelected && 'border-primary bg-primary text-primary-foreground',
        state === 'open' && 'border-border bg-card hover:border-foreground/40',
        state === 'group' && 'border-border bg-card hover:border-foreground/40',
        state === 'full' && 'border-border bg-muted text-muted-foreground line-through cursor-not-allowed',
        className,
      )}
    >
      <span>{time}</span>
      {state === 'group' && group && (
        <span
          className={cn(
            'rounded-full px-1.5 py-0.5 text-[10px] font-bold tracking-wider',
            isSelected
              ? 'bg-primary-foreground text-primary'
              : 'bg-accent text-accent-foreground',
          )}
        >
          {group.filled}/{group.capacity}
        </span>
      )}
    </button>
  )
}
```

- [ ] **Step 4:** Run, expect PASS.

- [ ] **Step 5:** Commit:

```bash
git add src/components/booking/time-chip.tsx tests/unit/components/booking/time-chip.test.tsx
git commit -m "feat(booking): add TimeChip with 4 states (open/full/group/selected)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task C9: `RescheduleBanner` component

**Files:**
- Create: `src/components/booking/reschedule-banner.tsx`
- Test: `tests/unit/components/booking/reschedule-banner.test.tsx`

- [ ] **Step 1:** Create failing test:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { RescheduleBanner } from '@/components/booking/reschedule-banner'

describe('RescheduleBanner', () => {
  it('renders booking summary', () => {
    render(
      <RescheduleBanner
        originalSlotLabel="8/19 (二) 16:00"
        serviceName="一對一肌力訓練"
        exitHref="/<slug>"
      />,
    )
    expect(screen.getByText(/改期模式/)).toBeInTheDocument()
    expect(screen.getByText(/8\/19 \(二\) 16:00/)).toBeInTheDocument()
    expect(screen.getByText(/一對一肌力訓練/)).toBeInTheDocument()
  })

  it('renders exit link to exitHref', () => {
    render(
      <RescheduleBanner
        originalSlotLabel="x"
        serviceName="y"
        exitHref="/coach-foo"
      />,
    )
    const link = screen.getByRole('link', { name: /退出改期/ })
    expect(link).toHaveAttribute('href', '/coach-foo')
  })
})
```

- [ ] **Step 2:** Run, expect FAIL.

- [ ] **Step 3:** Implement `src/components/booking/reschedule-banner.tsx`:

```tsx
import Link from 'next/link'
import { Calendar, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export function RescheduleBanner({
  originalSlotLabel,
  serviceName,
  exitHref,
  className,
}: {
  originalSlotLabel: string
  serviceName: string
  exitHref: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-accent bg-accent/30 p-5 sm:items-center',
        className,
      )}
    >
      <div className="flex items-start gap-3 sm:items-center">
        <Calendar className="mt-0.5 size-5 shrink-0 text-foreground sm:mt-0" aria-hidden />
        <div className="space-y-1">
          <div className="font-cjk text-sm font-semibold">
            改期模式 · 選擇新時段後原預約自動取消
          </div>
          <div className="font-cjk text-xs text-muted-foreground">
            正在改期:<span className="font-mono mx-1">{originalSlotLabel}</span> · {serviceName}
          </div>
        </div>
      </div>
      <Link
        href={exitHref}
        className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
      >
        退出改期 <X className="size-3" />
      </Link>
    </div>
  )
}
```

- [ ] **Step 4:** Run, expect PASS.

- [ ] **Step 5:** Commit:

```bash
git add src/components/booking/reschedule-banner.tsx tests/unit/components/booking/reschedule-banner.test.tsx
git commit -m "feat(booking): add RescheduleBanner (yellow banner with exit link)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task C10: `DateStrip` group header component

**Files:**
- Create: `src/components/bookings/date-strip.tsx`
- Test: `tests/unit/components/bookings/date-strip.test.tsx`

- [ ] **Step 1:** Create failing test:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { DateStrip } from '@/components/bookings/date-strip'

describe('DateStrip', () => {
  it('renders group label and eng label for "today"', () => {
    render(<DateStrip groupKey="today" count={3} />)
    expect(screen.getByText('今日')).toBeInTheDocument()
    expect(screen.getByText('TODAY')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('renders correct labels for each group key', () => {
    const { rerender } = render(<DateStrip groupKey="thisWeek" count={5} />)
    expect(screen.getByText('THIS WEEK')).toBeInTheDocument()
    rerender(<DateStrip groupKey="later" count={2} />)
    expect(screen.getByText('LATER')).toBeInTheDocument()
    rerender(<DateStrip groupKey="past" count={10} />)
    expect(screen.getByText('PAST')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2:** Run, expect FAIL.

- [ ] **Step 3:** Implement `src/components/bookings/date-strip.tsx`:

```tsx
import { cn } from '@/lib/utils'

export type DateStripGroup = 'today' | 'thisWeek' | 'later' | 'past'

const LABELS: Record<DateStripGroup, { cn: string; eng: string }> = {
  today: { cn: '今日', eng: 'TODAY' },
  thisWeek: { cn: '本週', eng: 'THIS WEEK' },
  later: { cn: '之後', eng: 'LATER' },
  past: { cn: '已過', eng: 'PAST' },
}

export function DateStrip({
  groupKey,
  count,
  className,
}: {
  groupKey: DateStripGroup
  count: number
  className?: string
}) {
  const { cn: label, eng } = LABELS[groupKey]
  return (
    <div
      className={cn(
        'flex items-baseline justify-between border-b border-border pb-2',
        className,
      )}
    >
      <div className="flex items-baseline gap-3">
        <span className="font-display font-cjk text-xl font-black uppercase">{label}</span>
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          {eng}
        </span>
      </div>
      <span className="font-mono text-[11px] tracking-[0.12em] text-muted-foreground">
        {count}
      </span>
    </div>
  )
}
```

- [ ] **Step 4:** Run, expect PASS.

- [ ] **Step 5:** Commit:

```bash
git add src/components/bookings/date-strip.tsx tests/unit/components/bookings/date-strip.test.tsx
git commit -m "feat(bookings): add DateStrip group header (today/thisWeek/later/past)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task C11: `NotificationMatrix` (events × channels, Web Push + In-app only)

**Files:**
- Create: `src/components/settings/notification-matrix.tsx`
- Test: `tests/unit/components/settings/notification-matrix.test.tsx`

- [ ] **Step 1:** Create failing test:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { NotificationMatrix, type NotificationPrefs } from '@/components/settings/notification-matrix'

const EVENTS = [
  { key: 'booking_created', label: '新預約' },
  { key: 'package_request', label: '套裝申請' },
] as const

const PREFS: NotificationPrefs = {
  web_push: { booking_created: true, package_request: false },
  in_app: { booking_created: true, package_request: true },
}

describe('NotificationMatrix', () => {
  it('renders one row per event and two channel checkboxes per row', () => {
    render(<NotificationMatrix events={[...EVENTS]} prefs={PREFS} onToggle={() => {}} />)
    expect(screen.getByText('新預約')).toBeInTheDocument()
    expect(screen.getByText('套裝申請')).toBeInTheDocument()
    expect(screen.getAllByRole('checkbox')).toHaveLength(EVENTS.length * 2)
  })

  it('reflects prefs values as checkbox state', () => {
    render(<NotificationMatrix events={[...EVENTS]} prefs={PREFS} onToggle={() => {}} />)
    const boxes = screen.getAllByRole('checkbox')
    expect((boxes[0] as HTMLInputElement).checked).toBe(true)  // web_push booking_created
    expect((boxes[1] as HTMLInputElement).checked).toBe(true)  // in_app booking_created
    expect((boxes[2] as HTMLInputElement).checked).toBe(false) // web_push package_request
    expect((boxes[3] as HTMLInputElement).checked).toBe(true)  // in_app package_request
  })

  it('calls onToggle(channel, eventKey, nextValue) on click', () => {
    const onToggle = vi.fn()
    render(<NotificationMatrix events={[...EVENTS]} prefs={PREFS} onToggle={onToggle} />)
    const boxes = screen.getAllByRole('checkbox')
    fireEvent.click(boxes[2]) // toggle web_push package_request from false → true
    expect(onToggle).toHaveBeenCalledWith('web_push', 'package_request', true)
  })
})
```

- [ ] **Step 2:** Run, expect FAIL.

- [ ] **Step 3:** Implement `src/components/settings/notification-matrix.tsx`:

```tsx
'use client'
import { cn } from '@/lib/utils'

export type NotificationChannel = 'web_push' | 'in_app'
export type NotificationPrefs = Record<NotificationChannel, Record<string, boolean>>

const CHANNELS: { key: NotificationChannel; label: string; eng: string }[] = [
  { key: 'web_push', label: '推播', eng: 'WEB PUSH' },
  { key: 'in_app', label: '站內', eng: 'IN-APP' },
]

export function NotificationMatrix({
  events,
  prefs,
  onToggle,
  className,
}: {
  events: { key: string; label: string }[]
  prefs: NotificationPrefs
  onToggle: (channel: NotificationChannel, eventKey: string, next: boolean) => void
  className?: string
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border border-border bg-card',
        className,
      )}
    >
      <div className="grid grid-cols-[1fr_minmax(80px,auto)_minmax(80px,auto)] gap-x-4 px-5 py-3 border-b border-border">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          EVENT
        </span>
        {CHANNELS.map((c) => (
          <div key={c.key} className="text-center">
            <div className="font-cjk text-xs font-semibold">{c.label}</div>
            <div className="font-mono text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
              {c.eng}
            </div>
          </div>
        ))}
      </div>
      {events.map((ev, i) => (
        <div
          key={ev.key}
          className={cn(
            'grid grid-cols-[1fr_minmax(80px,auto)_minmax(80px,auto)] items-center gap-x-4 px-5 py-3',
            i < events.length - 1 && 'border-b border-border',
          )}
        >
          <span className="font-cjk text-sm">{ev.label}</span>
          {CHANNELS.map((c) => (
            <label key={c.key} className="flex justify-center">
              <input
                type="checkbox"
                checked={Boolean(prefs[c.key]?.[ev.key])}
                onChange={(e) => onToggle(c.key, ev.key, e.target.checked)}
                className="size-4 accent-foreground"
              />
            </label>
          ))}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4:** Run, expect PASS.

- [ ] **Step 5:** Commit:

```bash
git add src/components/settings/notification-matrix.tsx tests/unit/components/settings/notification-matrix.test.tsx
git commit -m "feat(settings): add NotificationMatrix (web_push x in_app, no email)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task C12: `QuietHoursInput` component

**Files:**
- Create: `src/components/settings/quiet-hours-input.tsx`
- Test: `tests/unit/components/settings/quiet-hours-input.test.tsx`

- [ ] **Step 1:** Create failing test:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { QuietHoursInput } from '@/components/settings/quiet-hours-input'

describe('QuietHoursInput', () => {
  it('renders enabled toggle, start, end inputs', () => {
    render(<QuietHoursInput start="22:00" end="07:00" onChange={() => {}} />)
    expect(screen.getByLabelText(/勿擾時段/)).toBeChecked()
    expect(screen.getByDisplayValue('22:00')).toBeInTheDocument()
    expect(screen.getByDisplayValue('07:00')).toBeInTheDocument()
  })

  it('shows disabled state when both are null', () => {
    render(<QuietHoursInput start={null} end={null} onChange={() => {}} />)
    expect(screen.getByLabelText(/勿擾時段/)).not.toBeChecked()
  })

  it('calls onChange when start changes', () => {
    const onChange = vi.fn()
    render(<QuietHoursInput start="22:00" end="07:00" onChange={onChange} />)
    fireEvent.change(screen.getByDisplayValue('22:00'), { target: { value: '23:00' } })
    expect(onChange).toHaveBeenCalledWith({ start: '23:00', end: '07:00' })
  })
})
```

- [ ] **Step 2:** Run, expect FAIL.

- [ ] **Step 3:** Implement `src/components/settings/quiet-hours-input.tsx`:

```tsx
'use client'
import { cn } from '@/lib/utils'

export function QuietHoursInput({
  start,
  end,
  onChange,
  className,
}: {
  start: string | null
  end: string | null
  onChange: (next: { start: string | null; end: string | null }) => void
  className?: string
}) {
  const enabled = start !== null && end !== null
  return (
    <div className={cn('rounded-2xl border border-border bg-card p-5', className)}>
      <label className="flex items-center gap-2 font-cjk text-sm font-semibold">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) =>
            onChange(
              e.target.checked
                ? { start: '22:00', end: '07:00' }
                : { start: null, end: null },
            )
          }
          className="size-4 accent-foreground"
        />
        勿擾時段
      </label>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          type="time"
          value={start ?? ''}
          disabled={!enabled}
          onChange={(e) => onChange({ start: e.target.value, end })}
          className="font-mono rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-40"
        />
        <span className="font-mono text-xs text-muted-foreground">至</span>
        <input
          type="time"
          value={end ?? ''}
          disabled={!enabled}
          onChange={(e) => onChange({ start, end: e.target.value })}
          className="font-mono rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-40"
        />
      </div>
      <p className="font-cjk mt-3 text-xs text-muted-foreground">
        勿擾時段內推播會延後到結束時段後發送。跨午夜時段(例: 22:00 → 07:00)會正確處理。
      </p>
    </div>
  )
}
```

- [ ] **Step 4:** Run, expect PASS.

- [ ] **Step 5:** Commit:

```bash
git add src/components/settings/quiet-hours-input.tsx tests/unit/components/settings/quiet-hours-input.test.tsx
git commit -m "feat(settings): add QuietHoursInput time-range with enable toggle

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task C13: Index re-export for primitives

**Files:**
- Modify (or create if missing): `src/components/ui/index.ts`

> No new test — pure re-export aggregation for convenience.

- [ ] **Step 1:** Check current state of `src/components/ui/index.ts`. If absent, create. If present, add the new exports.

- [ ] **Step 2:** Ensure the file exports the new primitives. Open / create `src/components/ui/index.ts` with content:

```ts
export { Button, buttonVariants } from './button'
export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './card'
export { Badge, StatusBadge } from './badge'
export { Kicker } from './kicker'
export { EmptyState } from './empty-state'
export { KpiCard } from './kpi-card'
export { SectionHead } from './section-head'
export { PrimaryCta, PrimaryCtaLink } from './primary-cta'
```

(If a barrel already exists, merge in only the new entries — `Kicker`, `EmptyState`, `KpiCard`.)

- [ ] **Step 2.5:** Verify imports resolve:

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3:** Commit:

```bash
git add src/components/ui/index.ts
git commit -m "chore(ui): re-export new primitives via ui barrel

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase D — Dev Seed

### Task D1: Write `supabase/seed.sql` comprehensive demo data

**Files:**
- Modify: `supabase/seed.sql` (replace docs-only file)
- Create: `scripts/reset-and-seed.sh` (optional convenience)

- [ ] **Step 1:** Read current `supabase/seed.sql` to confirm it's the docs-only stub (16 lines, mostly comments). Preserve the platform-admin bootstrap comment block at the top.

- [ ] **Step 2:** Replace `supabase/seed.sql` with comprehensive demo data. **Note:** auth.users entries cannot be safely seeded via `seed.sql` (they belong to Supabase Auth's domain). Use a sentinel pattern: insert tenant + customers using deterministic UUIDs and skip auth wiring (or rely on existing test users). Use this content:

```sql
-- supabase/seed.sql
-- Optional seed data for local/dev environments. Production platform admins
-- must be inserted manually via SQL Editor (see header in legacy seed below).

-- ─────────────── Platform admin bootstrap (manual, see README) ───────────────
-- insert into public.platform_admins (user_id) values ('<your-uuid>') on conflict do nothing;

-- ─────────────── Dev demo: tenant + services + slots + bookings ─────────────
-- Deterministic UUIDs so re-running `supabase db reset` produces same demo state.
-- Skips auth.users wiring; assumes the dev DB will have synthetic owners or no
-- live login flow is needed for demo browsing.

do $$
declare
  v_tenant_id    uuid := '11111111-1111-1111-1111-111111111111';
  v_owner_id     uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1';
  v_staff_id     uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2';
  v_cust1_id     uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1';
  v_cust2_id     uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2';
  v_cust3_id     uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3';
  v_svc_1on1_id  uuid := 'cccccccc-cccc-cccc-cccc-ccccccccccc1';
  v_svc_group_id uuid := 'cccccccc-cccc-cccc-cccc-ccccccccccc2';
  v_pkg_1on1_id  uuid := 'dddddddd-dddd-dddd-dddd-ddddddddddd1';
  v_pkg_group_id uuid := 'dddddddd-dddd-dddd-dddd-ddddddddddd2';
begin
  -- Skip if demo tenant already present (idempotent reseed protection).
  if exists (select 1 from public.tenants where id = v_tenant_id) then
    raise notice 'Demo tenant already seeded — skipping.';
    return;
  end if;

  -- TENANT
  insert into public.tenants (
    id, slug, name, status, description, avatar_url,
    contact_email, contact_phone, contact_line_id, contact_note,
    bio_html, intro_video_url,
    years_exp, established_year, city
  ) values (
    v_tenant_id, 'coach-poyu', '陳柏宇教練', 'active',
    '一對一肌力訓練 · 七年經驗',
    null,
    'poyu@example.com', '0912-345-678', 'poyu_coach', '預約請先填表',
    '<p>我是 <strong>柏宇</strong>，從事一對一肌力訓練教學已邁入第七年。我相信運動的核心不在於追求短期成果，而是讓你長期、規律地把訓練放進日常生活裡。</p><p>訓練前先評估、再設計動作組合;過程中以姿勢與技術為優先、循序加重。</p>',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    7, 2018, 'TAIPEI · 內湖'
  );

  -- SERVICES (one 1on1 + one group)
  insert into public.services (
    id, tenant_id, name, description, duration_minutes, price,
    max_capacity, min_attendance, cancel_deadline_hours, is_active
  ) values
    (v_svc_1on1_id, v_tenant_id, '一對一肌力訓練',
     '60 分鐘專屬訓練,含評估與動作矯正', 60, 2000, 1, 1, 24, true),
    (v_svc_group_id, v_tenant_id, '小團體 (3-4 人)',
     '小團班肌力訓練,適合朋友/同事一起練', 75, 800, 4, 3, 24, true);

  -- PACKAGES
  insert into public.service_packages (
    id, service_id, name, sessions_total, price, is_active, is_popular
  ) values
    (v_pkg_1on1_id, v_svc_1on1_id, '一對一 10 堂', 10, 18000, true, true),
    (v_pkg_group_id, v_svc_group_id, '小團體 12 堂', 12, 8400, true, false);

  -- CUSTOMERS
  insert into public.customers (id, display_name, email)
  values
    (v_cust1_id, '王小明', 'demo1@example.com'),
    (v_cust2_id, '李美玲', 'demo2@example.com'),
    (v_cust3_id, '周宇翔', 'demo3@example.com');

  insert into public.tenant_customers (tenant_id, customer_id, blocked)
  values
    (v_tenant_id, v_cust1_id, false),
    (v_tenant_id, v_cust2_id, false),
    (v_tenant_id, v_cust3_id, false);

  -- AVAILABILITY SLOTS — today + next 14 days at 10:00, 14:00, 16:00
  insert into public.availability_slots (tenant_id, member_user_id, service_id, start_at, end_at, status)
  select
    v_tenant_id,
    null,
    v_svc_1on1_id,
    (current_date + d)::timestamp + (h::text || ':00')::time,
    (current_date + d)::timestamp + (h::text || ':00')::time + interval '60 minutes',
    'open'
  from generate_series(0, 14) d
  cross join (values (10), (14), (16)) as t(h);

  -- BOOKINGS — a few across statuses on today + tomorrow
  -- (Bookings need a customer_id and slot_id; pick first 4 slots today.)
  with picks as (
    select id, row_number() over (order by start_at) as r
    from public.availability_slots
    where tenant_id = v_tenant_id
      and start_at::date = current_date
    limit 4
  )
  insert into public.bookings (slot_id, customer_id, status, notes)
  select p.id, c.cust_id, c.st, '示範資料'
  from picks p
  join (values
    (1, v_cust1_id, 'confirmed'),
    (2, v_cust2_id, 'pending'),
    (3, v_cust3_id, 'confirmed'),
    (4, v_cust1_id, 'pending')
  ) as c(r, cust_id, st) on c.r = p.r;

  raise notice 'Demo data seeded for tenant %', v_tenant_id;
end$$;
```

> **Note for the implementer:** The above is the **starting shape**. Open `src/lib/supabase/*` or recent migrations to confirm exact column names (e.g. `bookings.notes` vs `bookings.note`, `availability_slots.member_user_id` exists or not). Adjust the seed accordingly. Run `npx supabase db reset` and watch the apply log for column-mismatch errors; fix iteratively.

- [ ] **Step 3:** Apply and verify:

```bash
npx supabase db reset
```

Expected: all migrations apply then seed runs without error. Final state has 1 tenant + 2 services + 3 customers + 45 slots + 4 bookings.

- [ ] **Step 4:** Smoke check by hitting the public page (in another terminal start dev server):

```bash
npm run dev
# then visit http://localhost:3000/coach-poyu
```

Expected: page renders, services + slot picker show seeded data.

- [ ] **Step 5:** Commit:

```bash
git add supabase/seed.sql
git commit -m "feat(seed): comprehensive dev demo data (tenant + services + slots + bookings)

Idempotent on re-reset (skip if demo tenant already exists). Customers seeded without auth.users wiring — demo browsing only, login flow uses real signup against dev project.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase E — Lint, Typecheck, Test Gate

### Task E1: Run full quality gates

**Files:** none (verification only)

- [ ] **Step 1:** Run lint:

```bash
npm run lint
```

Expected: no errors. Fix any warnings introduced by new files.

- [ ] **Step 2:** Run typecheck:

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3:** Run unit tests:

```bash
npm run test
```

Expected: all new component tests pass + all existing tests still pass.

- [ ] **Step 4:** Run build:

```bash
npm run build
```

Expected: build succeeds. Watch for any new export collisions from the ui barrel.

- [ ] **Step 5:** If anything fails, fix root cause and re-run. **Do not skip hooks or bypass gates.** Commit fixes as small focused commits with `fix(...)` prefix.

---

## Done Criteria for Plan 1

- 3 schema migrations applied (hero meta, is_popular, notif matrix + quiet hours), each with RLS verified
- `supabase/seed.sql` produces complete demo state on `db reset`
- 10 new primitives + Button extension shipped under `src/components/{ui,shell,booking,bookings,settings}/`
- Every primitive has a Vitest smoke test that passes
- `npm run lint` / `npm run typecheck` / `npm run test` / `npm run build` all green
- No commits to `claudeDesign/` (leave it untracked — separate decision)

## Out of Scope for Plan 1 (covered by later plans)

- Plan 2: Student 6 pages alignment
- Plan 3: Coach Backoffice 7 pages alignment
- Plan 4: Coach Settings 4 pages alignment
- Plan 5: Final QA pass (17 pages × 4 breakpoints) + docs update

---

## Self-Review Notes

**Spec coverage:**
- ✅ Schema: all 3 missing-fields groups identified in spec are addressed (B1/B2/B3)
- ✅ Primitives: all 13 listed (Card extension dropped — shadcn Card already covers `padded/muted/elevated` via className composition, no extension needed)
- ✅ Email omission: NotificationMatrix explicitly has only `web_push + in_app`; migration jsonb has no `email` key
- ✅ Seed mechanism: standard `supabase/seed.sql`, runs on `db reset`

**Placeholder scan:** Migration timestamps shown as `<TS>` to be generated at execution time — explicit instruction in Step 1. No other placeholders.

**Type consistency:**
- `NotificationChannel = 'web_push' | 'in_app'` defined in `notification-matrix.tsx` and used consistently
- `TimeChipState` defined and used
- `DateStripGroup` defined and used
- `withArrow` accepts `'circle' | 'inline'` consistently in tests and impl
