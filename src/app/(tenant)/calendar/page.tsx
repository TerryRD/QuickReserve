import { Suspense } from 'react'
import Link from 'next/link'
import {
  addWeeks,
  endOfWeek,
  format,
  parseISO,
  startOfWeek,
  subWeeks,
} from 'date-fns'
import { requireTenantMember } from '@/lib/auth/get-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { buttonVariants } from '@/components/ui/button'
import { SectionHead } from '@/components/ui/section-head'
import { Badge } from '@/components/ui/badge'
import NewSlotDialog from './new-slot-dialog'
import RecurringRuleDialog from './recurring-rule-dialog'
import MemberFilter from './member-filter'
import CalendarPanel from './calendar-panel'

const TZ_OFFSET_HOURS = 8

type View = 'week' | 'day' | 'list'

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
  const initialView: View =
    params.view === 'day' || params.view === 'list' ? params.view : 'week'

  // Always fetch the full week. View switching is now client-only.
  const weekAnchor = params.week ? parseISO(params.week) : new Date()
  const weekStart = startOfWeek(weekAnchor, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(weekAnchor, { weekStartsOn: 1 })
  const initialDayAnchor = params.date ? parseISO(params.date) : new Date()

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
      .select('id, role, invited_email, user_id')
      .eq('tenant_id', session.tenantId)
      .eq('status', 'active')
      .order('role', { ascending: false })
    allMembers = (data ?? []).map((m) => ({
      id: m.id,
      role: m.role,
      label: m.role === 'owner' ? '我' : (m.invited_email?.split('@')[0] ?? 'Staff'),
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

  const { data: slots } = await supabase
    .from('availability_slots')
    .select('id, start_at, end_at, status, member_id, service_id, services(name, max_capacity)')
    .in('member_id', effectiveIds)
    .gte('start_at', weekStart.toISOString())
    .lte('start_at', weekEnd.toISOString())
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

  // Week navigation (only week-level; view & day-anchor now client-side)
  const prevWeek = format(subWeeks(weekStart, 1), 'yyyy-MM-dd')
  const nextWeek = format(addWeeks(weekStart, 1), 'yyyy-MM-dd')
  const baseQs = new URLSearchParams()
  if (params.members) baseQs.set('members', params.members)
  if (initialView !== 'week') baseQs.set('view', initialView)
  if (initialView === 'day' && params.date) baseQs.set('date', params.date)
  const buildHref = (week: string | null) => {
    const qs = new URLSearchParams(baseQs)
    if (week) qs.set('week', week)
    else qs.delete('week')
    const s = qs.toString()
    return `/calendar${s ? `?${s}` : ''}`
  }
  const navPrevHref = buildHref(prevWeek)
  const navNextHref = buildHref(nextWeek)
  const navTodayHref = buildHref(null)
  const navLabel = `${format(weekStart, 'yyyy/MM/dd')} – ${format(weekEnd, 'MM/dd')}`

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
            <MemberFilter
              members={allMembers}
              selectedIds={selectedIds}
              week={params.week}
            />
          )}
          <div className="flex items-center gap-2 text-sm">
            <Link
              href={navPrevHref}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              ◄
            </Link>
            <div className="font-mono min-w-44 text-center text-sm tracking-wider">{navLabel}</div>
            <Link
              href={navTodayHref}
              className={buttonVariants({ variant: 'ghost', size: 'sm' })}
            >
              本週
            </Link>
            <Link
              href={navNextHref}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
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
              <NewSlotDialog
                services={services ?? []}
                weekStart={weekStart.toISOString()}
              />
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
          weekStart={weekStart.toISOString()}
          initialDayAnchor={initialDayAnchor.toISOString()}
          slots={slotDisplays}
          tzOffsetHours={TZ_OFFSET_HOURS}
          showMemberLabel={!viewingSelfOnly}
        />
      </Suspense>
    </div>
  )
}
