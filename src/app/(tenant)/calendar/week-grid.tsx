import { addDays, format } from 'date-fns'

type SlotDisplay = {
  id: string
  startAt: string
  endAt: string
  status: 'available' | 'pending' | 'booked' | 'cancelled'
  serviceName: string | null
}

const STATUS_BG: Record<SlotDisplay['status'], string> = {
  available: 'bg-blue-50 border-l-blue-500',
  pending: 'bg-amber-50 border-l-amber-500',
  booked: 'bg-emerald-50 border-l-emerald-500',
  cancelled: 'bg-slate-100 border-l-slate-400 opacity-60',
}

const HOURS = Array.from({ length: 14 }, (_, i) => i + 8) // 08:00 .. 21:00

function toLocal(iso: string, tzOffsetHours: number): Date {
  return new Date(new Date(iso).getTime() + tzOffsetHours * 3600 * 1000)
}

export default function WeekGrid({
  weekStart,
  slots,
  tzOffsetHours,
}: {
  weekStart: Date
  slots: SlotDisplay[]
  tzOffsetHours: number
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  // Group slots by local YYYY-MM-DD
  const slotsByDay: Record<string, SlotDisplay[]> = {}
  for (const s of slots) {
    const local = toLocal(s.startAt, tzOffsetHours)
    const key = local.toISOString().slice(0, 10)
    slotsByDay[key] = slotsByDay[key] ?? []
    slotsByDay[key].push(s)
  }

  return (
    <div className="overflow-x-auto rounded border bg-white">
      <div className="grid grid-cols-[60px_repeat(7,1fr)] gap-px bg-slate-200 text-xs">
        <div className="bg-white p-2" />
        {days.map((d) => (
          <div key={d.toISOString()} className="bg-white p-2 text-center font-medium">
            {format(d, 'EEE')}
            <br />
            {format(d, 'MM/dd')}
          </div>
        ))}
        {HOURS.map((h) => (
          <Row
            key={h}
            hour={h}
            days={days}
            slotsByDay={slotsByDay}
            tzOffsetHours={tzOffsetHours}
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
}: {
  hour: number
  days: Date[]
  slotsByDay: Record<string, SlotDisplay[]>
  tzOffsetHours: number
}) {
  return (
    <>
      <div className="bg-white p-2 text-right text-slate-500">
        {String(hour).padStart(2, '0')}:00
      </div>
      {days.map((d) => {
        const key = format(d, 'yyyy-MM-dd')
        const cellSlots = (slotsByDay[key] ?? []).filter((s) => {
          const local = toLocal(s.startAt, tzOffsetHours)
          return local.getUTCHours() === hour
        })
        return (
          <div key={key + hour} className="bg-white p-1 min-h-12">
            {cellSlots.map((s) => {
              const ls = toLocal(s.startAt, tzOffsetHours)
              const le = toLocal(s.endAt, tzOffsetHours)
              return (
                <div
                  key={s.id}
                  className={`text-[10px] px-1 py-0.5 border-l-2 rounded-sm mb-0.5 ${STATUS_BG[s.status]}`}
                  title={`${s.serviceName ?? ''} ${format(ls, 'HH:mm')}-${format(le, 'HH:mm')}`}
                >
                  {s.serviceName ?? '時段'}
                </div>
              )
            })}
          </div>
        )
      })}
    </>
  )
}
