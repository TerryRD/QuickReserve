'use client'

import { cn } from '@/lib/utils'

type View = 'week' | 'list' | 'month'

export default function ViewTabs({
  current,
  onChange,
}: {
  current: View
  onChange: (next: View) => void
}) {
  const items: Array<{ value: View; label: string; eng: string }> = [
    { value: 'week', label: '週', eng: 'WEEK' },
    { value: 'list', label: '列表', eng: 'LIST' },
    { value: 'month', label: '月', eng: 'MONTH' },
  ]
  return (
    <div className="inline-flex items-center gap-0.5 rounded-full border border-border bg-card p-1">
      {items.map((it) => {
        const active = current === it.value
        return (
          <button
            type="button"
            key={it.value}
            onClick={() => onChange(it.value)}
            className={cn(
              'group inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition',
              active
                ? 'bg-foreground text-background font-semibold'
                : 'text-muted-foreground hover:bg-muted',
            )}
            aria-pressed={active}
          >
            <span className="font-cjk">{it.label}</span>
            <span className="font-mono text-[9px] uppercase tracking-wider opacity-70">
              {it.eng}
            </span>
          </button>
        )
      })}
    </div>
  )
}
