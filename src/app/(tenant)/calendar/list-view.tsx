import { format } from 'date-fns'
import SlotPopover from './slot-popover'

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

const STATUS_BADGE: Record<SlotDisplay['status'], { label: string; cls: string }> = {
  available: { label: '可預約', cls: 'bg-blue-100 text-blue-800' },
  pending: { label: '待確認', cls: 'bg-amber-100 text-amber-800' },
  booked: { label: '已預約', cls: 'bg-emerald-100 text-emerald-800' },
  cancelled: { label: '已取消', cls: 'bg-slate-200 text-slate-600' },
}

function toLocal(iso: string, tzOffsetHours: number): Date {
  return new Date(new Date(iso).getTime() + tzOffsetHours * 3600 * 1000)
}

export default function CalendarListView({
  slots,
  tzOffsetHours,
  showMemberLabel,
}: {
  slots: SlotDisplay[]
  tzOffsetHours: number
  showMemberLabel: boolean
}) {
  if (slots.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-card p-10 text-center text-sm text-muted-foreground">
        本週尚無時段
      </div>
    )
  }

  // group by local date
  const byDay: Record<string, SlotDisplay[]> = {}
  for (const s of slots) {
    const key = format(toLocal(s.startAt, tzOffsetHours), 'yyyy-MM-dd')
    byDay[key] = byDay[key] ?? []
    byDay[key].push(s)
  }
  const sortedKeys = Object.keys(byDay).sort()

  return (
    <div className="space-y-4">
      {sortedKeys.map((key) => {
        const list = byDay[key]!.slice().sort((a, b) => a.startAt.localeCompare(b.startAt))
        const date = new Date(key + 'T00:00:00')
        return (
          <section key={key} className="rounded-xl border bg-card">
            <header className="border-b bg-muted/30 px-4 py-2">
              <div className="text-sm font-semibold">
                {format(date, 'M/d')}{' '}
                <span className="text-xs font-normal text-muted-foreground">
                  {format(date, 'EEEE')}
                </span>
              </div>
            </header>
            <ul className="divide-y">
              {list.map((s) => {
                const ls = toLocal(s.startAt, tzOffsetHours)
                const le = toLocal(s.endAt, tzOffsetHours)
                const timeLabel = `${format(ls, 'HH:mm')}-${format(le, 'HH:mm')}`
                const badge = STATUS_BADGE[s.status]
                return (
                  <SlotPopover key={s.id} slot={s} timeLabel={timeLabel}>
                    <li className={`flex cursor-pointer items-center gap-3 px-4 py-2.5 transition hover:bg-muted/30 ${s.conflictReason ? 'bg-amber-50/40' : ''}`}>
                      <div className="w-24 font-mono text-xs text-muted-foreground">
                        {timeLabel}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1 truncate text-sm font-medium">
                          {s.conflictReason && <span title={s.conflictReason}>⚠</span>}
                          {s.serviceName ?? '時段'}
                        </div>
                        {(showMemberLabel || s.customerName) && (
                          <div className="mt-0.5 truncate text-xs text-muted-foreground">
                            {showMemberLabel && <span>{s.memberLabel}</span>}
                            {showMemberLabel && s.customerName && <span> · </span>}
                            {s.customerName && <span>學員：{s.customerName}</span>}
                          </div>
                        )}
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.cls}`}
                      >
                        {badge.label}
                      </span>
                    </li>
                  </SlotPopover>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
