'use client'

import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Badge, StatusBadge, type StatusType } from '@/components/ui/badge'
import { Kicker } from '@/components/ui/kicker'
import BlockButton from './block-button'

export type CustomerRowData = {
  customerId: string
  displayName: string
  phone: string | null
  isBlocked: boolean
  totalBookings: number
  remainingClasses: number
  lastSeenLabel: string | null
}

export type DrawerBooking = {
  id: string
  serviceName: string
  startAtLabel: string | null
  status: StatusType
}

export type DrawerPackage = {
  id: string
  name: string
  remaining: number
  total: number
  expiresLabel: string
}

export type CustomerDrawerData = {
  bookings: DrawerBooking[]
  packages: DrawerPackage[]
}

export default function CustomerRow({
  row,
  drawer,
}: {
  row: CustomerRowData
  drawer: CustomerDrawerData
}) {
  const [open, setOpen] = useState(false)
  const initial = row.displayName.trim().slice(0, 1) || '?'

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`group flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition sm:gap-4 sm:px-5 sm:py-4 ${
          row.isBlocked
            ? 'border-border bg-card opacity-70'
            : 'border-border bg-card hover:border-foreground/40 hover:bg-secondary/40'
        }`}
      >
        <div
          className={`grid size-10 shrink-0 place-items-center rounded-full font-display text-base font-black sm:size-11 ${
            row.isBlocked
              ? 'bg-muted text-muted-foreground'
              : 'bg-secondary text-foreground'
          }`}
        >
          {initial}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="font-cjk truncate text-sm font-bold sm:text-[15px]">
              {row.displayName}
            </span>
            {row.isBlocked && (
              <Badge variant="outline" className="shrink-0">
                已封鎖
              </Badge>
            )}
          </div>
          <div className="font-mono mt-1 truncate text-[11px] text-muted-foreground sm:text-xs">
            {row.phone ?? '—'}
          </div>
        </div>

        <div className="hidden text-right sm:block min-w-[60px]">
          <div className="font-display text-lg leading-none tabular-nums">
            {row.totalBookings}
          </div>
          <div className="font-mono mt-1 text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
            BOOKINGS
          </div>
        </div>

        <div className="hidden text-right sm:block min-w-[70px]">
          <div className="flex items-baseline justify-end gap-0.5">
            <span
              className={`font-display text-lg leading-none tabular-nums ${
                row.remainingClasses > 0
                  ? 'text-foreground'
                  : 'text-muted-foreground'
              }`}
            >
              {row.remainingClasses}
            </span>
            <span className="font-cjk text-[11px] text-muted-foreground">
              堂
            </span>
          </div>
          <div className="font-mono mt-1 text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
            BALANCE
          </div>
        </div>

        <div className="hidden text-right lg:block min-w-[88px]">
          <div className="font-mono text-xs tabular-nums">
            {row.lastSeenLabel ?? '—'}
          </div>
          <div className="font-mono mt-1 text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
            LAST SEEN
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 text-right sm:hidden">
          <span className="font-display text-base leading-none">
            {row.totalBookings}
          </span>
          <span className="font-mono text-[10px] text-muted-foreground">
            {row.remainingClasses} 堂
          </span>
        </div>

        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
      </button>

      <SheetContent
        side="right"
        className="w-full overflow-y-auto sm:max-w-md"
      >
        <SheetHeader className="border-b border-border">
          <Kicker>CUSTOMER · 學員資訊</Kicker>
          <SheetTitle className="font-display font-cjk mt-1 text-2xl font-black">
            {row.displayName}
          </SheetTitle>
          <div className="font-mono mt-1 text-xs text-muted-foreground">
            {row.phone ?? '—'}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant="outline">{row.totalBookings} 次預約</Badge>
            <Badge variant="outline">{row.remainingClasses} 堂可用</Badge>
            {row.isBlocked && <Badge variant="outline">已封鎖</Badge>}
          </div>
        </SheetHeader>

        <div className="space-y-6 px-4 pb-4">
          <section className="space-y-2">
            <Kicker>PACKAGES · 套裝餘額</Kicker>
            {drawer.packages.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-muted/40 p-4 font-cjk text-xs text-muted-foreground">
                尚無有效套裝
              </div>
            ) : (
              drawer.packages.map((p) => {
                const pct =
                  p.total > 0
                    ? Math.max(
                        0,
                        Math.min(100, Math.round((p.remaining / p.total) * 100)),
                      )
                    : 0
                return (
                  <div
                    key={p.id}
                    className="rounded-xl border border-border bg-card p-3"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-cjk truncate text-sm font-semibold">
                        {p.name}
                      </span>
                      <span className="font-display text-lg tabular-nums">
                        {p.remaining}
                        <span className="font-mono text-xs text-muted-foreground">
                          /{p.total}
                        </span>
                      </span>
                    </div>
                    <div className="font-mono mt-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      EXP · {p.expiresLabel}
                    </div>
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-foreground"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })
            )}
          </section>

          <section className="space-y-2">
            <Kicker>BOOKINGS · 近期預約</Kicker>
            {drawer.bookings.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-muted/40 p-4 font-cjk text-xs text-muted-foreground">
                尚無預約紀錄
              </div>
            ) : (
              drawer.bookings.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3"
                >
                  <div className="min-w-0">
                    <div className="font-mono text-xs tabular-nums">
                      {b.startAtLabel ?? '—'}
                    </div>
                    <div className="font-cjk mt-0.5 truncate text-xs text-muted-foreground">
                      {b.serviceName}
                    </div>
                  </div>
                  <StatusBadge status={b.status} />
                </div>
              ))
            )}
          </section>

          <section className="space-y-2 border-t border-border pt-4">
            <Kicker>ACTIONS · 操作</Kicker>
            <div className="flex justify-start">
              <BlockButton
                customerId={row.customerId}
                isBlocked={row.isBlocked}
              />
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  )
}
