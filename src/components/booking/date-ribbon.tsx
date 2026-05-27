'use client'
import { format, parseISO } from 'date-fns'
import { cn } from '@/lib/utils'

export function DateRibbon({
  dates,
  selected,
  onSelect,
  slotCountByDate,
  className,
}: {
  dates: string[]
  selected: string
  onSelect: (date: string) => void
  slotCountByDate: Record<string, number>
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
    >
      {dates.map((d) => {
        const dt = parseISO(d)
        const isSelected = d === selected
        const hasCount = Object.prototype.hasOwnProperty.call(slotCountByDate, d)
        const count = slotCountByDate[d] ?? 0
        const disabled = hasCount && count === 0
        return (
          <button
            key={d}
            type="button"
            aria-pressed={isSelected}
            disabled={disabled}
            onClick={() => onSelect(d)}
            className={cn(
              'group flex min-w-[68px] shrink-0 flex-col items-center gap-1 rounded-2xl border px-3 py-3 transition',
              isSelected
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-foreground hover:border-foreground/40',
              disabled && 'opacity-40 cursor-not-allowed',
            )}
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] opacity-70">
              {format(dt, 'EEE')}
            </span>
            <span className="font-display text-2xl leading-none">
              {format(dt, 'd')}
            </span>
            {count > 0 && (
              <span
                className={cn(
                  'font-mono text-[10px] tracking-wider',
                  isSelected ? 'opacity-80' : 'text-muted-foreground',
                )}
              >
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
