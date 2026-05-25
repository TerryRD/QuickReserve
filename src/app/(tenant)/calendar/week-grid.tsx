import { addDays, format } from 'date-fns'
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
  bookingCount: number
  maxCapacity: number
}

const STATUS_BG: Record<SlotDisplay['status'], string> = {
  available: 'bg-blue-50 border-l-blue-500 text-blue-900',
  pending: 'bg-amber-50 border-l-amber-500 text-amber-900',
  booked: 'bg-emerald-50 border-l-emerald-500 text-emerald-900',
  cancelled: 'bg-slate-100 border-l-slate-400 opacity-60 text-slate-600',
}

const HOURS = Array.from({ length: 14 }, (_, i) => i + 8)

function toLocal(iso: string, tzOffsetHours: number): Date {
  return new Date(new Date(iso).getTime() + tzOffsetHours * 3600 * 1000)
}

export default function WeekGrid({
  weekStart,
  slots,
  tzOffsetHours,
  showMemberLabel,
  daysCount = 7,
}: {
  weekStart: Date
  slots: SlotDisplay[]
  tzOffsetHours: number
  showMemberLabel: boolean
  daysCount?: number
}) {
  const days = Array.from({ length: daysCount }, (_, i) => addDays(weekStart, i))
  const gridCols =
    daysCount === 1
      ? 'grid-cols-[60px_1fr]'
      : daysCount === 7
        ? 'grid-cols-[60px_repeat(7,1fr)]'
        : `grid-cols-[60px_repeat(${daysCount},1fr)]`

  const slotsByDay: Record<string, SlotDisplay[]> = {}
  for (const s of slots) {
    const local = toLocal(s.startAt, tzOffsetHours)
    const key = local.toISOString().slice(0, 10)
    slotsByDay[key] = slotsByDay[key] ?? []
    slotsByDay[key].push(s)
  }

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <div className={`grid ${gridCols} gap-px bg-border text-xs`}>
        <div className="bg-card p-2" />
        {days.map((d) => (
          <div key={d.toISOString()} className="bg-card p-2 text-center font-medium">
            {format(d, 'EEE')}
            <br />
            <span className="text-muted-foreground">{format(d, 'MM/dd')}</span>
          </div>
        ))}
        {HOURS.map((h) => (
          <Row
            key={h}
            hour={h}
            days={days}
            slotsByDay={slotsByDay}
            tzOffsetHours={tzOffsetHours}
            showMemberLabel={showMemberLabel}
          />
        ))}
      </div>
    </div>
  )
}

function Row({
  hour,
  days,
  slotsByDay,
  tzOffsetHours,
  showMemberLabel,
}: {
  hour: number
  days: Date[]
  slotsByDay: Record<string, SlotDisplay[]>
  tzOffsetHours: number
  showMemberLabel: boolean
}) {
  return (
    <>
      <div className="bg-card p-2 text-right font-mono text-[10px] text-muted-foreground">
        {String(hour).padStart(2, '0')}:00
      </div>
      {days.map((d) => {
        const key = format(d, 'yyyy-MM-dd')
        const cellSlots = (slotsByDay[key] ?? []).filter((s) => {
          const local = toLocal(s.startAt, tzOffsetHours)
          return local.getUTCHours() === hour
        })
        return (
          <div key={key + hour} className="min-h-12 bg-card p-1">
            {cellSlots.map((s) => {
              const ls = toLocal(s.startAt, tzOffsetHours)
              const le = toLocal(s.endAt, tzOffsetHours)
              return (
                <SlotPopover
                  key={s.id}
                  slot={s}
                  timeLabel={`${format(ls, 'HH:mm')}-${format(le, 'HH:mm')}`}
                >
                  <button
                    type="button"
                    className={`group w-full rounded-sm border-l-2 px-1 py-0.5 text-left text-[10px] mb-0.5 transition hover:shadow-sm ${STATUS_BG[s.status]} ${!s.isOwn ? 'border-dashed opacity-90' : ''} ${s.conflictReason ? 'ring-1 ring-amber-400' : ''}`}
                  >
                    <div className="flex items-center gap-1">
                      {s.conflictReason && <span title={s.conflictReason}>⚠</span>}
                      {showMemberLabel && (
                        <span className="rounded bg-white/60 px-1 font-semibold">
                          {s.memberLabel}
                        </span>
                      )}
                      <span className="truncate">{s.serviceName ?? '時段'}</span>
                    </div>
                    <div className="opacity-70">{format(ls, 'HH:mm')}</div>
                    {s.maxCapacity > 1 && (
                      <div className="opacity-70 text-[9px]">
                        {s.bookingCount}/{s.maxCapacity}
                      </div>
                    )}
                  </button>
                </SlotPopover>
              )
            })}
          </div>
        )
      })}
    </>
  )
}
