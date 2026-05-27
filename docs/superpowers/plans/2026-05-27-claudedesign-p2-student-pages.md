# claudeDesign UI Alignment · Plan 2 — Student 6 Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the 6 student-facing pages (`/<slug>`, `/<slug>/packages`, `/book/<slotId>`, `/login`, `/signup`, `/my-bookings`) to the `claudeDesign/student/` mockup using the primitives shipped in Plan 1.

**Architecture:** Per-page integration tasks (no TDD — visual alignment doesn't unit-test well). Each task reads the mockup file + current page file, identifies the layout diff, applies the changes using existing P1 primitives, and verifies via `npm run lint` / `npm run typecheck` / `npm run test` (regression gate) + a single dev-server manual check at the end.

**Tech Stack:** Next.js 15 App Router (RSC + Server Actions), React 19, Tailwind v4, P1 primitives (`AppShell`, `Btn` w/ withArrow, `Kicker`, `EmptyState`, `KpiCard`, `DateRibbon`, `TimeChip`, `RescheduleBanner`, `DateStrip`), Supabase, next-themes.

**Spec:** `docs/superpowers/specs/2026-05-27-claudedesign-ui-alignment-design.md` (commit `4f7e89e`) — section §4a covers these pages.

**Mockup root:** `claudeDesign/student/` (page-public.jsx, page-packages.jsx, page-book.jsx, page-auth.jsx, page-bookings.jsx). Mockup uses inline styles + plain HTML; the implementer's job is to **translate intent** to Tailwind + design tokens, not copy inline styles.

---

## Convention notes (applied to every task)

- **Tokens only.** Never hardcode colors or radii. Use `bg-card`, `text-muted-foreground`, `border-accent`, `rounded-2xl`, etc. The design tokens already enforce Direction C.
- **Bilingual headers** use `<SectionHead kicker title eng hint right>`. CJK chunks use `font-cjk`; mono labels use `font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground`.
- **Buttons:** primary actions use `<Button variant="default" size="pill" withArrow="circle">` or `<PrimaryCta>`. Secondary uses `variant="outline"`. Ghost / icon-only use `variant="ghost"`.
- **Cards:** `rounded-2xl border border-border bg-card shadow-[0_8px_24px_-18px_rgba(0,0,0,0.18)]`. Muted card: `bg-muted`.
- **Accent yellow is punctuation only.** Acceptable spots: badge / kicker accent dot / arrow circle / Pill yellow variant / underline on eng heading / NEXT-UP highlight. Never large yellow surfaces.
- **Mobile drawer overlay:** `bg-black/45 backdrop-blur-sm`.
- **Don't add comments to explain WHAT.** Only WHY (per CLAUDE.md).
- **Reuse over reinvent.** If a primitive exists, use it.
- **`'use client'` only when needed** (event handlers, useState, useEffect). Server components by default.

---

## Schema readiness recap (from P1)

These are already migrated and ready to be used:
- `tenants.years_exp`, `tenants.established_year`, `tenants.city` (hero meta)
- `service_packages.is_popular` (popular pill)
- `notification_preferences.channels` jsonb + `quiet_hours_start/end` (used by settings, not student pages)

No new schema in Plan 2. Some new server queries are needed (e.g. my-bookings KPI counts).

---

## Task 1: `/<slug>` Public Coach Page

**Files:**
- Read: `claudeDesign/student/page-public.jsx` (mockup; 296 lines)
- Read: `claudeDesign/student/atoms.jsx` (shared atoms used by mockup — `Pill`, `Avatar`, `ImgSlot`, `ServiceCard`, `SlotPicker`, `Banner`, etc. — to understand the visual intent, not to copy)
- Read: `claudeDesign/styles/tokens.css` (`.dir-c` token definitions, light/dark)
- Modify: `src/app/[tenantSlug]/page.tsx` (currently 14.6KB; tenant fetch + hero + services + slot picker — S6 partial alignment)
- Modify (if needed): `src/app/[tenantSlug]/slot-picker.tsx` (current slot picker; may need to swap to `<DateRibbon>` + `<TimeChip>`)
- Create or use existing: integrate `<RescheduleBanner>` (from P1) when `?reschedule=<bookingId>` query is set

**Alignment targets (from spec §4a-01):**

| Section | Required change |
|---|---|
| Hero meta line | Add `<Pill variant="yellow">{specialty}</Pill>` + mono line `EST {established_year} · {years_exp} YRS · {city}`. Read tenant.specialty (or services[0].name as fallback) for the pill. |
| Big display title | Already English+CJK from S6 (`deriveEngTitle(slug)`). Keep. Add small accent dot after first name. |
| Contact pills | Wrap email / phone / line / city into row of `<span>` pills, mono font, secondary bg, rounded-full. Lucide icons inline (Mail / Phone / MessageCircle / MapPin). |
| AuthCta block | Two CTAs: `<PrimaryCta>` "登入預約" + `<Button variant="outline">` "建立帳號" + tiny mono caption "訪客可瀏覽 · 預約需登入". When signed-in customer, skip this block. |
| Reschedule banner | When `searchParams.reschedule` present: fetch the original booking (auth-checked, must belong to current user), render `<RescheduleBanner originalSlotLabel="..." serviceName="..." exitHref="/<slug>" />` between hero and bio. |
| BIO section | Grid (`grid-cols-[280px_1fr]` on lg, single col on mobile). Left = `<SectionHead kicker="ABOUT · 關於" title="關於我" eng="ABOUT" />`. Right = `dangerouslySetInnerHTML={{ __html: sanitize(tenant.bio_html) }}` in an `article.prose-like` block. Use `font-cjk` + `font-display` for h-tags. |
| VIDEO section | Same 2-col grid. Right = `<VideoEmbed>` (existing component at `src/components/public-page/video-embed.tsx`). If no video, omit section entirely (don't show empty state). |
| GALLERY section | `<SectionHead kicker="SPACE · 環境照片" title="環境" eng="SPACE" hint="..."/>`. Below: photos grid, 3 cols (1 / 2 / 3 by breakpoint). Each photo is `<figure>` with `<img>` (aspect-ratio 4/3 via `aspect-[4/3]` Tailwind), caption below = `<figcaption className="font-mono text-[11px] text-muted-foreground">{String(i+1).padStart(2,'0')} — {caption}</figcaption>`. |
| SERVICES section | `<section className="bg-muted">` (muted background). SectionHead `kicker="SECTION / 03" title="服務" eng="SERVICES"`. Below: services grid, 3 cols on lg. Each service card uses ServiceCard pattern from mockup (price big display, duration mono, select state with primary border). Indexed `01 / 02 / 03` in upper-right corner of card. |
| SLOT PICKER section | Same muted bg. `<SectionHead kicker="SECTION / 04" title="時段" eng="SLOTS" hint="..." right={<weekNav>}/>`. Inside Card: SlotPicker — replace current slot-picker.tsx contents with `<DateRibbon>` + `<TimeChip>` from P1. Below the Card: "Selected slot recap bar" — `bg-primary text-primary-foreground rounded-2xl p-5` with display time + service info + `<PrimaryCta>` "前往預約" (or "改期到此時段" if in reschedule mode). |
| Footer | Small row: `<QRMark size={28}/>` + mono "QUICKRESERVE · 由 {tenant.name} 教練建立 · 2026" + footer nav links (套裝 / 我的預約 / 登入). |

**New server query needed:**
- For the reschedule banner: fetch booking by id (RLS will gate to owner). Existing pattern in `src/app/book/[slotId]/page.tsx` or `src/app/(customer)/my-bookings/page.tsx` may have a similar fetch; reuse if possible.

**Steps:**

- [ ] **Step 1: Read mockup + atoms + current page**

```bash
# Reading these for context only (no edits)
cat 'claudeDesign/student/page-public.jsx'
cat 'claudeDesign/student/atoms.jsx'
cat 'src/app/[tenantSlug]/page.tsx'
cat 'src/app/[tenantSlug]/slot-picker.tsx'
```

- [ ] **Step 2: Decide rewrite strategy**

The current page is already S6-aligned in some sections (hero dual-title, basic structure). The work is **additive + replacement of specific sections**, not a full rewrite. Identify which sections need new code vs which sections need patching. Write notes (mental or scratch — don't commit a notes file).

- [ ] **Step 3: Implement hero meta line + contact pills + AuthCta block**

Inside `src/app/[tenantSlug]/page.tsx`, modify the hero `<section>`:
- Pull `tenant.years_exp`, `tenant.established_year`, `tenant.city` from the fetched tenant row (these are now schema-available).
- Add `<Badge variant="yellow" icon={<Star className="size-3" />}>STRENGTH COACH</Badge>` (or derived from services[0].name) inline at top of hero.
- Beside the badge: `<span className="font-mono text-[11px] tracking-[0.12em] text-muted-foreground">EST {tenant.established_year} · {tenant.years_exp} YRS · {tenant.city}</span>` — conditionally render each segment only if its field is present.
- Replace existing contact rendering with a flex-wrap row of pills, e.g.:

```tsx
<div className="mt-7 flex flex-wrap gap-2 sm:mt-8">
  {tenant.contact_email && (
    <span className="font-mono inline-flex items-center gap-2 rounded-full bg-secondary px-3.5 py-2 text-xs">
      <Mail className="size-3" /> {tenant.contact_email}
    </span>
  )}
  {/* phone / line / city pills, same pattern */}
</div>
```

- For the AuthCta block: render conditionally based on session presence. If signed-out:

```tsx
<div className="mt-7 flex flex-wrap items-center gap-3 sm:mt-9">
  <PrimaryCtaLink href={`/login?redirect=${encodeURIComponent(returnPath)}`}>登入預約</PrimaryCtaLink>
  <Link href={`/signup?redirect=${encodeURIComponent(returnPath)}`}>
    <Button variant="outline" size="xl">建立帳號</Button>
  </Link>
  <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground ml-1">
    訪客可瀏覽 · 預約需登入
  </span>
</div>
```

- [ ] **Step 4: Implement reschedule banner**

When `searchParams.reschedule` is set, fetch the booking and render `<RescheduleBanner>` from `@/components/booking/reschedule-banner`. Skip silently if the booking doesn't belong to the current user (returns null/null).

```tsx
// after hero section, before bio section
{rescheduleFrom && rescheduleBooking && (
  <section className="mx-auto max-w-[1200px] px-5 sm:px-10 lg:px-[72px] pb-5 sm:pb-6">
    <RescheduleBanner
      originalSlotLabel={`${format(toLocal(rescheduleBooking.slot.start_at), 'M/d (E) HH:mm', { locale: zhTW })}`}
      serviceName={rescheduleBooking.service.name}
      exitHref={`/${tenantSlug}`}
    />
  </section>
)}
```

Add the booking fetch in the existing `Promise.all`:

```ts
const [..., { data: rescheduleBooking }] = await Promise.all([
  // existing fetches...
  rescheduleFrom
    ? supabase
        .from('bookings')
        .select('id, status, services(name), availability_slots(start_at)')
        .eq('id', rescheduleFrom)
        .single()
    : Promise.resolve({ data: null }),
])
```

(Schema column names verified in A1 audit: `availability_slots.start_at` exists.)

- [ ] **Step 5: Implement BIO + VIDEO + GALLERY sections**

If `tenant.bio_html` is set, render a grid section. Existing `<BioBlock>` (in `src/components/public-page/bio-block.tsx`) may already handle this — read it first and either reuse or adjust.

If `tenant.intro_video_url` is set, render `<VideoEmbed url={tenant.intro_video_url} />` inside the 2-col grid.

For gallery, use the already-fetched `photos` array. Map to a `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4` block of `<figure>` elements. The existing `<PhotoGallery>` component may be the right place — read it and decide.

- [ ] **Step 6: Implement SERVICES section with muted bg**

Wrap the existing services rendering in `<section className="bg-muted border-t border-border">` and add SectionHead.

For each service card, ensure:
- Card has `rounded-2xl border border-border bg-card`
- Index badge in top-right: `<span className="font-mono text-[10px] tracking-wider text-muted-foreground">0{i+1}</span>`
- Service name `font-display font-cjk text-xl font-black`
- Price `<span className="font-display text-3xl">NT$ {price}</span>` with accent underline span on the digits
- Selected state: add `border-primary` to the wrapper

- [ ] **Step 7: Replace slot-picker with DateRibbon + TimeChip**

Update `src/app/[tenantSlug]/slot-picker.tsx` to render:

```tsx
'use client'
import { useState } from 'react'
import { DateRibbon } from '@/components/booking/date-ribbon'
import { TimeChip, type TimeChipState } from '@/components/booking/time-chip'
// ... existing imports

export default function SlotPicker({ slots, dates, initialDate, ... }: Props) {
  const [selectedDate, setSelectedDate] = useState(initialDate)
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null)
  // group slots by date for the ribbon counts
  const slotCountByDate = useMemo(/* compute */, [slots])
  const slotsForDay = useMemo(/* filter */, [slots, selectedDate])
  return (
    <div className="space-y-5">
      <DateRibbon dates={dates} selected={selectedDate} onSelect={setSelectedDate} slotCountByDate={slotCountByDate} />
      <div className="flex flex-wrap gap-2">
        {slotsForDay.map(s => (
          <TimeChip
            key={s.id}
            time={format(toLocal(s.start_at), 'HH:mm')}
            state={
              s.id === selectedSlotId ? 'selected' :
              s.is_group ? 'group' :
              s.is_full ? 'full' : 'open'
            }
            group={s.is_group ? { filled: s.filled, capacity: s.capacity } : undefined}
            onSelect={() => setSelectedSlotId(s.id)}
          />
        ))}
      </div>
      {selectedSlotId && (
        <div className="rounded-2xl bg-primary text-primary-foreground p-5 flex items-center justify-between gap-4">
          <div className="flex items-baseline gap-3">
            <span className="font-display text-3xl">{/* date · time */}</span>
            <span className="font-cjk text-sm opacity-70">· {/* service · duration */}</span>
          </div>
          <PrimaryCtaLink href={`/book/${selectedSlotId}${rescheduleParam}`}>
            {reschedule ? '改期到此時段' : '前往預約'}
          </PrimaryCtaLink>
        </div>
      )}
    </div>
  )
}
```

Adjust the existing prop shape to whatever the file currently uses; the goal is the rendered structure.

- [ ] **Step 8: Footer + final polish**

Add a footer section to `page.tsx`:

```tsx
<footer className="border-t border-border px-5 py-8 sm:px-10 lg:px-[72px]">
  <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4">
    <div className="flex items-center gap-3">
      <QRMark size={28} />
      <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
        QUICKRESERVE · 由 {tenant.name} 教練建立 · 2026
      </span>
    </div>
    <div className="flex gap-5">
      <Link href={`/${tenantSlug}/packages`} className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground">套裝</Link>
      <Link href="/my-bookings" className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground">我的預約</Link>
      <Link href="/login" className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground">登入</Link>
    </div>
  </div>
</footer>
```

- [ ] **Step 9: Run quality gate**

```bash
npm run lint
npm run typecheck
npm run test
```

All must pass. Fix root causes if they don't.

- [ ] **Step 10: Manual visual verify (optional but recommended)**

```bash
npm run dev
```

In another terminal/browser, visit `http://localhost:3000/coach-poyu` (the demo tenant from seed). Spot check:
- Hero shows pill + meta line + display title
- Contact pills row renders if any contact field set
- Services section has muted bg
- Slot picker renders DateRibbon + TimeChips
- Footer appears
- Light + dark mode (toggle in upper right of auth chrome or via dev tools)
- 3 breakpoints (resize browser)

- [ ] **Step 11: Commit**

```bash
git add 'src/app/[tenantSlug]/page.tsx' 'src/app/[tenantSlug]/slot-picker.tsx'
git commit -m "$(cat <<'EOF'
feat(public-page): align /<slug> to claudeDesign mockup

Hero meta line (EST/YRS/city), contact pills row, AuthCta block, reschedule banner support, gallery numbered captions, muted services section, slot picker swap to DateRibbon+TimeChip, selected slot recap bar, footer.

Uses P1 primitives: Badge, DateRibbon, TimeChip, RescheduleBanner, PrimaryCta. Reads new tenant columns: years_exp, established_year, city.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `/<slug>/packages` Public Packages Page

**Files:**
- Read: `claudeDesign/student/page-packages.jsx`
- Modify: `src/app/[tenantSlug]/packages/page.tsx` (7.2KB)
- Modify (if needed): `src/app/[tenantSlug]/packages/purchase-request-form.tsx` (3.3KB)

**Alignment targets (spec §4a-02):**

1. **Group packages by service.** Each group has its own SectionHead (kicker = service name + N items).
2. **Popular Pill on cards** where `package.is_popular === true` — render `<Badge variant="yellow">POPULAR</Badge>` in top-right corner of the card.
3. **In-card application form** — when user clicks a package, the form expands inline (not a separate page or modal). Existing `purchase-request-form.tsx` may already handle this — keep the file but adjust styling.
4. **Payment status segmented control** in the form — `<segmented control>` for "未付 / 已付 / 部份付". Already in form? Check.
5. **Hero/title** uses `<AppShell title="套裝" kicker={`/${slug} · PACKAGES`} />` pattern (this is a customer page outside the tenant chrome, so AppShell may not be ideal — use a simpler page header instead).

**Steps:**

- [ ] **Step 1: Read mockup + current files**

```bash
cat 'claudeDesign/student/page-packages.jsx'
cat 'src/app/[tenantSlug]/packages/page.tsx'
cat 'src/app/[tenantSlug]/packages/purchase-request-form.tsx'
cat 'src/app/[tenantSlug]/packages/purchase-request-action.ts'
```

- [ ] **Step 2: Update fetch to include is_popular**

In `packages/page.tsx`, ensure the `select(...)` includes `is_popular`:

```ts
const { data: packages } = await supabase
  .from('service_packages')
  .select('id, service_id, name, class_count, price, expires_in_days, is_popular, is_active, services(id, name)')
  .eq('tenants.id', tenant.id)
  .eq('is_active', true)
  .order('service_id')
  .order('class_count')
```

(Adjust if the existing query uses different join syntax — match it.)

- [ ] **Step 3: Group by service in JSX**

Replace the existing flat render with a per-service group:

```tsx
const grouped = groupBy(packages ?? [], (p) => p.service_id)

return (
  <div className="space-y-12">
    {Array.from(grouped.entries()).map(([serviceId, pkgs]) => {
      const serviceName = pkgs[0]?.services?.name ?? '未命名服務'
      return (
        <section key={serviceId}>
          <SectionHead
            kicker={`${serviceName} · PACKAGES`}
            title={serviceName}
            eng={`${pkgs.length} ITEMS`}
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pkgs.map((p) => (
              <PackageCard key={p.id} pkg={p} />
            ))}
          </div>
        </section>
      )
    })}
  </div>
)
```

Define `groupBy` locally or inline. PackageCard can stay as inline JSX or be extracted to a local component within page.tsx.

- [ ] **Step 4: PackageCard with Popular pill**

Each card:

```tsx
<div className="relative rounded-2xl border border-border bg-card p-6 shadow-[0_8px_24px_-18px_rgba(0,0,0,0.18)]">
  {pkg.is_popular && (
    <Badge variant="yellow" className="absolute right-4 top-4">POPULAR</Badge>
  )}
  <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
    {pkg.class_count} 堂
  </div>
  <div className="mt-3 font-display font-cjk text-2xl font-black">{pkg.name}</div>
  <div className="mt-4 flex items-baseline gap-1">
    <span className="font-display text-4xl">NT$ {pkg.price.toLocaleString()}</span>
  </div>
  <div className="mt-2 font-cjk text-xs text-muted-foreground">
    有效 {pkg.expires_in_days} 天
  </div>
  <div className="mt-5">
    <PurchaseRequestForm packageId={pkg.id} packageName={pkg.name} />
  </div>
</div>
```

- [ ] **Step 5: Polish PurchaseRequestForm**

In `purchase-request-form.tsx`, ensure:
- Use `<Input>` from `@/components/ui/input`
- Submit button is `<Button variant="default" withArrow="inline" type="submit">申請</Button>`
- Payment status uses a segmented control. If not already present, add a 3-button group:

```tsx
<div className="inline-flex rounded-full border border-border bg-muted p-1">
  {(['未付','已付','部份付'] as const).map((s) => (
    <button
      type="button"
      key={s}
      onClick={() => setPaymentStatus(s)}
      className={cn(
        'rounded-full px-3 py-1.5 font-cjk text-xs transition',
        paymentStatus === s
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:text-foreground'
      )}
    >
      {s}
    </button>
  ))}
</div>
```

> If the existing form doesn't currently track payment status, this is a new field — add to the server action's input schema as well. If the schema doesn't support it, **don't add a new column in this task** — just expose the UI and let the form pass it to existing notes/message field, or skip the segmented control entirely. Decide based on what the existing action accepts.

- [ ] **Step 6: Quality gate**

```bash
npm run lint && npm run typecheck && npm run test
```

- [ ] **Step 7: Commit**

```bash
git add 'src/app/[tenantSlug]/packages/'
git commit -m "$(cat <<'EOF'
feat(packages-page): align /<slug>/packages to mockup

Group packages by service, POPULAR yellow Pill, polished PackageCard layout with price emphasis, in-card application form styling.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `/book/<slotId>` Booking Confirmation Page

**Files:**
- Read: `claudeDesign/student/page-book.jsx`
- Modify: `src/app/book/[slotId]/page.tsx` (8.9KB)

**Alignment targets (spec §4a-03):**

1. **Slot detail card** — big display showing date · time · service · duration · location.
2. **Package balance selection** — radio cards if customer has packages for this service. Each card shows package name + remaining sessions + progress bar.
3. **Cancellation policy** — small framed block at the bottom.
4. **Empty state when no package** — dashed `<EmptyState>` pointing to `/<slug>/packages`.

**Steps:**

- [ ] **Step 1: Read mockup + current**

```bash
cat 'claudeDesign/student/page-book.jsx'
cat 'src/app/book/[slotId]/page.tsx'
```

- [ ] **Step 2: Reshape page**

The page structure should be:

```tsx
<div className="mx-auto max-w-[920px] px-5 sm:px-10 py-10 space-y-7">
  <SectionHead kicker={`/book · ${tenant.slug}`} title="預約確認" eng="CONFIRM" />

  {/* Slot detail card */}
  <Card className="p-7">
    <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{format(slot.start_at, 'EEEE, MMM dd')}</div>
    <div className="mt-1 font-display text-5xl">{format(slot.start_at, 'HH:mm')}</div>
    <div className="mt-3 font-cjk text-base">{service.name} · {service.duration_minutes} 分鐘</div>
  </Card>

  {/* Package balance picker OR empty state */}
  {hasPackages ? (
    <section>
      <SectionHead kicker="PAYMENT · 付款方式" title="選擇套裝" eng="PACKAGE" />
      <div className="grid gap-3">
        {packages.map(p => (
          <label key={p.id} className="flex items-center gap-4 rounded-2xl border border-border p-5 bg-card has-[:checked]:border-primary">
            <input type="radio" name="package" value={p.id} className="size-4" />
            <div className="flex-1">
              <div className="font-cjk text-sm font-semibold">{p.name}</div>
              <div className="mt-1 font-mono text-xs text-muted-foreground">{p.remaining}/{p.total} 堂</div>
              <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-foreground" style={{ width: `${(p.remaining/p.total)*100}%` }} />
              </div>
            </div>
          </label>
        ))}
      </div>
    </section>
  ) : (
    <EmptyState
      icon={<Package className="size-5" />}
      title="尚無可用套裝"
      hint="先去申請一個套裝才能預約"
      cta={<PrimaryCtaLink href={`/${tenant.slug}/packages`}>瀏覽套裝</PrimaryCtaLink>}
    />
  )}

  {/* Cancellation policy */}
  <div className="rounded-2xl border border-border bg-muted/40 p-5">
    <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">POLICY · 取消政策</div>
    <p className="mt-2 font-cjk text-xs text-muted-foreground">
      預約時段前 {service.cancel_deadline_hours} 小時內取消,堂數不退回。
    </p>
  </div>

  {/* Submit */}
  <form action={bookAction}>
    <input type="hidden" name="slotId" value={slot.id} />
    <input type="hidden" name="packageId" value={/* selected */} />
    <PrimaryCta>確認預約</PrimaryCta>
  </form>
</div>
```

Reuse / adapt the existing `bookAction` server action. Preserve the existing booking RPC call path (`book_with_purchase`).

- [ ] **Step 3: Quality gate**

```bash
npm run lint && npm run typecheck && npm run test
```

- [ ] **Step 4: Commit**

```bash
git add src/app/book/
git commit -m "$(cat <<'EOF'
feat(book-page): align /book/<slotId> to mockup

Slot detail card with big display time, package radio cards with progress bars, empty state for no packages, cancellation policy frame.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `/login` Polish

**Files:**
- Read: `claudeDesign/student/page-auth.jsx`
- Modify: `src/app/(auth)/login/page.tsx` (4.8KB)

**Alignment targets (spec §4a-04):**

S6 already shipped split layout with `<SidePanel>`. Plan 2 work is small:

1. **`?signedup=1` banner** — when present, render a success banner above the form.
2. **Form polish** — confirm Buttons use the new variants (`pill` size, `withArrow="inline"` on submit).
3. **Kicker / SectionHead** — use the new `<Kicker>` component for the "QUICKRESERVE / LOGIN" label if a class string is currently inlined.

**Steps:**

- [ ] **Step 1: Read**

```bash
cat 'claudeDesign/student/page-auth.jsx'
cat 'src/app/(auth)/login/page.tsx'
```

- [ ] **Step 2: Add signedup banner**

When `searchParams.signedup === '1'`, render at the top of the form column:

```tsx
{signedUp && (
  <div className="mb-6 rounded-2xl border border-accent bg-accent/30 p-4">
    <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-foreground">SIGNED UP ·</div>
    <div className="mt-1 font-cjk text-sm text-foreground">註冊成功!請使用剛剛建立的帳號登入。</div>
  </div>
)}
```

Extract `signedUp = searchParams.signedup === '1'` near the top of the page component.

- [ ] **Step 3: Replace inlined kicker with `<Kicker>`**

Find any `<div className="font-mono ... uppercase tracking-...">QUICKRESERVE / LOGIN</div>` style block in the page, and replace with:

```tsx
import { Kicker } from '@/components/ui/kicker'
...
<Kicker>QUICKRESERVE / LOGIN</Kicker>
```

- [ ] **Step 4: Submit button polish**

If the submit button isn't already using the new variants, switch to:

```tsx
<Button variant="default" size="pill" withArrow="inline" type="submit" fullWidth>
  登入
</Button>
```

- [ ] **Step 5: Quality gate + commit**

```bash
npm run lint && npm run typecheck && npm run test
git add 'src/app/(auth)/login/'
git commit -m "$(cat <<'EOF'
feat(login): polish /login — Kicker + signedup banner + pill submit

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `/signup` Polish + Invite Mode

**Files:**
- Read: `claudeDesign/student/page-auth.jsx`
- Modify: `src/app/(auth)/signup/page.tsx` (5.4KB)

**Alignment targets (spec §4a-05):**

1. **Same polish as `/login`** (Kicker, pill submit).
2. **Invite mode banner** when `?invite=<token>` is present — show "您被 XX 邀請" with tenant info. The actual invite acceptance flow lives at `/invite/[token]` — this banner is just informational on signup if user arrived via an invite link.

**Steps:**

- [ ] **Step 1: Read**

```bash
cat 'src/app/(auth)/signup/page.tsx'
cat 'src/app/invite/[token]/page.tsx'
```

- [ ] **Step 2: Apply same polish as login**

Replace any inlined kicker with `<Kicker>QUICKRESERVE / SIGNUP</Kicker>`. Submit button uses `<Button size="pill" withArrow="inline" fullWidth>` pattern.

- [ ] **Step 3: Invite mode banner**

When `searchParams.invite` is set, fetch the invite (existing logic in `/invite/[token]` will have the pattern). Render banner:

```tsx
{invite && (
  <div className="mb-6 rounded-2xl border border-accent bg-accent/30 p-4">
    <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-foreground">INVITED</div>
    <div className="mt-1 font-cjk text-sm">
      您被 <strong>{invite.tenant_name}</strong> 邀請加入
    </div>
  </div>
)}
```

If the signup page doesn't currently support `?invite=` query, just skip this step and leave a TODO comment with the file:line for follow-up. The invite flow may already route through `/invite/[token]` exclusively.

- [ ] **Step 4: Quality gate + commit**

```bash
npm run lint && npm run typecheck && npm run test
git add 'src/app/(auth)/signup/'
git commit -m "$(cat <<'EOF'
feat(signup): polish /signup — Kicker + invite banner + pill submit

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: `/my-bookings` KPI Row + DateStrip Wiring

**Files:**
- Read: `claudeDesign/student/page-bookings.jsx`
- Modify: `src/app/(customer)/my-bookings/page.tsx` (11.5KB)

**Alignment targets (spec §4a-06):**

S6 already shipped the date-strip card layout. Plan 2 adds:

1. **KPI row at top** — 4 KpiCards: 本週 (this-week count) / 待回覆 (pending count) / 已完成 (completed count) / 已取消 (cancelled count).
2. **Use `<DateStrip>` primitive** for the per-group header (replaces the inline group rendering).
3. **Reschedule button** on each booking card — link to `/<slug>?reschedule=<bookingId>`.

**New server query** — counts grouped by status:

```ts
const { data: counts } = await supabase
  .from('bookings')
  .select('status', { count: 'exact', head: false })
  .eq('customer_id', session.userId)
```

Then aggregate counts client-side, OR run a single RPC. The simpler version: 4 head:true count queries in parallel:

```ts
const [pendingC, confirmedC, completedC, cancelledC] = await Promise.all([
  supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('customer_id', uid).eq('status','pending'),
  supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('customer_id', uid).eq('status','confirmed'),
  supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('customer_id', uid).eq('status','completed'),
  supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('customer_id', uid).eq('status','cancelled'),
])
```

This is 4 head-only counts — fast enough. (Alternative: a single materialized view or RPC; out of scope.)

**Steps:**

- [ ] **Step 1: Read mockup + current**

```bash
cat 'claudeDesign/student/page-bookings.jsx'
cat 'src/app/(customer)/my-bookings/page.tsx'
```

- [ ] **Step 2: Add KPI counts to fetch**

Add the 4 parallel count queries to the existing `Promise.all` in the page component. Pass counts into the JSX.

- [ ] **Step 3: KPI row JSX**

Above the booking list groups, add:

```tsx
<section className="grid gap-3 grid-cols-2 lg:grid-cols-4">
  <KpiCard label="本週" value={thisWeekCount ?? 0} unit="筆" hint="未來 7 天" />
  <KpiCard label="待回覆" value={pendingCount ?? 0} unit="筆" hint="教練核可中" accent={(pendingCount ?? 0) > 0} />
  <KpiCard label="已完成" value={completedCount ?? 0} unit="筆" />
  <KpiCard label="已取消" value={cancelledCount ?? 0} unit="筆" />
</section>
```

(`thisWeekCount` is harder — it's `pending + confirmed` whose `availability_slots.start_at` is in the next 7 days. Compute from the existing `bookings` array client-side OR add another query. For Plan 2, compute from the existing fetched data: count bookings where status is pending/confirmed and slot.start_at in `[now, now + 7d]`.)

- [ ] **Step 4: Replace inline group headers with `<DateStrip>`**

Find the existing group iteration (uses keys like "今日", "本週", "之後", "已過"). Map those string keys to the typed `DateStripGroup`:

```tsx
const groupKeyMap: Record<string, DateStripGroup> = {
  '今日': 'today',
  '本週': 'thisWeek',
  '之後': 'later',
  '已過': 'past',
  '其他': 'past', // fold
}

{GROUP_ORDER.map(label => {
  const items = grouped[label]
  if (!items?.length) return null
  return (
    <section key={label} className="space-y-3">
      <DateStrip groupKey={groupKeyMap[label]} count={items.length} />
      <div className="space-y-3">
        {items.map(b => <BookingCard key={b.id} b={b} />)}
      </div>
    </section>
  )
})}
```

Import `DateStrip, type DateStripGroup` from `@/components/bookings/date-strip`.

- [ ] **Step 5: Add reschedule button to BookingCard**

In `BookingCard`, for active bookings (`canCancel` style condition), add a reschedule link:

```tsx
{canCancel && tenant?.slug && (
  <Link
    href={`/${tenant.slug}?reschedule=${b.id}`}
    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
  >
    <Calendar className="size-3" /> 改期
  </Link>
)}
```

Place next to existing cancel button.

- [ ] **Step 6: Quality gate + commit**

```bash
npm run lint && npm run typecheck && npm run test
git add 'src/app/(customer)/my-bookings/'
git commit -m "$(cat <<'EOF'
feat(my-bookings): KPI row + DateStrip wiring + reschedule link

4 KpiCards (本週/待回覆/已完成/已取消), inline group headers replaced with <DateStrip>, reschedule button on each active booking card linking to /<slug>?reschedule=<id>.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Plan 2 Final Quality Gate

**Files:** none (verification only)

- [ ] **Step 1:** Run full gates:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

All four must pass. Fix root causes in focused `fix(...)` commits if any fail.

- [ ] **Step 2: Manual visual smoke**

```bash
npm run dev
```

In browser, visit each of the 6 pages (use the demo tenant `coach-poyu` from seed):
- `/coach-poyu` (public)
- `/coach-poyu/packages`
- `/book/<some-slot-id>` (pick a slot from `/coach-poyu`)
- `/login` (and `/login?signedup=1`)
- `/signup`
- `/my-bookings` (after signing in)

For each: light + dark mode (theme toggle), 3 breakpoints (desktop / 768 tablet / 375 mobile via dev tools).

If a page looks broken at a breakpoint, fix root cause and commit.

- [ ] **Step 3: No final commit needed** unless fixes were made.

---

## Done Criteria for Plan 2

- All 6 student pages render without console error, hydration warning, or type error
- Light + dark + 3 breakpoints all work
- New tenant fields (years_exp/established_year/city) display on `/<slug>` when populated
- `service_packages.is_popular` drives POPULAR pill on `/<slug>/packages`
- `<RescheduleBanner>` appears on `/<slug>` when `?reschedule=<bookingId>` is set
- `/my-bookings` shows 4 KpiCards + DateStrip-based group headers + reschedule link per booking
- `npm run lint` / `typecheck` / `test` / `build` all green

## Out of Scope for Plan 2 (later plans)

- Plan 3: Coach Backoffice 7 pages
- Plan 4: Coach Settings 4 pages
- Plan 5: Final QA pass (17 pages × 4 breakpoints) + docs update

---

## Self-Review Notes

**Spec coverage (§4a):**
- ✅ 01 公開頁 → Task 1
- ✅ 02 packages → Task 2
- ✅ 03 book → Task 3
- ✅ 04 login → Task 4
- ✅ 05 signup → Task 5
- ✅ 06 my-bookings → Task 6
- ✅ Final QA → Task 7

**Placeholder scan:**
- Step 2 of Task 1 says "Write notes (mental or scratch — don't commit a notes file)" — that's a process instruction, not a placeholder, OK.
- Task 5 Step 3 says "skip this step and leave a TODO comment" — this is conditional on the existing code state; the implementer will know after reading. Acceptable because we don't know the exact state without reading first.

**Type consistency:**
- `DateStripGroup = 'today' | 'thisWeek' | 'later' | 'past'` matches P1 definition.
- `Badge variant="yellow"` matches existing badge variants.
- `Button variant="default" | "outline" | "ghost"` matches existing button variants.
- `withArrow="circle" | "inline"` from P1 used consistently.

**Architectural notes:**
- Tasks 1, 2, 6 do the bulk of the work; tasks 3, 4, 5 are smaller polish/feature additions. This matches the actual spec scope — most pages are already partly done from S6, the remaining work concentrates on `/<slug>` and `/my-bookings`.
