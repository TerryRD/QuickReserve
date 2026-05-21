import Link from 'next/link'
import {
  addDays,
  addWeeks,
  endOfDay,
  endOfWeek,
  format,
  parseISO,
  startOfDay,
  startOfWeek,
  subDays,
  subWeeks,
} from 'date-fns'
import { requireTenantMember } from '@/lib/auth/get-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { buttonVariants } from '@/components/ui/button'
import WeekGrid from './week-grid'
import NewSlotDialog from './new-slot-dialog'
import RecurringRuleDialog from './recurring-rule-dialog'
import MemberFilter from './member-filter'
import ViewTabs from './view-tabs'
import CalendarListView from './list-view'

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
  const view: View =
    params.view === 'day' || params.view === 'list' ? params.view : 'week'

  // Anchor & range:
  // week / list: full week
  // day: a single day (defaults to today)
  const dayAnchor = params.date ? parseISO(params.date) : new Date()
  const weekAnchor = params.week ? parseISO(params.week) : new Date()
  const weekStart = startOfWeek(weekAnchor, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(weekAnchor, { weekStartsOn: 1 })

  const rangeStart = view === 'day' ? startOfDay(dayAnchor) : weekStart
  const rangeEnd = view === 'day' ? endOfDay(dayAnchor) : weekEnd

  const supabase = await createSupabaseServerClient()

  // Owner sees all members; Staff sees only self
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
    .select('id, start_at, end_at, status, member_id, service_id, services(name)')
    .in('member_id', effectiveIds)
    .gte('start_at', rangeStart.toISOString())
    .lte('start_at', rangeEnd.toISOString())
    .order('start_at')

  const slotIds = (slots ?? []).filter((s) => s.status !== 'available').map((s) => s.id)
  const bookingsBySlot: Record<
    string,
    { id: string; status: string; customerName: string | null } | undefined
  > = {}
  if (slotIds.length) {
    const { data: bks } = await supabase
      .from('bookings')
      .select('id, slot_id, status, customers(display_name)')
      .in('slot_id', slotIds)
      .neq('status', 'cancelled')
    for (const b of bks ?? []) {
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

  // Nav links
  const memberQs = params.members ? `&members=${params.members}` : ''
  const viewQs = view !== 'week' ? `&view=${view}` : ''

  // For week/list mode use week-based prev/next; for day use day-based
  const prevWeek = format(subWeeks(weekStart, 1), 'yyyy-MM-dd')
  const nextWeek = format(addWeeks(weekStart, 1), 'yyyy-MM-dd')
  const prevDay = format(subDays(dayAnchor, 1), 'yyyy-MM-dd')
  const nextDay = format(addDays(dayAnchor, 1), 'yyyy-MM-dd')

  const navPrevHref =
    view === 'day'
      ? `/calendar?view=day&date=${prevDay}${memberQs}`
      : `/calendar?week=${prevWeek}${memberQs}${viewQs}`
  const navNextHref =
    view === 'day'
      ? `/calendar?view=day&date=${nextDay}${memberQs}`
      : `/calendar?week=${nextWeek}${memberQs}${viewQs}`
  const navTodayHref =
    view === 'day'
      ? `/calendar?view=day${memberQs}`
      : `/calendar${memberQs ? `?${memberQs.slice(1)}${viewQs}` : viewQs ? `?${viewQs.slice(1)}` : ''}`

  const navLabel =
    view === 'day'
      ? format(dayAnchor, 'yyyy/MM/dd (EEEE)')
      : `${format(weekStart, 'yyyy/MM/dd')} – ${format(weekEnd, 'MM/dd')}`

  // Build view-tabs query (preserving current week / members / date)
  const tabQuery = new URLSearchParams()
  if (params.week) tabQuery.set('week', params.week)
  if (params.members) tabQuery.set('members', params.members)
  if (view === 'day' && params.date) tabQuery.set('date', params.date)

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-3xl tracking-tight">
          <span className="italic">行事曆</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {viewingSelfOnly
            ? '檢視您的時段'
            : `檢視 ${effectiveIds.length} 位成員的時段`}
        </p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <ViewTabs current={view} query={tabQuery.toString()} />
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
            <div className="min-w-44 text-center font-medium">{navLabel}</div>
            <Link
              href={navTodayHref}
              className={buttonVariants({ variant: 'ghost', size: 'sm' })}
            >
              {view === 'day' ? '今天' : '本週'}
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
            <span className="self-center rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
              多成員視圖（只能編輯自己的時段）
            </span>
          )}
        </div>
      </div>

      {(() => {
        const slotDisplays = (slots ?? []).map((s) => {
          const member = allMembers.find((m) => m.id === s.member_id)
          const booking = bookingsBySlot[s.id]
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
          }
        })

        if (view === 'list') {
          return (
            <CalendarListView
              slots={slotDisplays}
              tzOffsetHours={TZ_OFFSET_HOURS}
              showMemberLabel={!viewingSelfOnly}
            />
          )
        }

        // week (full 7 days) or day (single-day filter applied via query range)
        return (
          <WeekGrid
            weekStart={view === 'day' ? startOfDay(dayAnchor) : weekStart}
            slots={slotDisplays}
            tzOffsetHours={TZ_OFFSET_HOURS}
            showMemberLabel={!viewingSelfOnly}
            daysCount={view === 'day' ? 1 : 7}
          />
        )
      })()}
    </div>
  )
}
