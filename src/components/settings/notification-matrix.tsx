'use client'
import { cn } from '@/lib/utils'

export type NotificationChannel = 'web_push' | 'in_app'
export type NotificationPrefs = Record<NotificationChannel, Record<string, boolean>>

const CHANNELS: { key: NotificationChannel; label: string; eng: string }[] = [
  { key: 'web_push', label: '推播', eng: 'WEB PUSH' },
  { key: 'in_app', label: '站內', eng: 'IN-APP' },
]

export function NotificationMatrix({
  events,
  prefs,
  onToggle,
  className,
}: {
  events: { key: string; label: string }[]
  prefs: NotificationPrefs
  onToggle: (channel: NotificationChannel, eventKey: string, next: boolean) => void
  className?: string
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border border-border bg-card',
        className,
      )}
    >
      <div className="grid grid-cols-[1fr_minmax(80px,auto)_minmax(80px,auto)] gap-x-4 px-5 py-3 border-b border-border">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          EVENT
        </span>
        {CHANNELS.map((c) => (
          <div key={c.key} className="text-center">
            <div className="font-cjk text-xs font-semibold">{c.label}</div>
            <div className="font-mono text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
              {c.eng}
            </div>
          </div>
        ))}
      </div>
      {events.map((ev, i) => (
        <div
          key={ev.key}
          className={cn(
            'grid grid-cols-[1fr_minmax(80px,auto)_minmax(80px,auto)] items-center gap-x-4 px-5 py-3',
            i < events.length - 1 && 'border-b border-border',
          )}
        >
          <span className="font-cjk text-sm">{ev.label}</span>
          {CHANNELS.map((c) => (
            <label key={c.key} className="flex justify-center">
              <input
                type="checkbox"
                checked={Boolean(prefs[c.key]?.[ev.key])}
                onChange={(e) => onToggle(c.key, ev.key, e.target.checked)}
                className="size-4 accent-foreground"
              />
            </label>
          ))}
        </div>
      ))}
    </div>
  )
}
