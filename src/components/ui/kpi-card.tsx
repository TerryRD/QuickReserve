import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function KpiCard({
  label,
  value,
  unit,
  hint,
  icon,
  accent,
  className,
}: {
  label: string
  value: number | string
  unit?: string
  hint?: string
  icon?: ReactNode
  accent?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border bg-card p-5 shadow-[0_8px_24px_-18px_rgba(0,0,0,0.18)]',
        accent ? 'border-accent' : 'border-border',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.15em] text-muted-foreground">
          {label}
        </div>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="font-display text-4xl leading-none">{value}</span>
        {unit && (
          <span className="font-cjk text-sm text-muted-foreground">{unit}</span>
        )}
      </div>
      {hint && (
        <div className="font-cjk mt-2 text-xs text-muted-foreground">
          {hint}
        </div>
      )}
    </div>
  )
}
