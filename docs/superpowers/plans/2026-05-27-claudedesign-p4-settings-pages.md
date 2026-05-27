# claudeDesign UI Alignment · Plan 4 — Coach Settings 4 Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the 4 coach settings/calendar pages (`/settings/profile`, `/settings/notifications`, `/calendar/availability`, `/calendar/rules`) to the `claudeDesign/coach/` settings mockup using primitives from Plan 1 + patterns from Plans 2-3.

**Architecture:** Per-page polish tasks. Most pages already have substantial existing implementation; this plan mainly adds the SubNav segmented control wrapper, brings the section structures into mockup alignment (numbered badges, sticky save bar, etc.), and creates `/settings/notifications` from scratch (it doesn't yet exist on the tenant side — the existing `<NotificationPreferences>` component will be wrapped with the new `NotificationMatrix` + `QuietHoursInput` primitives from Plan 1).

**Tech Stack:** Next.js 15 App Router (RSC + Server Actions), React 19, Tailwind v4, P1 primitives (`SubNav`, `AppShell`, `Kicker`, `NotificationMatrix`, `QuietHoursInput`, `Btn`).

**Spec:** `docs/superpowers/specs/2026-05-27-claudedesign-ui-alignment-design.md` — section §4c covers these pages.

**Mockup root:** `claudeDesign/coach/` — page-settings-profile.jsx, page-settings-notifications.jsx, page-availability.jsx, page-rules.jsx.

---

## Convention notes (apply to every task)

- **Tokens only.** No hardcoded colors / radii.
- **`<SectionHead kicker title eng hint right>`** for section headers.
- **`<Kicker>`** for inline mono labels.
- **`<SubNav items active>`** at top of every settings page for navigation between the 4.
- **Buttons**: default = `<Button variant="default" size="pill" withArrow="inline">`. Outline / ghost as appropriate.
- **Cards**: `rounded-2xl border border-border bg-card shadow-[0_8px_24px_-18px_rgba(0,0,0,0.18)]`.
- **Accent yellow = punctuation only.**
- **Server components** by default. `'use client'` only when needed (forms with optimistic state, dialogs).

---

## SubNav items (shared across all 4 tasks)

Every settings/calendar page in this plan uses the same SubNav config:

```ts
const SETTINGS_NAV_ITEMS = [
  { href: '/settings/profile', label: '公開頁', eng: 'PROFILE' },
  { href: '/settings/notifications', label: '通知', eng: 'NOTIF' },
  { href: '/calendar/availability', label: '作息', eng: 'AVAILABILITY' },
  { href: '/calendar/rules', label: '重複', eng: 'RULES' },
]
```

Place this at the top of each task's page (just below the page kicker / title, before the main content).

---

## Task 1: `/settings/profile` — 6 Sections + Sticky Save Bar

**Files:**
- Read: `claudeDesign/coach/page-settings-profile.jsx`
- Modify: `src/app/(tenant)/settings/profile/page.tsx` (1.9KB)
- Possibly modify: `src/app/(tenant)/settings/profile/profile-form.tsx` (7.1KB) — has the form structure
- Possibly modify: associated client components (avatar-uploader.tsx, photo-gallery-manager.tsx, bio-editor.tsx, video-input.tsx)

**Alignment targets (spec §4c-01):**

1. **SubNav** at top
2. **6 numbered sections** with `<SectionHead kicker={"0X · ..."}>` structure:
   - 01 基本資料 (slug, name, avatar)
   - 02 Hero 內容 (years_exp, established_year, city)
   - 03 聯絡資訊 (email, phone, line_id, note)
   - 04 關於我 (bio_html via BioEditor)
   - 05 介紹影片 (intro_video_url via VideoInput)
   - 06 環境照片 (photo gallery via PhotoGalleryManager)
3. **Sticky bottom save bar** when any field is dirty — currently the form likely submits via a regular button at the bottom; convert to sticky positioned save bar at the bottom of the viewport.

**Steps:**

- [ ] **Step 1: Read mockup + current files**

```bash
cat 'claudeDesign/coach/page-settings-profile.jsx'
cat 'src/app/(tenant)/settings/profile/page.tsx'
cat 'src/app/(tenant)/settings/profile/profile-form.tsx'
ls 'src/app/(tenant)/settings/profile/'
cat 'src/components/shell/sub-nav.tsx'
cat 'src/components/ui/section-head.tsx'
```

- [ ] **Step 2: Add SubNav + AppShell-like page header**

In `page.tsx`, wrap the existing form. Structure:

```tsx
import { SubNav } from '@/components/shell/sub-nav'
import { Kicker } from '@/components/ui/kicker'

const NAV = [
  { href: '/settings/profile', label: '公開頁', eng: 'PROFILE' },
  { href: '/settings/notifications', label: '通知', eng: 'NOTIF' },
  { href: '/calendar/availability', label: '作息', eng: 'AVAILABILITY' },
  { href: '/calendar/rules', label: '重複', eng: 'RULES' },
]

export default async function SettingsProfilePage() {
  // ... existing requireTenantMember + tenant fetch
  return (
    <div className="space-y-7 pb-24"> {/* pb-24 to make room for sticky save bar */}
      <div>
        <Kicker>SETTINGS · 教練設定</Kicker>
        <h1 className="mt-2 font-display font-cjk text-3xl font-black uppercase sm:text-4xl">公開頁資料</h1>
      </div>
      <SubNav items={NAV} active="/settings/profile" />
      <ProfileForm tenant={tenant} {/* etc */} />
    </div>
  )
}
```

- [ ] **Step 3: Restructure ProfileForm into 6 numbered sections**

In `profile-form.tsx`, the form likely renders fields in a flat layout. Wrap into 6 sections, each with a numbered badge:

```tsx
function NumberedSection({ no, title, eng, hint, children }: { no: string; title: string; eng: string; hint?: string; children: ReactNode }) {
  return (
    <section className="grid gap-6 lg:grid-cols-[64px_1fr]">
      <div className="hidden lg:block">
        <div className="grid size-12 place-items-center rounded-full bg-foreground text-background font-display text-lg">
          {no}
        </div>
      </div>
      <div className="space-y-5">
        <div>
          <div className="lg:hidden font-display text-2xl tabular-nums">{no}</div>
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{eng}</div>
          <h2 className="mt-1 font-display font-cjk text-2xl font-black">{title}</h2>
          {hint && <p className="mt-1 font-cjk text-sm text-muted-foreground">{hint}</p>}
        </div>
        {children}
      </div>
    </section>
  )
}
```

Then wrap each chunk of fields:

```tsx
<NumberedSection no="01" title="基本資料" eng="BASIC INFO" hint="公開頁顯示的核心資料">
  {/* slug field, name field, avatar uploader */}
</NumberedSection>
<NumberedSection no="02" title="Hero 內容" eng="HERO META" hint="顯示在 /<slug> 開頭的執業年資 / 城市">
  {/* years_exp, established_year, city inputs */}
</NumberedSection>
{/* ... 6 sections total */}
```

For the new Hero meta inputs (Section 02), `tenant.years_exp` etc are now available — add input fields if not already present:

```tsx
<div className="grid gap-4 sm:grid-cols-3">
  <label className="block">
    <span className="font-cjk text-sm font-semibold">執業年資</span>
    <input type="number" name="years_exp" defaultValue={tenant.years_exp ?? ''} min={0} className="..." />
  </label>
  <label className="block">
    <span className="font-cjk text-sm font-semibold">創立年份</span>
    <input type="number" name="established_year" defaultValue={tenant.established_year ?? ''} min={1900} max={2100} className="..." />
  </label>
  <label className="block">
    <span className="font-cjk text-sm font-semibold">城市 / 地區</span>
    <input type="text" name="city" defaultValue={tenant.city ?? ''} className="..." />
  </label>
</div>
```

**Adjust the server action** (`actions.ts` likely in the same folder) to accept these 3 fields in its Zod schema, and `update` them on the tenants row. If the action already accepts an `unknown` payload via `next-safe-action`, just add the field names.

- [ ] **Step 4: Sticky save bar**

Convert the bottom submit button to a sticky save bar. The form likely is a `<form action={action}>`. Wrap the submit row:

```tsx
<div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur p-4">
  <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5">
    <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
      {isDirty ? '有未儲存變更' : '已同步'}
    </div>
    <div className="flex gap-2">
      <Button variant="ghost" size="sm" type="reset">取消</Button>
      <Button variant="default" size="pill" withArrow="inline" type="submit" disabled={!isDirty || isPending}>
        儲存變更
      </Button>
    </div>
  </div>
</div>
```

Tracking `isDirty` requires the form to be a client component. Use react-hook-form `formState.isDirty` (likely already in the form). If the form is mixed server-form + client islands, the sticky bar can be inside the client form component itself.

Note: The `mx-auto max-w-6xl` matches the tenant chrome's main padding so the bar lines up with the content column.

- [ ] **Step 5: Quality gate + commit**

```bash
npm run lint && npm run typecheck && npm run test
git add 'src/app/(tenant)/settings/profile/'
git commit -m "$(cat <<'EOF'
feat(settings-profile): align /settings/profile to mockup

SubNav for settings/calendar nav, 6 numbered sections (BASIC INFO / HERO META / CONTACT / ABOUT / VIDEO / GALLERY) with NumberedSection wrapper, new Hero meta inputs (years_exp / established_year / city) wired to existing tenants update action, sticky bottom save bar showing dirty state.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

**Deferred:** Service ordering (drag-to-reorder) from mockup Section 06 — would need new server action + drag library. Out of scope.

---

## Task 2: `/settings/notifications` — Build From Scratch

**Files:**
- Read: `claudeDesign/coach/page-settings-notifications.jsx`
- Create: `src/app/(tenant)/settings/notifications/page.tsx`
- Possibly create: `src/app/(tenant)/settings/notifications/notification-prefs-form.tsx` (client component)
- Possibly modify: `src/components/settings/notification-preferences.tsx` (existing) — may extract its event×channel logic

**Important:** This route does NOT currently exist on the tenant side. `/notifications` was the wrapper for `<NotificationPreferences>` until Plan 3 rebuilt it as an inbox. Now we need a real settings page for preferences.

**Alignment targets (spec §4c-02):**

1. **SubNav** at top
2. **Top section: Web Push subscription card** — shows current device subscription status with subscribe/unsubscribe button. Reuse `<PushOptIn>` if exists at `src/components/push-opt-in.tsx`.
3. **Device list** — show subscribed devices (`push_subscriptions` table rows for current user) with UA + last_used + remove button. If schema has data, render; if empty, EmptyState.
4. **NotificationMatrix** — use P1 primitive. Events list:
   - `booking_created` 新預約
   - `booking_confirmed` 預約已確認
   - `booking_cancelled` 預約取消
   - `booking_rescheduled` 預約改期
   - `package_request` 套裝申請
   - `package_approved` 套裝核准
   - `pre_event` 課前提醒
   - `daily_reminder` 每日提醒
   - `weekly_summary` 每週摘要
5. **QuietHoursInput** — use P1 primitive. Loads/saves to `notification_preferences.quiet_hours_start/end`.

**Server actions needed:**
- `updateNotificationChannels(channels)` — writes the channels jsonb
- `updateQuietHours(start, end)` — writes quiet_hours_start/end
- Remove device action (already may exist in existing notification-preferences.tsx — read it)

**Steps:**

- [ ] **Step 1: Read mockup + existing components**

```bash
cat 'claudeDesign/coach/page-settings-notifications.jsx'
cat 'src/components/settings/notification-preferences.tsx'
cat 'src/components/settings/notification-matrix.tsx'  # P1 primitive
cat 'src/components/settings/quiet-hours-input.tsx'   # P1 primitive
cat 'src/components/push-opt-in.tsx'  # may exist
ls 'src/components/settings/'
ls 'src/app/(tenant)/settings/'
```

- [ ] **Step 2: Create folder + page.tsx**

Create `src/app/(tenant)/settings/notifications/page.tsx`:

```tsx
import { requireTenantMember } from '@/lib/auth/get-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { Kicker } from '@/components/ui/kicker'
import { SubNav } from '@/components/shell/sub-nav'
import { SectionHead } from '@/components/ui/section-head'
import { EmptyState } from '@/components/ui/empty-state'
import { Bell } from 'lucide-react'
import PushOptIn from '@/components/push-opt-in'
import NotificationPrefsForm from './notification-prefs-form'

const NAV = [
  { href: '/settings/profile', label: '公開頁', eng: 'PROFILE' },
  { href: '/settings/notifications', label: '通知', eng: 'NOTIF' },
  { href: '/calendar/availability', label: '作息', eng: 'AVAILABILITY' },
  { href: '/calendar/rules', label: '重複', eng: 'RULES' },
]

const EVENTS = [
  { key: 'booking_created', label: '新預約' },
  { key: 'booking_confirmed', label: '預約已確認' },
  { key: 'booking_cancelled', label: '預約取消' },
  { key: 'booking_rescheduled', label: '預約改期' },
  { key: 'package_request', label: '套裝申請' },
  { key: 'package_approved', label: '套裝核准' },
  { key: 'pre_event', label: '課前提醒' },
  { key: 'daily_reminder', label: '每日提醒' },
  { key: 'weekly_summary', label: '每週摘要' },
]

export default async function SettingsNotificationsPage() {
  const session = await requireTenantMember()
  const supabase = await createSupabaseServerClient()

  const [{ data: prefs }, { data: devices }] = await Promise.all([
    supabase
      .from('notification_preferences')
      .select('channels, quiet_hours_start, quiet_hours_end')
      .eq('user_id', session.userId)
      .maybeSingle(),
    supabase
      .from('push_subscriptions')
      .select('id, endpoint, user_agent, last_used_at, created_at')
      .eq('user_id', session.userId)
      .order('last_used_at', { ascending: false }),
  ])

  // Defaults if no row exists
  const channels = (prefs?.channels as Record<string, Record<string, boolean>> | undefined) ?? {
    web_push: Object.fromEntries(EVENTS.map(e => [e.key, true])),
    in_app: Object.fromEntries(EVENTS.map(e => [e.key, true])),
  }
  const quietStart = prefs?.quiet_hours_start ?? null
  const quietEnd = prefs?.quiet_hours_end ?? null

  return (
    <div className="space-y-7">
      <div>
        <Kicker>SETTINGS · 教練設定</Kicker>
        <h1 className="mt-2 font-display font-cjk text-3xl font-black uppercase sm:text-4xl">通知偏好</h1>
      </div>
      <SubNav items={NAV} active="/settings/notifications" />

      {/* Web Push subscription card */}
      <section>
        <SectionHead kicker="WEB PUSH · 推播訂閱" title="此裝置訂閱" eng="THIS DEVICE" hint="允許瀏覽器在背景接收提醒" />
        <PushOptIn />
      </section>

      {/* Device list */}
      <section>
        <SectionHead kicker="DEVICES · 已訂閱裝置" title="所有裝置" eng="ALL DEVICES" />
        {(!devices || devices.length === 0) ? (
          <EmptyState icon={<Bell className="size-5" />} title="尚無訂閱裝置" hint="在上方訂閱本裝置以接收推播" />
        ) : (
          <ul className="space-y-2">
            {devices.map(d => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
                <div className="min-w-0 flex-1">
                  <div className="font-cjk text-sm font-semibold truncate">{deviceLabelFromUA(d.user_agent)}</div>
                  <div className="font-mono mt-0.5 text-xs text-muted-foreground">
                    最後使用 {d.last_used_at ? new Date(d.last_used_at).toLocaleString('zh-TW') : '—'}
                  </div>
                </div>
                <form action={removeDeviceAction.bind(null, d.id)}>
                  <button type="submit" className="font-mono rounded-full border border-border bg-card px-3 py-1.5 text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground">
                    移除
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Matrix + Quiet hours (client form) */}
      <NotificationPrefsForm
        userId={session.userId}
        events={EVENTS}
        initialChannels={channels}
        initialQuietStart={quietStart}
        initialQuietEnd={quietEnd}
      />
    </div>
  )
}

function deviceLabelFromUA(ua: string | null): string {
  if (!ua) return '未知裝置'
  if (/iphone/i.test(ua)) return 'iPhone'
  if (/ipad/i.test(ua)) return 'iPad'
  if (/android/i.test(ua)) return 'Android'
  if (/mac/i.test(ua)) return 'Mac'
  if (/windows/i.test(ua)) return 'Windows'
  if (/linux/i.test(ua)) return 'Linux'
  return ua.split(' ')[0] ?? '未知裝置'
}
```

> Note: `removeDeviceAction` needs to be a real server action. If `src/components/settings/notification-preferences.tsx` already has one, import it. Otherwise define it inline at the top of this file as a `'use server'` function. Read the existing implementation first.

- [ ] **Step 3: Create the client form component**

`src/app/(tenant)/settings/notifications/notification-prefs-form.tsx`:

```tsx
'use client'
import { useState, useTransition } from 'react'
import { NotificationMatrix, type NotificationPrefs, type NotificationChannel } from '@/components/settings/notification-matrix'
import { QuietHoursInput } from '@/components/settings/quiet-hours-input'
import { SectionHead } from '@/components/ui/section-head'
import { Button } from '@/components/ui/button'
import { saveNotificationPrefs } from './actions'

export default function NotificationPrefsForm({
  userId,
  events,
  initialChannels,
  initialQuietStart,
  initialQuietEnd,
}: {
  userId: string
  events: { key: string; label: string }[]
  initialChannels: NotificationPrefs
  initialQuietStart: string | null
  initialQuietEnd: string | null
}) {
  const [channels, setChannels] = useState<NotificationPrefs>(initialChannels)
  const [quietStart, setQuietStart] = useState<string | null>(initialQuietStart)
  const [quietEnd, setQuietEnd] = useState<string | null>(initialQuietEnd)
  const [isPending, startTransition] = useTransition()
  const [savedAt, setSavedAt] = useState<Date | null>(null)

  const onToggle = (channel: NotificationChannel, eventKey: string, next: boolean) => {
    setChannels(prev => ({
      ...prev,
      [channel]: { ...prev[channel], [eventKey]: next },
    }))
  }

  const onQuietHoursChange = (next: { start: string | null; end: string | null }) => {
    setQuietStart(next.start)
    setQuietEnd(next.end)
  }

  const onSave = () => {
    startTransition(async () => {
      await saveNotificationPrefs({
        channels,
        quiet_hours_start: quietStart,
        quiet_hours_end: quietEnd,
      })
      setSavedAt(new Date())
    })
  }

  return (
    <>
      <section>
        <SectionHead kicker="CHANNELS · 通道矩陣" title="事件 × 通道" eng="MATRIX" hint="每個事件可獨立勾選要透過哪個通道通知" />
        <NotificationMatrix events={events} prefs={channels} onToggle={onToggle} />
      </section>

      <section>
        <SectionHead kicker="DND · 勿擾時段" title="勿擾時段" eng="QUIET HOURS" />
        <QuietHoursInput start={quietStart} end={quietEnd} onChange={onQuietHoursChange} />
      </section>

      <div className="flex items-center justify-end gap-3">
        {savedAt && !isPending && (
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            已儲存 {savedAt.toLocaleTimeString('zh-TW')}
          </span>
        )}
        <Button variant="default" size="pill" withArrow="inline" onClick={onSave} disabled={isPending}>
          {isPending ? '儲存中…' : '儲存設定'}
        </Button>
      </div>
    </>
  )
}
```

- [ ] **Step 4: Create the server action**

`src/app/(tenant)/settings/notifications/actions.ts`:

```ts
'use server'
import { z } from 'zod'
import { actionClient } from '@/lib/safe-action'  // verify import path
import { requireSession } from '@/lib/auth/get-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const SavePrefsSchema = z.object({
  channels: z.record(z.string(), z.record(z.string(), z.boolean())),
  quiet_hours_start: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable(),
  quiet_hours_end: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable(),
})

export const saveNotificationPrefs = actionClient
  .inputSchema(SavePrefsSchema)
  .action(async ({ parsedInput }) => {
    const session = await requireSession()
    const supabase = await createSupabaseServerClient()

    const { error } = await supabase
      .from('notification_preferences')
      .upsert(
        {
          user_id: session.userId,
          channels: parsedInput.channels,
          quiet_hours_start: parsedInput.quiet_hours_start,
          quiet_hours_end: parsedInput.quiet_hours_end,
        },
        { onConflict: 'user_id' }
      )

    if (error) {
      throw new Error(`儲存失敗: ${error.message}`)
    }

    revalidatePath('/settings/notifications')
  })
```

> **Verify imports** by reading `src/lib/safe-action.ts` (or wherever `next-safe-action` is set up) — the `actionClient` name may differ. Read other server actions in the repo (e.g. `src/app/(tenant)/settings/profile/actions.ts`) for the established pattern.

> If the project uses a different state pattern (e.g. raw form action without next-safe-action), match that style instead.

- [ ] **Step 5: Quality gate + commit**

```bash
npm run lint && npm run typecheck && npm run test
git add 'src/app/(tenant)/settings/notifications/' 'src/components/settings/'
git commit -m "$(cat <<'EOF'
feat(settings-notif): build /settings/notifications page on tenant side

New route wraps Plan 1's NotificationMatrix + QuietHoursInput primitives. Server page reads notification_preferences.channels (jsonb) + quiet_hours_start/end. Client form persists via saveNotificationPrefs server action (upsert into notification_preferences). Web Push subscription card (PushOptIn) + device list with remove action.

Email channel intentionally absent — only web_push + in_app per spec Phase 2 backlog.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

**Deferred:** Per-event editing of just-some-events (mockup may show inline event customization beyond the matrix); merging existing per-event booleans (`booking_status_changes_enabled` etc) into the new jsonb. Plan 1's migration kept the old booleans for cron compatibility — they can be left as-is for now.

---

## Task 3: `/calendar/availability`

**Files:**
- Read: `claudeDesign/coach/page-availability.jsx`
- Modify: `src/app/(tenant)/calendar/availability/page.tsx` (2.7KB)
- Possibly polish: `templates-section.tsx` (2.3KB), `events-section.tsx` (2KB), `effective-preview.tsx` (2.6KB), `template-editor.tsx` (9.8KB)

**Alignment targets (spec §4c-03):**

1. **SubNav** at top
2. **Three sections** with SectionHead + numbered badges (if going for consistency with Task 1):
   - 01 作息模板 (templates list with edit expand — already exists)
   - 02 不可用事件 (unavailable events list — already exists)
   - 03 預覽 (materialize preview — already exists)
3. **Polish existing sections** — apply Card styling, ensure dialogs use new Button variants.

**Steps:**

- [ ] **Step 1: Read mockup + current files**

```bash
cat 'claudeDesign/coach/page-availability.jsx'
cat 'src/app/(tenant)/calendar/availability/page.tsx'
cat 'src/app/(tenant)/calendar/availability/templates-section.tsx'
cat 'src/app/(tenant)/calendar/availability/events-section.tsx'
cat 'src/app/(tenant)/calendar/availability/effective-preview.tsx'
```

- [ ] **Step 2: Add SubNav + page header**

In `availability/page.tsx`, add the SubNav and Kicker header structure (same pattern as Task 1):

```tsx
import { SubNav } from '@/components/shell/sub-nav'
import { Kicker } from '@/components/ui/kicker'

const NAV = [
  { href: '/settings/profile', label: '公開頁', eng: 'PROFILE' },
  { href: '/settings/notifications', label: '通知', eng: 'NOTIF' },
  { href: '/calendar/availability', label: '作息', eng: 'AVAILABILITY' },
  { href: '/calendar/rules', label: '重複', eng: 'RULES' },
]

export default async function AvailabilityPage() {
  // existing fetches
  return (
    <div className="space-y-7">
      <div>
        <Kicker>SETTINGS · 教練設定</Kicker>
        <h1 className="mt-2 font-display font-cjk text-3xl font-black uppercase sm:text-4xl">作息模板</h1>
      </div>
      <SubNav items={NAV} active="/calendar/availability" />

      <section>
        <SectionHead kicker="01 · TEMPLATES" title="作息模板" eng="TEMPLATES" hint="設定每週的可用時段樣板,套用後自動展開為實際時段" />
        <TemplatesSection /* ... existing props */ />
      </section>

      <section>
        <SectionHead kicker="02 · EVENTS" title="不可用事件" eng="UNAVAILABLE" hint="休假 / 出差 / 個人預約 — 不可用事件會擋掉重疊的可用時段" />
        <EventsSection /* ... existing props */ />
      </section>

      <section>
        <SectionHead kicker="03 · PREVIEW" title="實際時段預覽" eng="EFFECTIVE" hint="模板套用後實際會產生的時段" />
        <EffectivePreview /* ... existing props */ />
      </section>
    </div>
  )
}
```

- [ ] **Step 3: Polish child components**

Inside each section component, ensure:
- Cards use `rounded-2xl border border-border bg-card` (no hardcoded colors)
- Buttons use shadcn variants from `@/components/ui/button` (not raw `<button>` with bespoke classes)
- Empty states use `<EmptyState>` primitive where applicable

Only touch styling — don't change behavior or data flow.

- [ ] **Step 4: Quality gate + commit**

```bash
npm run lint && npm run typecheck && npm run test
git add 'src/app/(tenant)/calendar/availability/'
git commit -m "$(cat <<'EOF'
feat(availability): align /calendar/availability to mockup

SubNav header, 3 SectionHead-wrapped sections (TEMPLATES / EVENTS / PREVIEW), Card token polish on existing child components. No behavioral changes — pure visual alignment.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `/calendar/rules`

**Files:**
- Read: `claudeDesign/coach/page-rules.jsx`
- Modify: `src/app/(tenant)/calendar/rules/page.tsx` (7KB)
- Possibly polish: `src/app/(tenant)/calendar/recurring-rule-dialog.tsx` (12.8KB), `rule-row-actions.tsx` (3.6KB)

**Alignment targets (spec §4c-04):**

1. **SubNav** at top
2. **Rule list** with new SectionHead + Card styling
3. **Dialog polish** — recurring-rule-dialog likely has the 4-type segmented + dynamic params + end conditions already. Polish to use new Button variants + Tailwind tokens.

**Steps:**

- [ ] **Step 1: Read**

```bash
cat 'claudeDesign/coach/page-rules.jsx'
cat 'src/app/(tenant)/calendar/rules/page.tsx'
cat 'src/app/(tenant)/calendar/recurring-rule-dialog.tsx'
cat 'src/app/(tenant)/calendar/rules/rule-row-actions.tsx'
```

- [ ] **Step 2: Add SubNav + page header**

Same pattern as Tasks 1 + 3:

```tsx
<div className="space-y-7">
  <div>
    <Kicker>SETTINGS · 教練設定</Kicker>
    <h1 className="mt-2 font-display font-cjk text-3xl font-black uppercase sm:text-4xl">重複規則</h1>
  </div>
  <SubNav items={NAV} active="/calendar/rules" />
  {/* existing rule list & create button */}
</div>
```

- [ ] **Step 3: Polish rule list cards**

The existing page renders rules likely as a list. Ensure:
- Each rule card uses `rounded-2xl border border-border bg-card p-5`
- Rule type label uses mono kicker (`<Kicker>WEEKLY · 每週</Kicker>` style)
- Frequency parameters use the typography tokens (display for numbers, mono for labels)
- Actions row uses `<Button variant="outline" size="sm">` etc.

If rule items are already a separate component, modify that component. If inline, leave inline.

- [ ] **Step 4: Polish recurring-rule-dialog (optional)**

The dialog at 12.8KB is substantial. Focus on:
- Segmented control for type (Weekly / Bi-weekly / Monthly / Custom) — if not already segmented, restructure to a chip strip
- End condition selector (date / N occurrences / never) — segmented
- Dialog action buttons use new Button variants

Don't refactor the dialog's data handling — only restyle the form layout.

- [ ] **Step 5: Quality gate + commit**

```bash
npm run lint && npm run typecheck && npm run test
git add 'src/app/(tenant)/calendar/rules/' 'src/app/(tenant)/calendar/recurring-rule-dialog.tsx'
git commit -m "$(cat <<'EOF'
feat(rules): align /calendar/rules to mockup

SubNav header, polished rule list cards (mono kicker per type, display-font frequency numbers), recurring-rule-dialog visual polish (segmented type + end-condition; data flow untouched).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

**Deferred:** Live conflict-detection inline showing in dialog (would need overlap pre-flight query). Out of scope.

---

## Task 5: Plan 4 Final Quality Gate

- [ ] **Step 1: Full quality gate**

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

All four must pass. Fix root causes in focused `fix(...)` commits if needed.

- [ ] **Step 2: Note manual spot-check pages** (don't run dev server)

Spot-check list:
- `/settings/profile` — 6 numbered sections, sticky save bar, dirty-state indicator
- `/settings/notifications` — Web Push card, device list, NotificationMatrix (9 events × 2 channels), QuietHoursInput, save button
- `/calendar/availability` — SubNav, 3 sections (templates / events / preview)
- `/calendar/rules` — SubNav, rule list, create dialog (segmented type)

All 4 pages should have a consistent SubNav at the top.

- [ ] **Step 3: No commit needed** unless fixes were made.

---

## Done Criteria for Plan 4

- All 4 settings/calendar pages render without console error / hydration warning / type error
- Light + dark mode + 3 breakpoints work
- SubNav consistent across all 4 pages, active state correct
- `/settings/profile` has 6 numbered sections + sticky save bar
- `/settings/notifications` exists at tenant side, uses NotificationMatrix + QuietHoursInput, can save preferences successfully
- `/calendar/availability` uses SectionHead wrappers
- `/calendar/rules` uses SectionHead wrappers and polished dialog
- `npm run lint` / `typecheck` / `test` / `build` all green

## Out of Scope for Plan 4 (Phase 2 backlog)

- Service drag-to-reorder on `/settings/profile`
- Per-device push opt-in / removal real implementation (UI shell only if PushOptIn lacks it)
- Live conflict detection inline on rule creation
- Persistent read state on /notifications
- Plan 5: Final QA across all 17 pages

---

## Self-Review Notes

**Spec coverage (§4c):**
- ✅ 01 settings/profile → Task 1
- ✅ 02 settings/notifications → Task 2
- ✅ 03 calendar/availability → Task 3
- ✅ 04 calendar/rules → Task 4
- ✅ Final QA → Task 5

**Placeholder scan:** None. All "verify the actual existing pattern" notes are guided conditional decisions (read first, then choose), not TODOs.

**Type consistency:**
- `NotificationPrefs` type (from P1 NotificationMatrix) — `Record<NotificationChannel, Record<string, boolean>>` consistent
- `NotificationChannel = 'web_push' | 'in_app'` consistent
- SubNav NAV constant repeated 4 times intentionally (no shared extraction to keep tasks independent)

**Scope:** Tasks 1, 2 are LARGE (profile restructure, build new page from scratch); Tasks 3, 4 are MEDIUM (polish existing). Reasonable plan size.
