# claudeDesign UI Alignment · Plan 3 — Coach Backoffice 7 Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the 7 coach backoffice pages (`/dashboard`, `/calendar`, `/services`, `/customers`, `/packages`, `/packages/pending`, `/notifications`) to the `claudeDesign/coach/` mockup using primitives from Plan 1 and the patterns established in Plan 2.

**Architecture:** Per-page integration tasks. Each task reads its mockup file + current page + relevant P1 primitives, then applies layout changes section by section. No TDD for page layout — verification is `npm run lint && typecheck && test` regression gate + browser spot check.

**Tech Stack:** Next.js 15 App Router (RSC + Server Actions), React 19, Tailwind v4, P1 primitives (`AppShell`, `Btn`, `Kicker`, `EmptyState`, `KpiCard`, `SubNav`, `DateRibbon`, `TimeChip`, `DateStrip`), Supabase, next-themes.

**Spec:** `docs/superpowers/specs/2026-05-27-claudedesign-ui-alignment-design.md` — section §4b covers these pages.

**Mockup root:** `claudeDesign/coach/` — page-dashboard.jsx, page-calendar.jsx, page-services-customers.jsx (combined!), page-packages.jsx, page-notifications.jsx.

---

## Convention notes (apply to every task)

- **Tokens only.** Never hardcode colors/radii. Use `bg-card`, `text-muted-foreground`, `border-accent`, `rounded-2xl`, etc.
- **Bilingual headers** use `<SectionHead kicker title eng hint right>`.
- **Buttons**: primary = `<Button variant="default" size="pill" withArrow="inline">` or `<PrimaryCta>`. Secondary = `<Button variant="outline">`. Ghost = `<Button variant="ghost">`. Accent yellow buttons = `<Button variant="accent">` (only on dark surfaces or as punctuation).
- **Cards**: `rounded-2xl border border-border bg-card shadow-[0_8px_24px_-18px_rgba(0,0,0,0.18)]`.
- **Accent yellow = punctuation only** (badge / Pill yellow / arrow circle / kicker dot / NEXT-UP highlight / accent button on primary surface). Never large yellow surfaces.
- **`'use client'` only when needed** — server components by default.
- **Don't add WHAT-explaining comments.** Only WHY (per CLAUDE.md).
- **Reuse over reinvent.**
- **Existing tenant chrome stays** — the sidebar at `src/app/(tenant)/layout.tsx` is the page wrapper. Pages render into the `<main>` slot.

---

## Schema readiness recap

All P1 + Plan 2 schema work is in place. Plan 3 should not add new columns. Pages will lean on these existing tables (verified A1 audit):
- `bookings` — id, slot_id, customer_id, service_id, tenant_id, status, customer_notes, tenant_notes, purchase_id, created_at, cancelled_at, cancelled_by
- `availability_slots` — id, tenant_id, member_id (FK tenant_members), service_id, start_at, end_at, status
- `services` — id, tenant_id, name, description, duration_minutes, price, max_capacity, min_attendance, cancel_deadline_hours, is_active
- `service_packages` — id, tenant_id, service_id, name, class_count, price, expires_in_days, is_active, is_popular
- `customer_purchases` — purchase records (used for "packages/pending")
- `tenant_customers` — bridge table with `is_blocked`, `tenant_notes`
- `customers` — id (FK auth.users), display_name, phone, email (via auth.users)
- `tenant_members` — id, tenant_id, user_id (FK auth.users), role
- `notification_log` — id, user_id, type, related_id, channel, status, sent_at — "audit log of notifications sent"

**`/notifications` gap:** Mockup wants a notification "inbox" list (read/unread state per item). Current `/notifications` is a wrapper around `<NotificationPreferences>` (preferences UI — which actually belongs at `/settings/notifications` per Plan 4). And `notification_log` is a sent-audit table, not an inbox (no `read_at` column).
**Decision for this plan:** Build the inbox list using `notification_log` rows as the source, **without** persisting read/unread state (no new column). The mockup's "unread visual" can be approximated by treating `sent_at within last 24h` as visually emphasized (yellow side bar). Spec §4b explicitly says "需要 `notification_log` 表延伸或新增 `notifications` 表;先看現況" — this is the "看現況" decision: derive emphasis without schema change. Persistent unread state is deferred to Phase 2.

---

## File Structure Overview

| Page | File(s) modified | Existing size | Magnitude |
|---|---|---|---|
| /dashboard | `src/app/(tenant)/dashboard/page.tsx` | 8.7KB | LARGE rewrite |
| /calendar | `src/app/(tenant)/calendar/page.tsx` (+ may extract slot popover client component) | 8.6KB | LARGE |
| /services | `src/app/(tenant)/services/page.tsx` (+ existing edit/create client comps) | 4.0KB | MEDIUM |
| /customers | `src/app/(tenant)/customers/page.tsx` (+ new drawer client comp) | 5.9KB | LARGE |
| /packages | `src/app/(tenant)/packages/page.tsx` | 5.4KB | MEDIUM |
| /packages/pending | `src/app/(tenant)/packages/pending/page.tsx` | 2.8KB | MEDIUM |
| /notifications | `src/app/(tenant)/notifications/page.tsx` | 0.3KB | LARGE (build from near-scratch) |

---

## Task 1: `/dashboard` Coach Home

**Files:**
- Read: `claudeDesign/coach/page-dashboard.jsx` (mockup; ~205 lines)
- Read: `claudeDesign/coach/atoms.jsx` (Btn / Card / KpiCard mockup atoms for visual intent)
- Modify: `src/app/(tenant)/dashboard/page.tsx` (currently 8.7KB; greeting hero + 2 KPI + 3 quick links + Upcoming bookings list)

**Alignment targets (spec §4b-01 + plan):**

| Section | Required change |
|---|---|
| Greeting hero | Replace white-bg accent-underline hero with **black-bg card**: `bg-primary text-primary-foreground rounded-2xl relative overflow-hidden p-8 sm:p-9`. Right-corner half-transparent yellow circle decoration. Mono date kicker. Big display "{greeting}、{tenant.name}" with a small accent dot. Short summary line. Inside the card: 3 buttons (yellow accent pill with arrow circle "開啟今日行事曆" + 2 outline buttons on dark surface with `border-white/25 text-primary-foreground`) |
| KPI grid | **4 KpiCards** (was 2):本週待確認 / 本週確認 / 套裝待審 / 本月新學員. `pendingCount > 0` triggers `accent` on the pending card. Hint copy can be conditional (e.g. "比上週多 N 堂" only if we can compute it cheaply — otherwise just static helper text). |
| Today timeline | New section. Card with header "今日預約 · {count} 堂". Inside, vertical list of slot+booking rows ordered by slot.start_at. Each row: tabular-nums time on the left, customer name + service line, optional group N/M badge, "NEXT UP" highlight on the next future-or-current row (yellow background). |
| Pending column | Right column on desktop (lg `grid-cols-[1.3fr_1fr]`), stacks below on tablet/mobile. Card containing top 3 pending bookings, each row: name + StatusBadge, service · date · "N 天前", inline confirm/decline buttons. Footer link "查看全部待確認 →" linking to `/bookings?status=pending`. |
| Quick action card | Below pending column. `bg-muted rounded-2xl p-6` card with mono kicker `QUICK ACTIONS`, display heading "還沒設定本週時段?", 2 small buttons (設定作息模板 / 建立重複規則) linking to `/calendar/availability` and `/calendar/rules`. Only render if user has < 5 future slots (cheap heuristic — count from existing weekSlots query). |
| Empty state preview | Below quick-action card. Dashed `<EmptyState>` showing "剛開始使用 QuickReserve?" with link to settings/profile. Only render if tenant.description is null OR no services exist (signal of fresh tenant). |

**Server query changes:**
- Today's bookings — new query: `bookings join availability_slots where slot.start_at::date = current_date and status in ('pending','confirmed') order by slot.start_at`
- 本月新學員 — `select count from tenant_customers where tenant_id = X and created_at >= date_trunc('month', now())`
- These add to existing `Promise.all`.

**Steps:**

- [ ] **Step 1: Read mockup + atoms + current page**

```bash
cat 'claudeDesign/coach/page-dashboard.jsx'
cat 'claudeDesign/coach/atoms.jsx'
cat 'src/app/(tenant)/dashboard/page.tsx'
cat 'src/components/ui/kpi-card.tsx'
cat 'src/components/ui/empty-state.tsx'
cat 'src/components/ui/badge.tsx'
cat 'src/components/ui/button.tsx'
```

- [ ] **Step 2: Add new server queries to Promise.all**

Inside `TenantDashboard()`:

```ts
const monthStart = startOfMonth(now).toISOString()

const [
  pendingRes,
  weekSlotsRes,
  todayBookingsRes,
  pendingBookingsRes,
  newCustomersRes,
] = await Promise.all([
  supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('tenant_id', session.tenantId).eq('status','pending'),
  supabase.from('availability_slots').select('id', { count: 'exact', head: true }).eq('tenant_id', session.tenantId).gte('start_at', todayStart).lte('start_at', weekEnd).neq('status','cancelled'),
  supabase.from('bookings').select('id, status, customers(display_name), services(name, max_capacity), availability_slots!inner(start_at, end_at)').eq('tenant_id', session.tenantId).in('status', ['pending','confirmed']).gte('availability_slots.start_at', todayStart).lte('availability_slots.start_at', addDays(startOfDay(now), 1).toISOString()).order('start_at', { foreignTable: 'availability_slots' }),
  supabase.from('bookings').select('id, status, created_at, customers(display_name), services(name), availability_slots(start_at)').eq('tenant_id', session.tenantId).eq('status', 'pending').order('created_at', { ascending: false }).limit(3),
  supabase.from('tenant_customers').select('customer_id', { count: 'exact', head: true }).eq('tenant_id', session.tenantId).gte('created_at', monthStart),
])

const pendingCount = pendingRes.count ?? 0
const weekSlotsCount = weekSlotsRes.count ?? 0
const todayBookings = todayBookingsRes.data ?? []
const pendingBookings = pendingBookingsRes.data ?? []
const newCustomersCount = newCustomersRes.count ?? 0
```

Add `import { addDays, startOfDay, startOfMonth, format } from 'date-fns'`. The existing imports likely already have most of these.

- [ ] **Step 3: Black hero card**

Replace the current `<header>` block with a black-bg card. Structure:

```tsx
<section className="relative overflow-hidden rounded-2xl bg-primary p-7 text-primary-foreground sm:p-9">
  <div aria-hidden className="absolute -right-10 -top-10 size-[220px] rounded-full bg-accent opacity-20" />
  <div className="relative">
    <Kicker className="text-primary-foreground/70">
      DASHBOARD · {format(now, 'EEE yyyy.MM.dd').toUpperCase()} · {tenant.name}
    </Kicker>
    <h1 className="mt-3 flex flex-wrap items-baseline gap-3.5 font-display text-4xl uppercase leading-[0.95] tracking-tight sm:text-6xl">
      <span className="font-cjk">{greeting}、{tenant.name}</span>
      <span aria-hidden className="inline-block size-3 rounded-full bg-accent" />
    </h1>
    <p className="mt-3.5 max-w-[540px] font-cjk text-sm opacity-75 sm:text-base">
      今天 {todayBookings.length} 堂預約 · {pendingCount} 筆待確認 · 本週 {weekSlotsCount} 個時段。
    </p>
    <div className="mt-6 flex flex-wrap gap-2.5">
      <PrimaryCtaLink href="/calendar">開啟今日行事曆</PrimaryCtaLink>
      <Link href="/calendar/availability">
        <Button variant="outline" size="pill" className="border-white/25 text-primary-foreground hover:bg-white/10 hover:text-primary-foreground">
          <Plus className="size-3.5" /> 建立可用時段
        </Button>
      </Link>
      <Link href="/packages">
        <Button variant="ghost" size="pill" className="text-primary-foreground/85 hover:bg-white/10 hover:text-primary-foreground">
          <Layers className="size-3.5" /> 開放新套裝
        </Button>
      </Link>
    </div>
  </div>
</section>
```

Replace the existing `<header>...</header>` with this. Remove the old `<p className="font-mono mt-4 inline-flex">PUBLIC LINK · /{slug}</p>` block (it moves to the dashboard footer or we drop it — drop it for now; the public link is in the sidebar).

Import `Plus`, `Layers` from `lucide-react`.

- [ ] **Step 4: 4-card KPI grid**

Replace the existing 2-card KPI section with:

```tsx
<section className="grid gap-3 grid-cols-2 lg:grid-cols-4">
  <KpiCard
    label="本週待確認"
    value={pendingCount}
    unit="筆"
    hint={pendingCount === 0 ? '一切就緒' : '需要您回覆確認'}
    icon={<Clock className="size-3.5" />}
    accent={pendingCount > 0}
  />
  <KpiCard
    label="本週時段"
    value={weekSlotsCount}
    unit="個"
    hint="未來 7 天可預約"
    icon={<Check className="size-3.5" />}
  />
  <KpiCard
    label="今日預約"
    value={todayBookings.length}
    unit="堂"
    hint={todayBookings.length === 0 ? '今天沒安排' : '依時間排序'}
    icon={<Calendar className="size-3.5" />}
    accent={todayBookings.length > 0}
  />
  <KpiCard
    label="本月新學員"
    value={newCustomersCount}
    unit="位"
    hint="加入學員名單"
    icon={<Users className="size-3.5" />}
  />
</section>
```

Note: The spec mockup says KPI #3 should be "套裝待審" but counting purchase requests requires another query. **Pragmatic substitution:** use "今日預約" (already fetched) as the 3rd KPI. If you want the literal mockup, add another count query for `customer_purchases where status='pending'` — but check the actual column names first.

Import `KpiCard`, `Clock`, `Check`, `Users` (Calendar is likely already imported).

- [ ] **Step 5: Today timeline + Pending column (two-column layout)**

Replace the existing single "Upcoming bookings" section with a two-column layout:

```tsx
<section className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
  {/* TODAY */}
  <div className="rounded-2xl border border-border bg-card overflow-hidden">
    <div className="flex items-baseline justify-between border-b border-border px-6 py-4">
      <h2 className="font-display font-cjk text-xl font-black uppercase">今日預約</h2>
      <span className="font-mono text-[11px] tracking-[0.1em] text-muted-foreground">
        {todayBookings.length} 堂
      </span>
    </div>
    {todayBookings.length === 0 ? (
      <div className="p-10">
        <EmptyState
          icon={<Calendar className="size-5" />}
          title="今天沒有預約"
          hint="可以早點下班 ☕"
        />
      </div>
    ) : (
      <div className="space-y-2 p-5">
        {todayBookings.map((b, i) => {
          const slot = b.availability_slots as { start_at: string; end_at: string } | null
          const customer = b.customers as { display_name: string | null } | null
          const service = b.services as { name: string; max_capacity: number } | null
          const isNext = nextUpIndex === i  // computed before render
          const isGroup = (service?.max_capacity ?? 1) > 1
          return (
            <div key={b.id} className={cn(
              'flex items-center gap-3 rounded-xl border p-3',
              isNext ? 'border-accent bg-accent/15' : 'border-border bg-card'
            )}>
              <div className="font-display w-16 text-xl tabular-nums tracking-[0.02em]">
                {slot ? format(toLocal(slot.start_at), 'HH:mm') : '—'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-cjk text-sm font-semibold truncate">{customer?.display_name ?? '匿名'}</div>
                <div className="font-cjk text-xs text-muted-foreground mt-0.5 truncate">{service?.name}</div>
              </div>
              {isGroup && (
                <span className="font-mono rounded-full bg-accent text-accent-foreground px-2 py-0.5 text-[10px] font-bold tracking-wider">
                  N/M
                </span>
              )}
              {isNext && (
                <span className="font-mono text-[10px] font-bold tracking-wider">NEXT UP</span>
              )}
            </div>
          )
        })}
      </div>
    )}
  </div>

  {/* PENDING */}
  <div className="flex flex-col gap-4">
    {/* Pending list card */}
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="flex items-baseline justify-between border-b border-border px-6 py-4">
        <h2 className="font-display font-cjk text-lg font-black uppercase">待確認預約</h2>
        <span className="font-mono text-[11px] tracking-[0.1em] text-muted-foreground">
          {pendingCount} 筆
        </span>
      </div>
      {pendingBookings.length === 0 ? (
        <div className="p-6">
          <EmptyState
            icon={<Check className="size-5" />}
            title="沒有待確認"
            hint="所有預約都已處理 👍"
          />
        </div>
      ) : (
        <>
          <div>
            {pendingBookings.map((p, i) => {
              const customer = p.customers as { display_name: string | null } | null
              const service = p.services as { name: string } | null
              const slot = p.availability_slots as { start_at: string } | null
              const since = formatDistanceToNow(new Date(p.created_at), { addSuffix: true, locale: zhTW })
              return (
                <div key={p.id} className={cn(
                  'px-6 py-3.5',
                  i < pendingBookings.length - 1 && 'border-b border-border'
                )}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-cjk text-sm font-semibold truncate">{customer?.display_name ?? '匿名'}</span>
                    <StatusBadge status="pending" />
                  </div>
                  <div className="font-cjk mt-1 text-xs text-muted-foreground">
                    {service?.name}
                    {slot && <> · {format(toLocal(slot.start_at), 'M/d HH:mm')}</>}
                    {' · '}{since}
                  </div>
                  {/* inline confirm/decline buttons would need server actions wired —
                      for Plan 3, link to /bookings instead; keep this simple */}
                </div>
              )
            })}
          </div>
          <div className="border-t border-border px-6 py-3">
            <Link href="/bookings" className="font-mono text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              查看全部待確認 <ArrowRight className="size-3" />
            </Link>
          </div>
        </>
      )}
    </div>

    {/* Quick action card (conditional) */}
    {weekSlotsCount < 5 && (
      <div className="rounded-2xl bg-muted p-6">
        <Kicker>QUICK ACTIONS</Kicker>
        <h3 className="mt-2 font-display font-cjk text-lg font-black">還沒設定本週時段?</h3>
        <p className="mt-1.5 font-cjk text-xs text-muted-foreground">
          用作息模板一次設定整週的時段、或用重複規則自動展開未來四週。
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/calendar/availability">
            <Button variant="default" size="sm" withArrow="inline">設定作息模板</Button>
          </Link>
          <Link href="/calendar/rules">
            <Button variant="outline" size="sm">建立重複規則</Button>
          </Link>
        </div>
      </div>
    )}

    {/* Empty state preview (conditional — fresh tenant signal) */}
    {!tenant.description && (
      <EmptyState
        icon={<Sparkles className="size-5" />}
        title="剛開始使用 QuickReserve?"
        hint={<>完成 4 步驟讓你的 <span className="font-mono bg-secondary px-1.5 py-0.5 rounded text-[10.5px]">/{tenant.slug}</span> 上線。</>}
        cta={<Link href="/settings/profile"><Button variant="default" size="sm" withArrow="inline">前往設定</Button></Link>}
      />
    )}
  </div>
</section>
```

Compute `nextUpIndex` before the JSX:

```ts
const nowMs = Date.now() + TZ_OFFSET_HOURS * 3600 * 1000
const nextUpIndex = todayBookings.findIndex(b => {
  const s = b.availability_slots as { start_at: string } | null
  if (!s) return false
  return new Date(s.start_at).getTime() >= Date.now()
})
```

Imports needed: `Calendar`, `Check`, `Sparkles`, `ArrowRight`, `formatDistanceToNow` from date-fns, `zhTW` from date-fns/locale, `cn` from `@/lib/utils`, `EmptyState`, `Kicker`, `KpiCard`, `StatusBadge`. The `EmptyState` accepts `hint?: string` only per its current signature — to render JSX (the slug in mono), either change the EmptyState `hint` prop to `ReactNode` (small primitive update OK in this task), or render the JSX hint as `cta` or just plain string. **For this task, just pass the slug as plain string in `hint`:** `hint={`/${tenant.slug} 還沒設定描述`}`. Don't change EmptyState type.

- [ ] **Step 6: Remove old quick links + upcoming sections**

The current page has a "QUICK ACTIONS / 操作" section (3 link cards) and an "UPCOMING / 即將到來" section. Both are replaced by the new structure above. Delete them.

- [ ] **Step 7: Quality gate**

```bash
npm run lint
npm run typecheck
npm run test
```

All must pass. Fix root cause if any fail.

- [ ] **Step 8: Commit**

```bash
git add 'src/app/(tenant)/dashboard/page.tsx'
git commit -m "$(cat <<'EOF'
feat(dashboard): align /dashboard to claudeDesign mockup

Black hero card with greeting + half-transparent yellow corner decoration, 4 KpiCard grid (replaces 2), today timeline with NEXT UP highlight, pending column with inline list + quick-action card + empty-state preview.

New server queries: today's bookings (joined with slot/customer/service), pending top 3, this-month new customers count. Uses P1 primitives: KpiCard, EmptyState, Kicker.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `/calendar` — 3 Views + Slot Popover

**Files:**
- Read: `claudeDesign/coach/page-calendar.jsx`
- Modify: `src/app/(tenant)/calendar/page.tsx` (8.6KB)
- Read: existing calendar client comps under `src/app/(tenant)/calendar/` (there may be a `slot-detail.tsx` or similar — list directory first)
- Maybe create: `src/app/(tenant)/calendar/view-tabs.tsx` (client component, view switcher)

**Alignment targets (spec §4b-02 + plan):**

1. **View tabs**: 3 segmented tabs Week / List / Month. Use `?view=` query param. Default Week. Style as small pill segmented (similar to SubNav).
2. **Week view**: 7-column grid. Each column = a day with date header (mono + display number). Below header: vertical stack of slot blocks. Slot block shows time range (mono) + service name (cjk) + booking count badge. Group classes show capacity badge.
3. **List view**: by-date grouping. Each group has a date header + list of slots ordered by start_at.
4. **Month view**: month grid 7x5/6. Each cell shows date number + small dot count for slots that day.
5. **Slot popover**: When a slot is clicked, open a popover (or simple expansion) with slot details + edit/cancel actions. **Pragmatic shortcut:** instead of a real popover, the slot block is `<Link>` to `/calendar/slot/[id]` OR shows an in-place expansion. **For Plan 3, skip the popover** — slot block just shows info; existing edit flow stays on its existing route. Flag this as deferred.
6. **Conflict badge**: If a slot has any booking conflict (overlapping bookings or member double-book), show small red badge. **Skip detection logic in this plan** — would need a new query. Flag deferred.
7. **Group capacity badge**: When `service.max_capacity > 1`, show `<count>/<max>` badge on slot.
8. **Owner filter chip**: For Owner role, allow filtering by tenant_member. Existing page may already support `?member=` query. Preserve.

**Steps:**

- [ ] **Step 1: Read mockup + current page + neighboring files**

```bash
cat 'claudeDesign/coach/page-calendar.jsx'
cat 'src/app/(tenant)/calendar/page.tsx'
ls 'src/app/(tenant)/calendar/'
cat 'src/app/(tenant)/layout.tsx'  # to understand chrome
```

- [ ] **Step 2: Add view query param + tabs**

Update the page signature:

```ts
export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: 'week' | 'list' | 'month'; date?: string; member?: string }>
}) {
  const { view = 'week', date, member } = await searchParams
  // ... fetch
}
```

Add a SubNav-like tab strip just below the page title:

```tsx
<div className="mb-5 flex items-center justify-between">
  <SectionHead kicker="CALENDAR · 行事曆" title="行事曆" eng="CALENDAR" />
</div>

<div className="mb-5 inline-flex rounded-full border border-border bg-card p-1">
  {(['week','list','month'] as const).map(v => (
    <Link
      key={v}
      href={{ pathname: '/calendar', query: { ...(member && { member }), ...(date && { date }), view: v } }}
      aria-current={view === v ? 'page' : undefined}
      className={cn(
        'rounded-full px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.15em] transition',
        view === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
      )}
    >
      {v === 'week' ? 'WEEK' : v === 'list' ? 'LIST' : 'MONTH'}
    </Link>
  ))}
</div>
```

Import `SectionHead`, `cn`.

- [ ] **Step 3: Render the active view**

Wrap the existing slot rendering in a branched conditional:

```tsx
{view === 'week' && <WeekView slots={slots} services={servicesById} startDate={weekStart} />}
{view === 'list' && <ListView slots={slots} services={servicesById} />}
{view === 'month' && <MonthView slots={slots} startDate={monthStart} />}
```

Where `WeekView`, `ListView`, `MonthView` are local components defined in the same file (don't extract files unless they exceed ~50 lines each).

- [ ] **Step 4: Implement WeekView**

```tsx
function WeekView({ slots, services, startDate }: { slots: Slot[]; services: Map<string, Service>; startDate: Date }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(startDate, i))
  const slotsByDate = useMemo(() => groupBy(slots, s => format(toLocal(s.start_at), 'yyyy-MM-dd')), [slots])
  return (
    <div className="grid grid-cols-7 gap-2 overflow-x-auto">
      {days.map(d => {
        const key = format(d, 'yyyy-MM-dd')
        const daySlots = slotsByDate.get(key) ?? []
        return (
          <div key={key} className="min-w-[140px] rounded-2xl border border-border bg-card p-3 space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                {format(d, 'EEE')}
              </span>
              <span className="font-display text-xl tabular-nums">{format(d, 'd')}</span>
            </div>
            {daySlots.map(s => {
              const svc = services.get(s.service_id)
              const isGroup = (svc?.max_capacity ?? 1) > 1
              return (
                <div key={s.id} className={cn(
                  'rounded-lg border border-border bg-secondary p-2 text-xs',
                  s.status === 'cancelled' && 'opacity-50 line-through'
                )}>
                  <div className="font-mono">
                    {format(toLocal(s.start_at), 'HH:mm')}–{format(toLocal(s.end_at), 'HH:mm')}
                  </div>
                  <div className="font-cjk mt-0.5 text-[11px] text-muted-foreground truncate">
                    {svc?.name ?? '未命名'}
                  </div>
                  {isGroup && (
                    <span className="font-mono mt-1 inline-block rounded-full bg-accent text-accent-foreground px-1.5 py-0.5 text-[9px] font-bold tracking-wider">
                      GROUP
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
```

> Note: Memoization needs `'use client'` on the component file. Pages here are server components — convert WeekView to non-memoized iteration if Page is server. Use `slotsByDate` as a regular const.

- [ ] **Step 5: Implement ListView**

```tsx
function ListView({ slots, services }: { slots: Slot[]; services: Map<string, Service> }) {
  const byDate = slots.reduce<Map<string, Slot[]>>((acc, s) => {
    const k = format(toLocal(s.start_at), 'yyyy-MM-dd')
    if (!acc.has(k)) acc.set(k, [])
    acc.get(k)!.push(s)
    return acc
  }, new Map())
  return (
    <div className="space-y-5">
      {Array.from(byDate.entries()).map(([dateKey, daySlots]) => (
        <section key={dateKey}>
          <div className="mb-2 flex items-baseline gap-3 border-b border-border pb-2">
            <span className="font-display font-cjk text-xl font-black uppercase">
              {format(parseISO(dateKey), 'M/d (E)', { locale: zhTW })}
            </span>
            <span className="font-mono text-[11px] tracking-[0.18em] text-muted-foreground">
              {daySlots.length} 個時段
            </span>
          </div>
          <div className="space-y-2">
            {daySlots.map(s => {
              const svc = services.get(s.service_id)
              return (
                <div key={s.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                  <span className="font-mono w-24 text-sm tabular-nums">
                    {format(toLocal(s.start_at), 'HH:mm')}–{format(toLocal(s.end_at), 'HH:mm')}
                  </span>
                  <span className="font-cjk flex-1 text-sm">{svc?.name ?? '未命名'}</span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {s.status}
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
```

- [ ] **Step 6: Implement MonthView**

```tsx
function MonthView({ slots, startDate }: { slots: Slot[]; startDate: Date }) {
  const monthStart = startOfMonth(startDate)
  const monthEnd = endOfMonth(startDate)
  const firstWeekday = monthStart.getDay()  // 0 = Sun
  const daysInMonth = differenceInDays(monthEnd, monthStart) + 1
  const cells: (Date | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => addDays(monthStart, i)),
  ]
  while (cells.length % 7 !== 0) cells.push(null)
  const countByDate = slots.reduce<Map<string, number>>((acc, s) => {
    const k = format(toLocal(s.start_at), 'yyyy-MM-dd')
    acc.set(k, (acc.get(k) ?? 0) + 1)
    return acc
  }, new Map())
  return (
    <div className="grid grid-cols-7 gap-2">
      {['日','一','二','三','四','五','六'].map(d => (
        <div key={d} className="text-center font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{d}</div>
      ))}
      {cells.map((d, i) => {
        if (!d) return <div key={i} className="aspect-square" />
        const key = format(d, 'yyyy-MM-dd')
        const count = countByDate.get(key) ?? 0
        return (
          <div key={i} className="aspect-square rounded-xl border border-border bg-card p-2 flex flex-col">
            <span className="font-display text-sm tabular-nums">{format(d, 'd')}</span>
            {count > 0 && (
              <span className="mt-auto font-mono text-[10px] text-muted-foreground">{count} 個</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
```

Import: `parseISO`, `startOfMonth`, `endOfMonth`, `differenceInDays`, `zhTW` from date-fns.

- [ ] **Step 7: Owner filter chip (preserve existing)**

If `member` query is set and user is Owner, the existing query likely already filters. Preserve. Add a small chip displaying the active filter:

```tsx
{member && (
  <span className="font-mono inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-[11px] uppercase tracking-wider">
    MEMBER: {/* lookup name */}
    <Link href={{ pathname: '/calendar', query: { view, ...(date && { date }) } }} className="text-muted-foreground hover:text-foreground">×</Link>
  </span>
)}
```

If the existing page already has this, leave it.

- [ ] **Step 8: Quality gate + commit**

```bash
npm run lint && npm run typecheck && npm run test
git add 'src/app/(tenant)/calendar/'
git commit -m "$(cat <<'EOF'
feat(calendar): align /calendar to mockup — 3 views (Week/List/Month)

Tabs switch via ?view= query. Week shows 7 columns of slots. List groups by date. Month shows grid with per-day slot count. Owner member filter preserved. Slot popover and conflict-detection badge deferred (need new queries; out of scope).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

**Deferred from spec:** slot popover (would need client-side state + edit/cancel API), conflict detection badge (would need overlap query), group N/M live count (would need bookings count per slot — existing data may already provide; check during impl).

---

## Task 3: `/services`

**Files:**
- Read: `claudeDesign/coach/page-services-customers.jsx` (combined file for both services+customers in mockup)
- Modify: `src/app/(tenant)/services/page.tsx` (4.0KB)
- Check: `src/app/(tenant)/services/` for existing edit/create client comps

**Alignment targets (spec §4b-03 + plan):**

1. **Tab filter** — "全部 / 1on1 / 群班" — segmented control filtering by `max_capacity === 1` vs `max_capacity > 1`. Use `?tab=` query.
2. **Service card** — `rounded-2xl border border-border bg-card p-6`. Shows name (display font), price + duration, group params if group class (capacity/min/cancel deadline). Edit button opens in-place expand (existing pattern if present, else link to edit).
3. **Placeholder "新增服務" card** — at end of grid, dashed border `<EmptyState>`-like card with `+` icon. Links to a new-service route or opens inline form.

**Steps:**

- [ ] **Step 1: Read**

```bash
cat 'claudeDesign/coach/page-services-customers.jsx'
cat 'src/app/(tenant)/services/page.tsx'
ls 'src/app/(tenant)/services/'
```

- [ ] **Step 2: Add tab filter**

Update page signature:

```ts
export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: 'all' | '1on1' | 'group' }>
}) {
  const { tab = 'all' } = await searchParams
  // ...
}
```

After fetching all services, filter:

```ts
const filtered = services?.filter(s => {
  if (tab === '1on1') return s.max_capacity === 1
  if (tab === 'group') return s.max_capacity > 1
  return true
}) ?? []
```

Render tab strip:

```tsx
<div className="mb-5 inline-flex rounded-full border border-border bg-card p-1">
  {(['all','1on1','group'] as const).map(t => (
    <Link
      key={t}
      href={{ pathname: '/services', query: t === 'all' ? {} : { tab: t } }}
      aria-current={tab === t ? 'page' : undefined}
      className={cn(
        'rounded-full px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.15em] transition',
        tab === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
      )}
    >
      {t === 'all' ? 'ALL' : t === '1on1' ? '1-ON-1' : 'GROUP'}
    </Link>
  ))}
</div>
```

- [ ] **Step 3: Service card grid**

Render filtered services in a 2-col (sm) / 3-col (lg) grid:

```tsx
<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
  {filtered.map(s => (
    <ServiceCard key={s.id} service={s} />
  ))}
  {/* Placeholder card at the end */}
  <Link href="/services/new" className="grid place-items-center rounded-2xl border-[1.5px] border-dashed border-border bg-muted/40 p-6 text-center hover:border-foreground/40 transition">
    <div className="space-y-2">
      <div className="mx-auto grid size-12 place-items-center rounded-full bg-secondary text-muted-foreground">
        <Plus className="size-5" />
      </div>
      <div className="font-cjk text-sm font-semibold">新增服務</div>
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        CREATE NEW
      </div>
    </div>
  </Link>
</div>
```

Define `ServiceCard` locally:

```tsx
function ServiceCard({ service }: { service: { id: string; name: string; description: string | null; duration_minutes: number; price: number; max_capacity: number; min_attendance: number; cancel_deadline_hours: number; is_active: boolean } }) {
  const isGroup = service.max_capacity > 1
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[0_8px_24px_-18px_rgba(0,0,0,0.18)] space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {isGroup ? 'GROUP CLASS' : '1-ON-1'}
          </div>
          <h3 className="mt-1 font-display font-cjk text-xl font-black truncate">{service.name}</h3>
        </div>
        {!service.is_active && (
          <Badge variant="outline">已停用</Badge>
        )}
      </div>
      {service.description && (
        <p className="font-cjk text-xs text-muted-foreground line-clamp-2">{service.description}</p>
      )}
      <div className="flex items-baseline gap-2">
        <span className="font-display text-3xl">NT$ {service.price.toLocaleString()}</span>
        <span className="font-cjk text-xs text-muted-foreground">/ {service.duration_minutes} 分鐘</span>
      </div>
      {isGroup && (
        <div className="grid grid-cols-3 gap-2 border-t border-border pt-3">
          <div>
            <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">CAP</div>
            <div className="font-display text-base tabular-nums">{service.max_capacity}</div>
          </div>
          <div>
            <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">MIN</div>
            <div className="font-display text-base tabular-nums">{service.min_attendance}</div>
          </div>
          <div>
            <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">CXL</div>
            <div className="font-display text-base tabular-nums">{service.cancel_deadline_hours}h</div>
          </div>
        </div>
      )}
      <div className="flex justify-end pt-2">
        <Link href={`/services/${service.id}`}>
          <Button variant="outline" size="sm">編輯</Button>
        </Link>
      </div>
    </div>
  )
}
```

If `/services/${service.id}` route doesn't exist, use the existing edit pattern (read the directory first).

- [ ] **Step 4: Quality gate + commit**

```bash
npm run lint && npm run typecheck && npm run test
git add 'src/app/(tenant)/services/'
git commit -m "$(cat <<'EOF'
feat(services): align /services to mockup — tab + grid + placeholder

Segmented tabs (ALL / 1-ON-1 / GROUP) via ?tab= query. Service card grid (2-3 cols) with group params (CAP/MIN/CXL) for group classes. Dashed placeholder card at end of grid links to new-service flow.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `/customers`

**Files:**
- Read: `claudeDesign/coach/page-services-customers.jsx`
- Modify: `src/app/(tenant)/customers/page.tsx` (5.9KB)
- Possibly create: `src/app/(tenant)/customers/customer-detail-drawer.tsx` (client component for drawer)

**Alignment targets (spec §4b-04 + plan):**

1. **Search + filter chips** — search input by name/phone. Filter chips for status (active / blocked / all).
2. **Customer list** — rows with avatar (initial), name, contact, stats (total bookings / last visit).
3. **Right-side detail drawer** — opens when row clicked. Shows full customer info: bookings history, package balances with progress bars.

**Implementation note:** Drawer requires client-side state (open/close + selected customer). Use `<Sheet>` from `src/components/ui/sheet.tsx` (already in repo).

**Steps:**

- [ ] **Step 1: Read**

```bash
cat 'claudeDesign/coach/page-services-customers.jsx'
cat 'src/app/(tenant)/customers/page.tsx'
cat 'src/components/ui/sheet.tsx'
ls 'src/app/(tenant)/customers/'
```

- [ ] **Step 2: Add search + filter**

Convert page to accept `searchParams.q` and `searchParams.status`:

```ts
export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: 'active' | 'blocked' | 'all' }>
}) {
  const { q = '', status = 'all' } = await searchParams
  // ...
}
```

After fetching rows, filter by `q` (case-insensitive substring of display_name or phone) and by `status`:

```ts
const filtered = rows.filter(r => {
  const name = r.customers?.display_name ?? ''
  const phone = r.customers?.phone ?? ''
  const matchQ = !q || name.toLowerCase().includes(q.toLowerCase()) || phone.includes(q)
  const matchStatus =
    status === 'all' ? true :
    status === 'blocked' ? r.is_blocked === true :
    !r.is_blocked
  return matchQ && matchStatus
})
```

Render search form (GET form, no JS needed):

```tsx
<form method="GET" className="mb-4 flex flex-wrap gap-2">
  <input
    type="search"
    name="q"
    defaultValue={q}
    placeholder="搜尋名字 / 電話"
    className="flex-1 min-w-[200px] rounded-full border border-border bg-card px-4 py-2 font-cjk text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-3 focus:ring-ring/50"
  />
  {status !== 'all' && <input type="hidden" name="status" value={status} />}
  <button type="submit" className="rounded-full bg-primary text-primary-foreground px-4 py-2 font-mono text-xs uppercase tracking-wider">SEARCH</button>
</form>

<div className="mb-5 flex flex-wrap gap-2">
  {(['all','active','blocked'] as const).map(s => (
    <Link
      key={s}
      href={{ pathname: '/customers', query: { ...(q && { q }), ...(s !== 'all' && { status: s }) } }}
      className={cn(
        'rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] transition',
        status === s
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-card text-muted-foreground hover:text-foreground'
      )}
    >
      {s === 'all' ? '全部' : s === 'active' ? '啟用' : '封鎖'}
    </Link>
  ))}
</div>
```

- [ ] **Step 3: Customer list**

Render filtered rows as a grid of cards:

```tsx
<div className="grid gap-3">
  {filtered.map(row => {
    const c = row.customers as { id: string; display_name: string | null; phone: string | null } | null
    const s = stats[c?.id ?? ''] ?? { total: 0, pending: 0, confirmed: 0, cancelled: 0, latest: null }
    return (
      <CustomerRow key={row.customer_id} row={row} stats={s} />
    )
  })}
</div>
```

Where `CustomerRow` is a client component (because of drawer):

```tsx
// src/app/(tenant)/customers/customer-row.tsx
'use client'
import { useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import CustomerDetailDrawer from './customer-detail-drawer'

export default function CustomerRow({ row, stats }: { row: any; stats: any }) {
  const [open, setOpen] = useState(false)
  const c = row.customers
  const initial = c?.display_name?.[0] ?? '?'
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left hover:border-foreground/40 transition">
          <div className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary font-display text-base">{initial}</div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="font-cjk text-sm font-semibold">{c?.display_name ?? '匿名'}</span>
              {row.is_blocked && <Badge variant="outline">已封鎖</Badge>}
            </div>
            <div className="font-mono mt-0.5 text-xs text-muted-foreground">
              {c?.phone ?? '—'} · {stats.total} 次預約{stats.latest ? ` · 最近 ${format(new Date(stats.latest), 'yyyy/MM/dd')}` : ''}
            </div>
          </div>
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <CustomerDetailDrawer customerId={c?.id} customerName={c?.display_name} tenantId={row.tenant_id} />
      </SheetContent>
    </Sheet>
  )
}
```

> Importing `format` here turns it client-side. Pass the formatted string from server instead OR keep client import — both fine. Prefer passing formatted strings as props to keep client bundle smaller.

- [ ] **Step 4: Drawer content**

```tsx
// src/app/(tenant)/customers/customer-detail-drawer.tsx
'use client'
import { useEffect, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'  // or whatever the browser client is

export default function CustomerDetailDrawer({ customerId, customerName, tenantId }: { customerId?: string; customerName: string | null; tenantId: string }) {
  const [bookings, setBookings] = useState<any[]>([])
  const [packages, setPackages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!customerId) return
    const supabase = createSupabaseBrowserClient()
    Promise.all([
      supabase.from('bookings').select('id, status, created_at, services(name), availability_slots(start_at)').eq('customer_id', customerId).eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(10),
      supabase.from('customer_purchases').select('id, package_id, total_classes, used_classes, status, service_packages(name)').eq('customer_id', customerId).eq('tenant_id', tenantId).eq('status', 'active'),
    ]).then(([bRes, pRes]) => {
      setBookings(bRes.data ?? [])
      setPackages(pRes.data ?? [])
      setLoading(false)
    })
  }, [customerId, tenantId])

  return (
    <div className="space-y-6 py-4">
      <div>
        <Kicker>CUSTOMER · 學員</Kicker>
        <h3 className="mt-1 font-display font-cjk text-2xl font-black">{customerName ?? '匿名'}</h3>
      </div>

      {/* Packages */}
      <section className="space-y-2">
        <Kicker>PACKAGES · 套裝餘額</Kicker>
        {loading && <div className="font-cjk text-xs text-muted-foreground">載入中...</div>}
        {!loading && packages.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-4 font-cjk text-xs text-muted-foreground">尚無套裝</div>
        )}
        {packages.map(p => {
          const remaining = (p.total_classes ?? 0) - (p.used_classes ?? 0)
          const pct = p.total_classes ? Math.round((remaining / p.total_classes) * 100) : 0
          return (
            <div key={p.id} className="rounded-xl border border-border bg-card p-3">
              <div className="font-cjk text-sm font-semibold">{p.service_packages?.name ?? '套裝'}</div>
              <div className="mt-1 font-mono text-xs text-muted-foreground">{remaining}/{p.total_classes} 堂剩</div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-foreground" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )
        })}
      </section>

      {/* Bookings */}
      <section className="space-y-2">
        <Kicker>BOOKINGS · 預約紀錄</Kicker>
        {loading && <div className="font-cjk text-xs text-muted-foreground">載入中...</div>}
        {!loading && bookings.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-4 font-cjk text-xs text-muted-foreground">尚無預約紀錄</div>
        )}
        {bookings.map(b => (
          <div key={b.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-3 text-sm">
            <div>
              <div className="font-cjk">{b.services?.name ?? '—'}</div>
              <div className="font-mono mt-0.5 text-xs text-muted-foreground">
                {b.availability_slots?.start_at ? format(new Date(b.availability_slots.start_at), 'yyyy/MM/dd HH:mm') : '—'}
              </div>
            </div>
            <StatusBadge status={b.status as any} />
          </div>
        ))}
      </section>
    </div>
  )
}
```

Verify `src/lib/supabase/client.ts` exports a browser client factory; adjust import if the name differs. If the project uses server-only fetches + a separate data-fetch route, refactor accordingly (read existing patterns under `src/lib/supabase/` first).

> Note: If implementing the browser-side fetch turns out painful (env vars / auth), fall back to **passing all customer data from the server page** (one big query with all customers + bookings + packages) and have the drawer just display props. Slower for large tenants but simpler. Subagent: use judgment based on what reads easier.

- [ ] **Step 5: Quality gate + commit**

```bash
npm run lint && npm run typecheck && npm run test
git add 'src/app/(tenant)/customers/'
git commit -m "$(cat <<'EOF'
feat(customers): align /customers to mockup — search + filter + drawer

GET-form search by name/phone, status filter chips (all/active/blocked), customer row cards with avatar initial + stats, right-side Sheet drawer showing booking history + package balances with progress bars.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `/packages` Coach Packages Management

**Files:**
- Read: `claudeDesign/coach/page-packages.jsx`
- Modify: `src/app/(tenant)/packages/page.tsx` (5.4KB)

**Alignment targets (spec §4b-05 + plan):**

1. **Tab filter** — 全部 / 1on1 / 群班 / 草稿 (草稿 = is_active false).
2. **Group by service** — kicker per service group (service name + N items).
3. **Package card** — class_count, price, expires_in_days, is_popular star, is_active toggle.
4. **Placeholder "新增套裝" card** at end of each service group (dashed).

**Steps:**

- [ ] **Step 1: Read**

```bash
cat 'claudeDesign/coach/page-packages.jsx'
cat 'src/app/(tenant)/packages/page.tsx'
ls 'src/app/(tenant)/packages/'
```

- [ ] **Step 2: Add tab filter + group by service**

Same pattern as Task 3 (tab segmented control via `?tab=` query). Filter packages by `tab`:

```ts
const filtered = packages?.filter(p => {
  if (tab === 'all') return true
  if (tab === 'draft') return !p.is_active
  // tab === '1on1' or 'group' depends on the service.max_capacity — need services join
  // alternatively, fetch services map first
  const svc = servicesById.get(p.service_id)
  if (!svc) return false
  if (tab === '1on1') return svc.max_capacity === 1
  if (tab === 'group') return svc.max_capacity > 1
  return true
}) ?? []
```

- [ ] **Step 3: Render grouped grid**

```tsx
{servicesArray.map(svc => {
  const pkgs = filtered.filter(p => p.service_id === svc.id)
  if (pkgs.length === 0 && tab !== 'all') return null
  return (
    <section key={svc.id} className="space-y-4">
      <SectionHead
        kicker={`${svc.name} · PACKAGES`}
        title={svc.name}
        eng={`${pkgs.length} ITEMS`}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pkgs.map(p => <PackageCard key={p.id} pkg={p} />)}
        <Link href={`/packages/new?service=${svc.id}`} className="grid place-items-center rounded-2xl border-[1.5px] border-dashed border-border bg-muted/40 p-6 text-center hover:border-foreground/40 transition">
          <div className="space-y-2">
            <div className="mx-auto grid size-10 place-items-center rounded-full bg-secondary text-muted-foreground">
              <Plus className="size-4" />
            </div>
            <div className="font-cjk text-sm font-semibold">新增套裝</div>
          </div>
        </Link>
      </div>
    </section>
  )
})}
```

`PackageCard` is a local component:

```tsx
function PackageCard({ pkg }: { pkg: { id: string; name: string; class_count: number; price: number; expires_in_days: number; is_active: boolean; is_popular: boolean } }) {
  return (
    <div className="relative rounded-2xl border border-border bg-card p-6 shadow-[0_8px_24px_-18px_rgba(0,0,0,0.18)]">
      {pkg.is_popular && (
        <Badge variant="yellow" className="absolute right-4 top-4">
          <Star className="size-3" /> POPULAR
        </Badge>
      )}
      {!pkg.is_active && (
        <Badge variant="outline" className="absolute left-4 top-4">草稿</Badge>
      )}
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground mt-6">
        {pkg.class_count} 堂套裝
      </div>
      <h3 className="mt-2 font-display font-cjk text-lg font-black truncate">{pkg.name}</h3>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="font-display text-3xl">NT$ {pkg.price.toLocaleString()}</span>
      </div>
      <div className="mt-1 font-cjk text-xs text-muted-foreground">有效 {pkg.expires_in_days} 天</div>
      <div className="mt-4 flex justify-end">
        <Link href={`/packages/${pkg.id}`}>
          <Button variant="outline" size="sm">編輯</Button>
        </Link>
      </div>
    </div>
  )
}
```

If `/packages/${pkg.id}` route doesn't exist, use existing edit pattern. Read directory first.

- [ ] **Step 4: Quality gate + commit**

```bash
npm run lint && npm run typecheck && npm run test
git add 'src/app/(tenant)/packages/page.tsx'
git commit -m "$(cat <<'EOF'
feat(packages-coach): align /packages to mockup — grouped + tab + placeholder

Segmented tabs (ALL / 1-ON-1 / GROUP / DRAFT), packages grouped per-service with SectionHead, PackageCard with POPULAR pill + draft badge, dashed 新增套裝 placeholder per group.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: `/packages/pending` Pending Purchases

**Files:**
- Read: `claudeDesign/coach/page-packages.jsx` (mockup also covers pending section)
- Modify: `src/app/(tenant)/packages/pending/page.tsx` (2.8KB)

**Alignment targets (spec §4b-06):**

1. **KPI row** — top of page: 總筆數 / 等待最久 / 本週新進 / 本月通過 (4 KpiCards). Best-effort — count what's available, skip what isn't.
2. **First row emphasis** — first pending purchase request gets `border-accent bg-accent/15` (subtle yellow tint) to draw attention.
3. **Inline confirm/decline buttons** — already may exist; ensure they use new Button variants.

**Steps:**

- [ ] **Step 1: Read**

```bash
cat 'claudeDesign/coach/page-packages.jsx'  # find the pending section
cat 'src/app/(tenant)/packages/pending/page.tsx'
ls 'src/app/(tenant)/packages/pending/'
```

- [ ] **Step 2: Add KPI count queries**

```ts
const monthStart = startOfMonth(new Date()).toISOString()
const weekStart = subDays(new Date(), 7).toISOString()

const [totalRes, weekRes, approvedMonthRes] = await Promise.all([
  supabase.from('customer_purchases').select('id', { count: 'exact', head: true }).eq('tenant_id', session.tenantId).eq('status', 'pending'),
  supabase.from('customer_purchases').select('id', { count: 'exact', head: true }).eq('tenant_id', session.tenantId).eq('status', 'pending').gte('created_at', weekStart),
  supabase.from('customer_purchases').select('id', { count: 'exact', head: true }).eq('tenant_id', session.tenantId).eq('status', 'active').gte('updated_at', monthStart),
])

// "等待最久" — derive from already-fetched purchases list
const oldest = (purchases ?? []).reduce<Date | null>((acc, p) => {
  const d = new Date(p.created_at)
  return !acc || d < acc ? d : acc
}, null)
const oldestDays = oldest ? Math.floor((Date.now() - oldest.getTime()) / 86400000) : 0
```

- [ ] **Step 3: Render KPI row + emphasized first row**

```tsx
<section className="mb-6 grid gap-3 grid-cols-2 lg:grid-cols-4">
  <KpiCard label="總待審" value={totalRes.count ?? 0} unit="筆" accent={(totalRes.count ?? 0) > 0} />
  <KpiCard label="等待最久" value={oldestDays} unit="天" />
  <KpiCard label="本週新進" value={weekRes.count ?? 0} unit="筆" />
  <KpiCard label="本月通過" value={approvedMonthRes.count ?? 0} unit="筆" />
</section>

{(purchases ?? []).length === 0 ? (
  <EmptyState
    icon={<Layers className="size-5" />}
    title="沒有待審申請"
    hint="所有套裝申請都已處理 👍"
  />
) : (
  <div className="space-y-3">
    {purchases.map((p, i) => (
      <PurchaseRow key={p.id} purchase={p} emphasized={i === 0} />
    ))}
  </div>
)}
```

Define `PurchaseRow` locally with `emphasized` styling:

```tsx
function PurchaseRow({ purchase, emphasized }: { purchase: any; emphasized: boolean }) {
  return (
    <div className={cn(
      'rounded-2xl border p-5 transition',
      emphasized ? 'border-accent bg-accent/15' : 'border-border bg-card'
    )}>
      {/* existing rendering of customer + package + actions */}
    </div>
  )
}
```

Preserve the existing approve/reject server actions and form pattern.

- [ ] **Step 4: Quality gate + commit**

```bash
npm run lint && npm run typecheck && npm run test
git add 'src/app/(tenant)/packages/pending/'
git commit -m "$(cat <<'EOF'
feat(packages-pending): align /packages/pending to mockup

KPI row (total / oldest wait days / weekly new / monthly approved), first row emphasized with accent border + tint to highlight the most urgent.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: `/notifications` Notification Inbox

**Files:**
- Read: `claudeDesign/coach/page-notifications.jsx`
- Modify: `src/app/(tenant)/notifications/page.tsx` (currently 0.3KB stub wrapping NotificationPreferences)

**Important scope note:** The current `/notifications` route renders `<NotificationPreferences>` — this is preferences UI. The mockup expects an **inbox / log list**. The preferences UI belongs at `/settings/notifications` (Plan 4's territory). For now:
- Replace this page entirely with the new inbox UI using `notification_log` as the data source
- The `/settings/notifications` route already exists at `src/app/(tenant)/settings/` (parallel to `/notifications`) — Plan 4 will polish that for preferences

**Alignment targets (spec §4b-07 + plan):**

1. **Inbox list** sourced from `notification_log` filtered to current user
2. **Tab filter** — 全部 / 預約 / 套裝 / 系統 (filter by `type` prefix or `type IN (...)`)
3. **Unread visual** — first 24 hours of `sent_at` shows left yellow side bar + bold text (cosmetic only, no persistence)
4. **Top button** — "推播偏好" → `/settings/notifications`

**Steps:**

- [ ] **Step 1: Read**

```bash
cat 'claudeDesign/coach/page-notifications.jsx'
cat 'src/app/(tenant)/notifications/page.tsx'
cat 'src/components/settings/notification-preferences.tsx'  # so you know what's at /settings/notifications already
ls 'src/components/settings/'
```

- [ ] **Step 2: Replace the page**

Full replacement of `src/app/(tenant)/notifications/page.tsx`:

```tsx
import Link from 'next/link'
import { format, formatDistanceToNow } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { Bell, Settings } from 'lucide-react'
import { requireTenantMember } from '@/lib/auth/get-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { SectionHead } from '@/components/ui/section-head'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type TabKey = 'all' | 'bookings' | 'packages' | 'system'

const TABS: { key: TabKey; label: string; eng: string; matcher: (type: string) => boolean }[] = [
  { key: 'all', label: '全部', eng: 'ALL', matcher: () => true },
  { key: 'bookings', label: '預約', eng: 'BOOKINGS', matcher: t => t.startsWith('booking_') },
  { key: 'packages', label: '套裝', eng: 'PACKAGES', matcher: t => t.startsWith('package_') || t.startsWith('purchase_') },
  { key: 'system', label: '系統', eng: 'SYSTEM', matcher: t => !t.startsWith('booking_') && !t.startsWith('package_') && !t.startsWith('purchase_') },
]

const TYPE_LABEL: Record<string, string> = {
  booking_created: '新預約',
  booking_confirmed: '預約已確認',
  booking_cancelled: '預約取消',
  booking_rescheduled: '預約改期',
  package_request: '套裝申請',
  package_approved: '套裝核准',
  purchase_request: '套裝購買申請',
  pre_event: '即將開始提醒',
  daily_reminder: '每日提醒',
  weekly_summary: '每週摘要',
}

const UNREAD_WINDOW_MS = 24 * 3600 * 1000

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: TabKey }>
}) {
  const { tab = 'all' } = await searchParams
  const session = await requireTenantMember()
  const supabase = await createSupabaseServerClient()

  const { data: logs } = await supabase
    .from('notification_log')
    .select('id, type, related_id, channel, status, sent_at, error_message')
    .eq('user_id', session.userId)
    .order('sent_at', { ascending: false })
    .limit(100)

  const tabDef = TABS.find(t => t.key === tab) ?? TABS[0]
  const filtered = (logs ?? []).filter(l => tabDef.matcher(l.type))

  const now = Date.now()

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionHead kicker="NOTIFICATIONS · 通知" title="通知" eng="INBOX" />
        <Link href="/settings/notifications">
          <Button variant="outline" size="sm">
            <Settings className="size-3.5" /> 推播偏好
          </Button>
        </Link>
      </div>

      <div className="inline-flex rounded-full border border-border bg-card p-1">
        {TABS.map(t => (
          <Link
            key={t.key}
            href={{ pathname: '/notifications', query: t.key === 'all' ? {} : { tab: t.key } }}
            aria-current={tab === t.key ? 'page' : undefined}
            className={cn(
              'inline-flex items-baseline gap-2 rounded-full px-4 py-1.5 transition',
              tab === t.key
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <span className="font-cjk text-sm">{t.label}</span>
            <span className="font-mono text-[10px] tracking-[0.15em] opacity-70">{t.eng}</span>
          </Link>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Bell className="size-5" />}
          title="沒有通知"
          hint="新事件發生時會出現在這裡"
        />
      ) : (
        <div className="space-y-2">
          {filtered.map(l => {
            const ts = new Date(l.sent_at)
            const isUnread = now - ts.getTime() < UNREAD_WINDOW_MS
            const label = TYPE_LABEL[l.type] ?? l.type
            return (
              <div key={l.id} className={cn(
                'flex items-center gap-3 rounded-2xl border bg-card p-4 relative',
                isUnread
                  ? 'border-border before:absolute before:left-0 before:top-3 before:bottom-3 before:w-1 before:rounded-r-full before:bg-accent before:content-[""] pl-5'
                  : 'border-border opacity-70'
              )}>
                <Bell className={cn('size-4 shrink-0', isUnread ? 'text-foreground' : 'text-muted-foreground')} />
                <div className="min-w-0 flex-1">
                  <div className={cn(
                    'font-cjk text-sm',
                    isUnread ? 'font-semibold' : 'font-normal text-muted-foreground'
                  )}>
                    {label}
                  </div>
                  <div className="font-mono mt-0.5 text-xs text-muted-foreground">
                    {l.channel} · {l.status} · {formatDistanceToNow(ts, { addSuffix: true, locale: zhTW })}
                  </div>
                  {l.error_message && (
                    <div className="font-cjk mt-1 text-xs text-destructive">{l.error_message}</div>
                  )}
                </div>
                <time className="font-mono text-[10px] text-muted-foreground shrink-0">
                  {format(ts, 'M/d HH:mm')}
                </time>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

Notes:
- "Unread" is purely cosmetic (24h window). No DB persistence — that's deferred to Phase 2.
- The previous wrapper around `<NotificationPreferences>` is gone — `/settings/notifications` (Plan 4 territory) keeps the preferences UI.
- The before pseudo-element trick draws a yellow left bar for unread items.

- [ ] **Step 3: Quality gate + commit**

```bash
npm run lint && npm run typecheck && npm run test
git add 'src/app/(tenant)/notifications/page.tsx'
git commit -m "$(cat <<'EOF'
feat(notifications): rebuild /notifications as inbox list

Replace NotificationPreferences wrapper with a notification_log–sourced inbox view. Tabs (ALL / BOOKINGS / PACKAGES / SYSTEM) filter by type prefix. Items within last 24h show a yellow left bar (cosmetic "unread" — no DB persistence; persistent read state deferred to Phase 2). Top "推播偏好" link points to /settings/notifications.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Plan 3 Final Quality Gate

**Files:** none (verification only)

- [ ] **Step 1: Run full gates**

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

All four must pass. If anything fails, identify root cause, write a focused `fix(...)` commit, then re-run the failed step.

- [ ] **Step 2: Note manual spot-check pages** (don't actually run dev server)

In the report, list pages for the human to spot-check:
- `/dashboard` (light + dark, 3 breakpoints)
- `/calendar?view=week`, `?view=list`, `?view=month`
- `/services` (default + `?tab=1on1` + `?tab=group`)
- `/customers` (default + `?q=...` + click a row to open drawer)
- `/packages` (default + tabs)
- `/packages/pending`
- `/notifications` (default + tabs)

- [ ] **Step 3:** No final commit needed unless fixes were made.

---

## Done Criteria for Plan 3

- All 7 coach backoffice pages render without console error / hydration warning / type error
- Light + dark + 3 breakpoints all work
- Dashboard hero is black card with yellow corner decoration
- Dashboard has 4 KpiCards + today timeline (NEXT UP) + pending column
- Calendar has 3 view tabs working
- Services has tab filter + placeholder card
- Customers has search + filter chips + Sheet drawer
- Packages grouped per-service + tab filter + placeholder cards
- Packages/pending has KPI row + emphasized first row
- Notifications is an inbox list with tabs + cosmetic unread bar
- `npm run lint` / `typecheck` / `test` / `build` all green

## Out of Scope for Plan 3 (later plans / Phase 2)

- Slot popover on calendar (would need new client state + edit/cancel APIs)
- Calendar conflict-detection badge (would need overlap query)
- Persistent unread state for /notifications (needs new DB column)
- Dashboard inline confirm/decline buttons on pending (existing /bookings flow stays the action surface)
- Plan 4: Coach Settings 4 pages
- Plan 5: Final QA + docs

---

## Self-Review Notes

**Spec coverage (§4b):**
- ✅ 01 dashboard → Task 1
- ✅ 02 calendar (3 views, slot popover deferred, conflict badge deferred) → Task 2
- ✅ 03 services → Task 3
- ✅ 04 customers (drawer) → Task 4
- ✅ 05 packages → Task 5
- ✅ 06 packages/pending → Task 6
- ✅ 07 notifications (inbox, not preferences) → Task 7
- ✅ Final QA → Task 8

**Placeholder scan:**
- Task 2 Step 4 says "If memoization needs `'use client'`..." — that's a real conditional decision the implementer makes after reading the file, not a TODO.
- Task 4 Step 4 has a fallback strategy ("If implementing the browser-side fetch turns out painful...") — explicit alternative, not a TODO.

**Type consistency:**
- `TabKey = 'all' | 'bookings' | 'packages' | 'system'` consistent in Task 7.
- View query values `'week' | 'list' | 'month'` consistent in Task 2.
- KPI card props match P1 signature.

**Scope check:**
- Tasks 1, 2, 4 are LARGE (dashboard, calendar, customers); 3, 5, 6, 7 are MEDIUM. Reasonable for a "page-per-task" plan structure.
- All deferred items are explicitly listed in the per-task "deferred" note and in the global Out of Scope section.
