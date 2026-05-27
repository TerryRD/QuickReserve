'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import {
  addDays,
  differenceInDays,
  endOfMonth,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { cn } from '@/lib/utils'

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

function toLocal(iso: string, tzOffsetHours: number): Date {
  return new Date(new Date(iso).getTime() + tzOffsetHours * 3600 * 1000)
}

export default function MonthView({
  monthAnchor,
  slots,
  tzOffsetHours,
}: {
  /** ISO date string anchoring the month being shown (e.g. first day of that month). */
  monthAnchor: string
  slots: SlotDisplay[]
  tzOffsetHours: number
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const anchor = parseISO(monthAnchor)
  const mStart = startOfMonth(anchor)
  const mEnd = endOfMonth(anchor)
  // Calendar grid starts on Sunday to match the mockup.
  const gridStart = startOfWeek(mStart, { weekStartsOn: 0 })
  // Always render 6 rows × 7 cols so the grid height is consistent.
  const totalCells = 42
  const cells: Date[] = Array.from({ length: totalCells }, (_, i) => addDays(gridStart, i))

  // Count slots per local day + flag conflict days.
  const countByDate = new Map<string, number>()
  const conflictDates = new Set<string>()
  for (const s of slots) {
    const k = format(toLocal(s.startAt, tzOffsetHours), 'yyyy-MM-dd')
    countByDate.set(k, (countByDate.get(k) ?? 0) + 1)
    if (s.conflictReason) conflictDates.add(k)
  }

  const todayKey = format(toLocal(new Date().toISOString(), tzOffsetHours), 'yyyy-MM-dd')

  const monthLabel = format(mStart, 'yyyy / MM')
  const daysInMonth = differenceInDays(mEnd, mStart) + 1
  const monthSlotCount = Array.from(countByDate.entries()).reduce(
    (sum, [k, n]) => (k >= format(mStart, 'yyyy-MM-dd') && k <= format(mEnd, 'yyyy-MM-dd') ? sum + n : sum),
    0,
  )

  function navigateToDay(dateKey: string) {
    // Clicking a day jumps to the list view scoped to that week, with date query.
    const usp = new URLSearchParams(searchParams.toString())
    usp.set('view', 'list')
    usp.set('week', dateKey)
    router.push(`/calendar?${usp.toString()}`)
  }

  const weekdays = ['日', '一', '二', '三', '四', '五', '六']

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      {/* Month header — mono kicker + slot summary. */}
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border bg-muted/30 px-4 py-3">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            MONTH
          </span>
          <span className="font-display text-lg tabular-nums">{monthLabel}</span>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
          {daysInMonth} 天 · {monthSlotCount} 個時段
        </span>
      </div>

      {/* Weekday strip. */}
      <div className="grid grid-cols-7 border-b border-border bg-muted/20">
        {weekdays.map((w, i) => (
          <div
            key={w}
            className={cn(
              'px-2 py-2 font-mono text-[10px] uppercase tracking-[0.15em] text-center',
              i === 0 || i === 6 ? 'text-muted-foreground' : 'text-foreground',
            )}
          >
            {w}
          </div>
        ))}
      </div>

      {/* Day cells. */}
      <div className="grid grid-cols-7">
        {cells.map((d, i) => {
          const key = format(d, 'yyyy-MM-dd')
          const count = countByDate.get(key) ?? 0
          const isOther = !isSameMonth(d, mStart)
          const isToday = key === todayKey
          const hasConflict = conflictDates.has(key)
          const dow = i % 7
          const row = Math.floor(i / 7)
          const isLastRow = row === 5
          return (
            <button
              type="button"
              key={key + i}
              onClick={() => !isOther && count > 0 && navigateToDay(key)}
              disabled={isOther || count === 0}
              className={cn(
                'group relative flex min-h-[88px] flex-col items-stretch gap-1.5 p-2 text-left transition',
                dow < 6 && 'border-r border-border',
                !isLastRow && 'border-b border-border',
                isOther && 'bg-muted/40 opacity-50',
                !isOther && count > 0 && 'cursor-pointer hover:bg-muted/40',
                !isOther && count === 0 && 'cursor-default',
              )}
              aria-label={`${format(d, 'yyyy-MM-dd')} — ${count} 個時段`}
            >
              {/* Date row */}
              <div className="flex items-center justify-between">
                {isToday ? (
                  <span className="inline-flex size-6 items-center justify-center rounded-full bg-accent text-accent-foreground">
                    <span className="font-display text-xs font-bold tabular-nums">
                      {format(d, 'd')}
                    </span>
                  </span>
                ) : (
                  <span
                    className={cn(
                      'font-display text-sm tabular-nums',
                      isOther && 'text-muted-foreground',
                    )}
                  >
                    {format(d, 'd')}
                  </span>
                )}
                {hasConflict && !isOther && (
                  <span
                    aria-hidden
                    className="font-mono text-[10px] font-bold text-destructive"
                    title="此日有時段與不可用事件衝突"
                  >
                    ⚠
                  </span>
                )}
              </div>

              {/* Slot indicator bars (up to 3) */}
              {!isOther && count > 0 && (
                <div className="flex flex-col gap-1">
                  {Array.from({ length: Math.min(count, 3) }).map((_, j) => (
                    <div
                      key={j}
                      className={cn(
                        'h-1 rounded-sm',
                        j === 0 ? 'bg-foreground' : 'bg-muted-foreground/40',
                      )}
                    />
                  ))}
                  {count > 3 && (
                    <span className="font-mono text-[9px] tracking-wider text-muted-foreground">
                      +{count - 3}
                    </span>
                  )}
                </div>
              )}

              {/* Count label */}
              {!isOther && (
                <span
                  className={cn(
                    'mt-auto font-mono text-[10px] tracking-[0.05em]',
                    count > 0 ? 'text-muted-foreground' : 'text-muted-foreground/50',
                  )}
                >
                  {count > 0 ? `${count} 堂` : '—'}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
