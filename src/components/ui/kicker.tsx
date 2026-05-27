import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Kicker({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground',
        className,
      )}
    >
      {children}
    </div>
  )
}
