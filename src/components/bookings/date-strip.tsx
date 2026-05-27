import { cn } from '@/lib/utils'

export type DateStripGroup = 'today' | 'thisWeek' | 'later' | 'past'

const LABELS: Record<DateStripGroup, { cn: string; eng: string }> = {
  today: { cn: '今日', eng: 'TODAY' },
  thisWeek: { cn: '本週', eng: 'THIS WEEK' },
  later: { cn: '之後', eng: 'LATER' },
  past: { cn: '已過', eng: 'PAST' },
}

export function DateStrip({
  groupKey,
  count,
  className,
}: {
  groupKey: DateStripGroup
  count: number
  className?: string
}) {
  const { cn: label, eng } = LABELS[groupKey]
  return (
    <div
      className={cn(
        'flex items-baseline justify-between border-b border-border pb-2',
        className,
      )}
    >
      <div className="flex items-baseline gap-3">
        <span className="font-display font-cjk text-xl font-black uppercase">{label}</span>
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          {eng}
        </span>
      </div>
      <span className="font-mono text-[11px] tracking-[0.12em] text-muted-foreground">
        {count}
      </span>
    </div>
  )
}
