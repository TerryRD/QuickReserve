import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function AppShell({
  title,
  kicker,
  subnav,
  actions,
  children,
  className,
}: {
  title: string
  kicker?: string
  subnav?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('space-y-7', className)}>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          {kicker && (
            <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {kicker}
            </div>
          )}
          <h1 className="font-display text-3xl uppercase leading-tight tracking-tight sm:text-4xl">
            <span className="font-cjk">{title}</span>
          </h1>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </header>
      {subnav && <div>{subnav}</div>}
      <div>{children}</div>
    </div>
  )
}
