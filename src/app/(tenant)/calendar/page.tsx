import { Suspense } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'
import { requireTenantMember } from '@/lib/auth/get-session'
import { memberDisplayName } from '@/lib/auth/display-name'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { buttonVariants } from '@/components/ui/button'
import { SectionHead } from '@/components/ui/section-head'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import NewSlotDialog from './new-slot-dialog'
import RecurringRuleDialog from './recurring-rule-dialog'
import MemberFilter from './member-filter'
import CalendarPanel from './calendar-panel'
import { calendarRange } from './calendar-range'

type View = 'week' | 'list' | 'month'

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{
    week?: string
    members?: string
    view?: string
    date?: string
  }>
}) {
  const session = await requireTenantMember()
  const params = await searchParams
  const initialView: View = params.view === 'list' || params.view === 'month' ? params.view : 'week'

  // 週、清單、月檢視的日期範圍一律以台灣日界計算（不受伺服器時區影響）。
  // 抓資料的範圍依檢視而定：月檢視抓滿 6 週的月曆格，其他只抓一週；上界不含。
  const {
    weekStartKey,
    weekEndKey,
    monthStartKey,
    prevWeekKey,
    nextWeekKey,
    fetchStart,
    fetchEndExclusive,
  } = calendarRange({ weekParam: params.week, now: new Date(), view: initialView })

  const supabase = await createSupabaseServerClient()

  let allMembers: Array<{
    id: string
    role: string
    label: string
    isSelf: boolean
  }> = []
  if (session.role === 'tenant_owner') {
    const { data } = await supabase
      .from('tenant_members')
      .select('id, role, display_name, invited_email, user_id')
      .eq('tenant_id', session.tenantId)
      .eq('status', 'active')
      .order('role', { ascending: false })
    allMembers = (data ?? []).map((m) => ({
      id: m.id,
      role: m.role,
      label:
        m.role === 'owner'
          ? '我'
          : (memberDisplayName({ displayName: m.display_name, invitedEmail: m.invited_email }) ??
            'Staff'),
      isSelf: m.id === session.memberId,
    }))
  } else {
    allMembers = [{ id: session.memberId, role: 'staff', label: '我', isSelf: true }]
  }

  const isAll = !params.members || params.members === 'all'
  const selectedIds = isAll
    ? allMembers.map((m) => m.id)
    : params.members!.split(',').filter((id) => allMembers.some((m) => m.id === id))
  const effectiveIds = selectedIds.length > 0 ? selectedIds : [session.memberId]
  const viewingSelfOnly = effectiveIds.length === 1 && effectiveIds[0] === session.memberId
  const hasMemberFilter = !isAll && allMembers.length > 1
  const filterSummary = hasMemberFilter
    ? selectedIds.length === 1
      ? (allMembers.find((m) => m.id === selectedIds[0])?.label ?? '1 位')
      : `${selectedIds.length} 位成員`
    : null

  const { data: slots } = await supabase
    .from('availability_slots')
    .select('id, start_at, end_at, status, member_id, service_id, services(name, max_capacity)')
    .in('member_id', effectiveIds)
    .gte('start_at', fetchStart.toISOString())
    .lt('start_at', fetchEndExclusive.toISOString())
    .order('start_at')

  const slotIds = (slots ?? []).map((s) => s.id)
  const bookingsBySlot: Record<
    string,
    { id: string; status: string; customerName: string | null } | undefined
  > = {}
  const slotBookingCounts: Record<string, number> = {}
  if (slotIds.length) {
    const { data: bks } = await supabase
      .from('bookings')
      .select('id, slot_id, status, customers(display_name)')
      .in('slot_id', slotIds)
      .neq('status', 'cancelled')
    for (const b of bks ?? []) {
      slotBookingCounts[b.slot_id] = (slotBookingCounts[b.slot_id] ?? 0) + 1
      const c = b.customers as { display_name: string | null } | null
      bookingsBySlot[b.slot_id] = {
        id: b.id,
        status: b.status,
        customerName: c?.display_name ?? null,
      }
    }
  }

  const { data: services } = await supabase
    .from('services')
    .select('id, name, duration_minutes')
    .eq('is_active', true)
    .order('name')

  // Fetch unavailable events for the active range (per effective member set)
  const { data: rawEvents } = await supabase
    .from('unavailable_events')
    .select('id, member_id, start_at, end_at, reason')
    .in('member_id', effectiveIds)
    .gte('end_at', fetchStart.toISOString())
    .lt('start_at', fetchEndExclusive.toISOString())
  const unavailableEvents = (rawEvents ?? []).map((e) => ({
    id: e.id,
    memberId: e.member_id,
    startAt: e.start_at,
    endAt: e.end_at,
    reason: e.reason,
  }))

  // Week navigation (week view only). For month view we still preserve query
  // params; the user navigates by week even when month-viewing.
  const baseQs = new URLSearchParams()
  if (params.members) baseQs.set('members', params.members)
  if (initialView !== 'week') baseQs.set('view', initialView)
  const buildHref = (week: string | null) => {
    const qs = new URLSearchParams(baseQs)
    if (week) qs.set('week', week)
    else qs.delete('week')
    const s = qs.toString()
    return `/calendar${s ? `?${s}` : ''}`
  }
  const navPrevHref = buildHref(prevWeekKey)
  const navNextHref = buildHref(nextWeekKey)
  const navTodayHref = buildHref(null)
  const navLabel =
    initialView === 'month'
      ? monthStartKey.slice(0, 7).replaceAll('-', '/')
      : `${weekStartKey.replaceAll('-', '/')} – ${weekEndKey.slice(5).replaceAll('-', '/')}`

  // Build the "clear filter" href once for the chip.
  const clearMemberHref = (() => {
    const qs = new URLSearchParams(baseQs)
    qs.delete('members')
    if (params.week) qs.set('week', params.week)
    const s = qs.toString()
    return `/calendar${s ? `?${s}` : ''}`
  })()

  const slotDisplays = (slots ?? []).map((s) => {
    const member = allMembers.find((m) => m.id === s.member_id)
    const booking = bookingsBySlot[s.id]
    const conflict = unavailableEvents.find(
      (e) => e.memberId === s.member_id && e.startAt < s.end_at && e.endAt > s.start_at,
    )
    return {
      id: s.id,
      startAt: s.start_at,
      endAt: s.end_at,
      status: s.status as 'available' | 'pending' | 'booked' | 'cancelled',
      serviceName: (s.services as { name: string; max_capacity: number } | null)?.name ?? null,
      memberLabel: member?.label ?? '',
      memberId: s.member_id,
      isOwn: s.member_id === session.memberId,
      customerName: booking?.customerName ?? null,
      bookingId: booking?.id ?? null,
      conflictReason: conflict?.reason ?? (conflict ? '不可用事件' : null),
      bookingCount: slotBookingCounts[s.id] ?? 0,
      maxCapacity: (s.services as { name: string; max_capacity: number } | null)?.max_capacity ?? 1,
    }
  })

  return (
    <div className="space-y-5">
      <SectionHead
        kicker="CALENDAR · 行事曆"
        title="行事曆"
        eng="CALENDAR"
        hint={viewingSelfOnly ? '檢視您的時段' : `檢視 ${effectiveIds.length} 位成員的時段`}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {allMembers.length > 1 && (
            <MemberFilter members={allMembers} selectedIds={selectedIds} week={params.week} />
          )}
          {hasMemberFilter && filterSummary && (
            <Link
              href={clearMemberHref}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1',
                'font-mono text-[10.5px] uppercase tracking-[0.12em] text-foreground',
                'hover:bg-muted',
              )}
              aria-label={`清除成員篩選：${filterSummary}`}
            >
              <span className="text-muted-foreground">MEMBER ·</span>
              <span className="font-cjk normal-case tracking-normal">{filterSummary}</span>
              <X className="size-3 text-muted-foreground" />
            </Link>
          )}
          <div className="flex items-center gap-2 text-sm">
            <Link href={navPrevHref} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              ◄
            </Link>
            <div className="font-mono min-w-44 text-center text-sm tracking-wider">{navLabel}</div>
            <Link href={navTodayHref} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
              {initialView === 'month' ? '本月' : '本週'}
            </Link>
            <Link href={navNextHref} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              ►
            </Link>
          </div>
        </div>
        <div className="flex gap-2">
          {viewingSelfOnly && (
            <>
              <Link
                href="/calendar/rules"
                className={buttonVariants({ variant: 'ghost', size: 'sm' })}
              >
                管理重複規則
              </Link>
              <RecurringRuleDialog services={services ?? []} />
              <NewSlotDialog services={services ?? []} weekStart={weekStartKey} />
            </>
          )}
          {!viewingSelfOnly && (
            <Badge variant="yellow" className="self-center">
              多成員視圖（只能編輯自己的時段）
            </Badge>
          )}
        </div>
      </div>

      <Suspense fallback={null}>
        <CalendarPanel
          initialView={initialView}
          weekStart={weekStartKey}
          monthAnchor={monthStartKey}
          slots={slotDisplays}
          showMemberLabel={!viewingSelfOnly}
        />
      </Suspense>
    </div>
  )
}
