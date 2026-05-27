import Link from 'next/link'
import { Calendar, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export function RescheduleBanner({
  originalSlotLabel,
  serviceName,
  exitHref,
  className,
}: {
  originalSlotLabel: string
  serviceName: string
  exitHref: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-accent bg-accent/30 p-5 sm:items-center',
        className,
      )}
    >
      <div className="flex items-start gap-3 sm:items-center">
        <Calendar className="mt-0.5 size-5 shrink-0 text-foreground sm:mt-0" aria-hidden />
        <div className="space-y-1">
          <div className="font-cjk text-sm font-semibold">
            改期模式 · 選擇新時段後原預約自動取消
          </div>
          <div className="font-cjk text-xs text-muted-foreground">
            正在改期:<span className="font-mono mx-1">{originalSlotLabel}</span> · {serviceName}
          </div>
        </div>
      </div>
      <Link
        href={exitHref}
        className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
      >
        退出改期 <X className="size-3" />
      </Link>
    </div>
  )
}
