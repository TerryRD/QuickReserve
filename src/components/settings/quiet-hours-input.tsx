'use client'
import { cn } from '@/lib/utils'

export function QuietHoursInput({
  start,
  end,
  onChange,
  className,
}: {
  start: string | null
  end: string | null
  onChange: (next: { start: string | null; end: string | null }) => void
  className?: string
}) {
  const enabled = start !== null && end !== null
  return (
    <div className={cn('rounded-2xl border border-border bg-card p-5', className)}>
      <label className="flex items-center gap-2 font-cjk text-sm font-semibold">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) =>
            onChange(
              e.target.checked
                ? { start: '22:00', end: '07:00' }
                : { start: null, end: null },
            )
          }
          className="size-4 accent-foreground"
        />
        勿擾時段
      </label>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          type="time"
          value={start ?? ''}
          disabled={!enabled}
          onChange={(e) => onChange({ start: e.target.value, end })}
          className="font-mono rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-40"
        />
        <span className="font-mono text-xs text-muted-foreground">至</span>
        <input
          type="time"
          value={end ?? ''}
          disabled={!enabled}
          onChange={(e) => onChange({ start, end: e.target.value })}
          className="font-mono rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-40"
        />
      </div>
      <p className="font-cjk mt-3 text-xs text-muted-foreground">
        勿擾時段內推播會延後到結束時段後發送。跨午夜時段(例: 22:00 → 07:00)會正確處理。
      </p>
    </div>
  )
}
