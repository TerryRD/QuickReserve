import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Props = {
  kicker?: string
  title?: string
  eng?: string
  hint?: string
  right?: ReactNode
  className?: string
}

export function SectionHead({ kicker, title, eng, hint, right, className }: Props) {
  return (
    <div
      className={cn(
        'mb-6 flex flex-wrap items-end justify-between gap-4',
        className,
      )}
    >
      <div>
        {kicker && (
          <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {kicker}
          </div>
        )}
        {(title || eng) && (
          <h2 className="font-display flex flex-wrap items-baseline gap-3.5 text-[42px] font-normal uppercase leading-[0.95] tracking-tight">
            {title && <span className="font-cjk">{title}</span>}
            {eng && (
              <span className="relative inline-block">
                {eng}
                <span
                  aria-hidden
                  className="absolute inset-x-0 -bottom-0.5 h-1.5 rounded-md bg-accent"
                />
              </span>
            )}
          </h2>
        )}
        {hint && (
          <div className="font-cjk mt-3 text-[13px] text-muted-foreground">
            {hint}
          </div>
        )}
      </div>
      {right}
    </div>
  )
}
