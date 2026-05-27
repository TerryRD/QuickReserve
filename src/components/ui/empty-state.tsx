import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function EmptyState({
  icon,
  title,
  hint,
  cta,
  className,
}: {
  icon: ReactNode
  title: string
  hint?: string
  cta?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-2xl border-[1.5px] border-dashed border-border bg-muted/40 p-10 text-center',
        className,
      )}
    >
      <div className="grid size-12 place-items-center rounded-full bg-secondary text-muted-foreground">
        {icon}
      </div>
      <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        {title}
      </div>
      {hint && <p className="font-cjk text-sm text-muted-foreground">{hint}</p>}
      {cta && <div className="mt-2">{cta}</div>}
    </div>
  )
}
