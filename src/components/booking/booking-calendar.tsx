'use client'
import { addDays, format, isSameMonth, parseISO, startOfMonth, startOfWeek } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

export function BookingCalendar({
  monthAnchor,
  selected,
  dayCounts,
  minDate,
  onSelect,
  onPrevMonth,
  onNextMonth,
  onToday,
  className,
}: {
  /** yyyy-MM-dd inside the month being displayed. */
  monthAnchor: string
  /** Currently selected day (yyyy-MM-dd). */
  selected: string
  /** Map of yyyy-MM-dd → bookable count for the visible grid. `null` = loading. */
  dayCounts: Record<string, number> | null
  /** Earliest selectable day (yyyy-MM-dd); earlier days are disabled. */
  minDate: string
  onSelect: (date: string) => void
  onPrevMonth: () => void
  onNextMonth: () => void
  onToday: () => void
  className?: string
}) {
  const mStart = startOfMonth(parseISO(monthAnchor))
  const gridStart = startOfWeek(mStart, { weekStartsOn: 0 })
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
  const loading = dayCounts === null
  // Don't let the user page back into months entirely before the current one.
  const canGoPrev = format(mStart, 'yyyy-MM') > minDate.slice(0, 7)

  return (
    <div className={cn('select-none', className)}>
      {/* Month header */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-baseline gap-2.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            MONTH
          </span>
          <span className="font-display text-xl tabular-nums tracking-tight">
            {format(mStart, 'yyyy / MM')}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onToday}
            className="inline-flex h-8 items-center rounded-full border border-border bg-card px-3 font-mono text-xs font-medium hover:bg-muted"
          >
            今天
          </button>
          <button
            type="button"
            onClick={onPrevMonth}
            disabled={!canGoPrev}
            aria-label="上個月"
            className="grid size-8 place-items-center rounded-full border border-border bg-card hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={onNextMonth}
            aria-label="下個月"
            className="grid size-8 place-items-center rounded-full border border-border bg-card hover:bg-muted"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      {/* Weekday strip */}
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((w, i) => (
          <div
            key={w}
            className={cn(
              'pb-1 text-center font-mono text-[10px] uppercase tracking-[0.12em]',
              i === 0 || i === 6 ? 'text-muted-foreground/70' : 'text-muted-foreground',
            )}
          >
            {w}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d) => {
          const key = format(d, 'yyyy-MM-dd')
          const isOther = !isSameMonth(d, mStart)
          const isPast = key < minDate
          const isToday = key === minDate
          const count = dayCounts?.[key] ?? 0
          const hasSlots = count > 0
          // While counts load, only structural state (past / other month) disables.
          const disabled = isOther || isPast || (!loading && !hasSlots)
          const isSelected = key === selected && !isOther

          return (
            <button
              key={key}
              type="button"
              disabled={disabled}
              aria-pressed={isSelected}
              aria-label={`${key}${hasSlots ? ` · ${count} 個時段` : ''}`}
              onClick={() => onSelect(key)}
              className={cn(
                'relative flex aspect-square flex-col items-center justify-center rounded-xl border text-sm transition',
                isSelected
                  ? 'border-primary bg-primary text-primary-foreground'
                  : disabled
                    ? 'border-transparent text-muted-foreground/40'
                    : 'border-border bg-card hover:border-foreground/40',
                isOther && 'invisible',
              )}
            >
              <span
                className={cn(
                  'font-display tabular-nums leading-none',
                  isToday && !isSelected && 'text-accent-foreground',
                )}
              >
                {format(d, 'd')}
              </span>
              {isToday && !isSelected && (
                <span className="font-mono mt-0.5 text-[8px] uppercase tracking-[0.1em] text-muted-foreground">
                  今天
                </span>
              )}
              {/* Availability dot */}
              {hasSlots && !isSelected && (
                <span aria-hidden className="absolute bottom-1.5 size-1 rounded-full bg-accent" />
              )}
            </button>
          )
        })}
      </div>

      {loading && (
        <p className="font-cjk mt-3 text-center text-xs text-muted-foreground">載入可預約日期…</p>
      )}
    </div>
  )
}
