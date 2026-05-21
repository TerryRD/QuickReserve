import Link from 'next/link'
import { addWeeks, endOfWeek, format, parseISO, startOfWeek, subWeeks } from 'date-fns'
import { requireTenantMember } from '@/lib/auth/get-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { buttonVariants } from '@/components/ui/button'
import WeekGrid from './week-grid'
import NewSlotDialog from './new-slot-dialog'
import RecurringRuleDialog from './recurring-rule-dialog'

const TZ_OFFSET_HOURS = 8 // Asia/Taipei (single-tz MVP)

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; member?: string }>
}) {
  const session = await requireTenantMember()
  const params = await searchParams
  const anchor = params.week ? parseISO(params.week) : new Date()
  const weekStart = startOfWeek(anchor, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(anchor, { weekStartsOn: 1 })

  const supabase = await createSupabaseServerClient()

  // Owner-only: can view any tenant member's calendar. Staff: locked to own.
  const targetMemberId =
    session.role === 'tenant_owner' && params.member ? params.member : session.memberId

  const { data: slots } = await supabase
    .from('availability_slots')
    .select('id, start_at, end_at, status, service_id, services(name)')
    .eq('member_id', targetMemberId)
    .gte('start_at', weekStart.toISOString())
    .lte('start_at', weekEnd.toISOString())
    .order('start_at')

  const { data: services } = await supabase
    .from('services')
    .select('id, name, duration_minutes')
    .eq('is_active', true)
    .order('name')

  // Owner sees all members for the dropdown
  let members:
    | Array<{ id: string; role: string; invited_email: string | null; user_id: string | null }>
    | null = null
  if (session.role === 'tenant_owner') {
    const { data } = await supabase
      .from('tenant_members')
      .select('id, role, invited_email, user_id')
      .eq('tenant_id', session.tenantId)
      .eq('status', 'active')
      .order('role') // owners first
    members = data
  }

  const prevWeek = format(subWeeks(weekStart, 1), 'yyyy-MM-dd')
  const nextWeek = format(addWeeks(weekStart, 1), 'yyyy-MM-dd')
  const viewingSelf = targetMemberId === session.memberId

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">行事曆</h1>
        <div className="flex gap-2">
          {viewingSelf && (
            <>
              <RecurringRuleDialog services={services ?? []} />
              <NewSlotDialog services={services ?? []} weekStart={weekStart.toISOString()} />
            </>
          )}
        </div>
      </div>

      {members && members.length > 1 && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">檢視成員：</span>
          {members.map((m) => {
            const label = m.role === 'owner' ? 'Owner' : (m.invited_email ?? 'Staff')
            const isActive = m.id === targetMemberId
            const href = `/calendar?member=${m.id}${params.week ? `&week=${params.week}` : ''}`
            return (
              <Link
                key={m.id}
                href={href}
                className={`rounded border px-3 py-1 ${
                  isActive
                    ? 'border-blue-500 bg-blue-50 font-medium'
                    : 'border-slate-200 bg-white text-slate-600'
                }`}
              >
                {label}
                {m.role === 'owner' ? '' : ' (Staff)'}
              </Link>
            )
          })}
        </div>
      )}

      <div className="flex items-center gap-3 text-sm">
        <Link
          href={`/calendar?week=${prevWeek}${!viewingSelf ? `&member=${targetMemberId}` : ''}`}
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          ◄
        </Link>
        <div className="min-w-48 text-center font-medium">
          {format(weekStart, 'yyyy/MM/dd')} – {format(weekEnd, 'MM/dd')}
        </div>
        <Link
          href={`/calendar?week=${nextWeek}${!viewingSelf ? `&member=${targetMemberId}` : ''}`}
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          ►
        </Link>
        <Link
          href={!viewingSelf ? `/calendar?member=${targetMemberId}` : '/calendar'}
          className={buttonVariants({ variant: 'ghost', size: 'sm' })}
        >
          回本週
        </Link>
        {!viewingSelf && (
          <span className="ml-auto rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
            檢視他人行事曆（唯讀）
          </span>
        )}
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
