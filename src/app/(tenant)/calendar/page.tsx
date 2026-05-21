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
  searchParams: Promise<{ week?: string }>
}) {
  const session = await requireTenantMember()
  const params = await searchParams
  const anchor = params.week ? parseISO(params.week) : new Date()
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
        <div className="flex gap-2">
          <RecurringRuleDialog services={services ?? []} />
          <NewSlotDialog services={services ?? []} weekStart={weekStart.toISOString()} />
        </div>
      </div>
      <div className="flex items-center gap-3 text-sm">
        <Link
          href={`/calendar?week=${prevWeek}`}
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          ◄
        </Link>
        <div className="min-w-48 text-center font-medium">
          {format(weekStart, 'yyyy/MM/dd')} – {format(weekEnd, 'MM/dd')}
        </div>
        <Link
          href={`/calendar?week=${nextWeek}`}
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
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
