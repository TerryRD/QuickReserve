'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { addDays, format, parseISO, startOfDay } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { DateRibbon } from '@/components/booking/date-ribbon'
import { TimeChip } from '@/components/booking/time-chip'
import { Button } from '@/components/ui/button'

type Slot = {
  id: string
  start_at: string
  end_at: string
  max_capacity: number
  current_bookings: number
}

type SlotPickerProps = {
  tenantSlug: string
  tenantId: string
  serviceId: string
  serviceName: string
  serviceDuration: number
  servicePrice: number
  initialDate: string
  fromOffset: number
  rescheduleFrom: string | null
}

const TZ_OFFSET_HOURS = 8
const toLocal = (iso: string) => new Date(new Date(iso).getTime() + TZ_OFFSET_HOURS * 3600 * 1000)

export default function SlotPicker({
  tenantSlug,
  tenantId,
  serviceId,
  serviceName,
  serviceDuration,
  servicePrice,
  initialDate,
  fromOffset,
  rescheduleFrom,
}: SlotPickerProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [date, setDate] = useState(initialDate)
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null)
  const [slots, setSlots] = useState<Slot[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const today = startOfDay(new Date())
  const stripStart = addDays(today, fromOffset)
  const days = useMemo(
    () => Array.from({ length: 14 }, (_, i) => format(addDays(stripStart, i), 'yyyy-MM-dd')),
    [stripStart],
  )

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setSelectedSlotId(null)
    const usp = new URLSearchParams({ tenantId, serviceId, date })
    fetch(`/api/public/slots?${usp.toString()}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<{ slots: Slot[] }>
      })
      .then(({ slots }) => {
        if (cancelled) return
        setSlots(slots)
        setLoading(false)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : '載入失敗')
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [tenantId, serviceId, date])

  function selectDate(next: string) {
    setDate(next)
    const usp = new URLSearchParams(searchParams.toString())
    usp.set('service', serviceId)
    usp.set('date', next)
    router.replace(`/${tenantSlug}?${usp.toString()}`, { scroll: false })
  }

  const selectedSlot = useMemo(
    () => slots?.find((s) => s.id === selectedSlotId) ?? null,
    [slots, selectedSlotId],
  )

  const slotCountByDate: Record<string, number> = useMemo(() => {
    if (!slots) return {}
    return { [date]: slots.length }
  }, [slots, date])

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
          WEEK · {format(stripStart, 'yyyy.MM.dd')} — {format(addDays(stripStart, 13), 'MM.dd')}
        </div>
        <div className="flex items-center gap-1.5">
          {fromOffset > 0 && (
            <Link
              href={`/${tenantSlug}?service=${serviceId}&from=${Math.max(0, fromOffset - 7)}${rescheduleFrom ? `&reschedule=${rescheduleFrom}` : ''}`}
              className="inline-flex h-8 items-center gap-1 rounded-full border border-border bg-card px-3 font-mono text-xs font-medium hover:bg-muted"
            >
              <ChevronLeft className="size-3" />
              上週
            </Link>
          )}
          <Link
            href={`/${tenantSlug}?service=${serviceId}&from=0${rescheduleFrom ? `&reschedule=${rescheduleFrom}` : ''}`}
            className="inline-flex h-8 items-center rounded-full border border-border bg-card px-3 font-mono text-xs font-medium hover:bg-muted"
          >
            今天
          </Link>
          <Link
            href={`/${tenantSlug}?service=${serviceId}&from=${fromOffset + 7}${rescheduleFrom ? `&reschedule=${rescheduleFrom}` : ''}`}
            className="inline-flex h-8 items-center gap-1 rounded-full border border-border bg-card px-3 font-mono text-xs font-medium hover:bg-muted"
          >
            再 7 天
            <ChevronRight className="size-3" />
          </Link>
        </div>
      </header>

      <DateRibbon
        dates={days}
        selected={date}
        onSelect={selectDate}
        slotCountByDate={slotCountByDate}
      />

      <section>
        <div className="mb-4 flex flex-wrap items-baseline gap-3.5">
          <h4 className="font-display text-2xl uppercase leading-none tracking-tight sm:text-3xl">
            {format(parseISO(date), 'M/d')}
            <span className="font-cjk ml-2 text-base text-muted-foreground sm:text-lg">
              · {format(parseISO(date), 'EEEE')}
            </span>
          </h4>
          {slots && slots.length > 0 && (
            <span className="font-mono rounded-full bg-accent px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-accent-foreground">
              {slots.length} SLOTS
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-10 w-24 animate-pulse rounded-full border border-border bg-muted"
                style={{ animationDelay: `${i * 50}ms` }}
              />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 font-cjk text-sm text-destructive">
            載入時段失敗:{error}
          </div>
        ) : !slots || slots.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/50 p-8 text-center">
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              NO SLOTS
            </div>
            <p className="font-cjk mt-2 text-sm text-muted-foreground">當天沒有可預約時段</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {slots.map((s) => {
              const start = toLocal(s.start_at)
              const isSelected = s.id === selectedSlotId
              const isGroup = s.max_capacity > 1
              const state = isSelected ? 'selected' : isGroup ? 'group' : 'open'
              const group = isGroup
                ? { filled: s.current_bookings, capacity: s.max_capacity }
                : undefined
              return (
                <TimeChip
                  key={s.id}
                  time={format(start, 'HH:mm')}
                  state={state}
                  group={group}
                  onSelect={() => setSelectedSlotId(s.id)}
                />
              )
            })}
          </div>
        )}
      </section>

      {selectedSlot && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-primary px-5 py-4 text-primary-foreground sm:px-6 sm:py-5">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="font-display text-2xl font-normal sm:text-3xl">
              {format(parseISO(date), 'M/d')} · {format(toLocal(selectedSlot.start_at), 'HH:mm')}
            </span>
            <span className="font-cjk text-xs opacity-70 sm:text-sm">
              · {serviceName} · {serviceDuration} 分鐘 · NT$ {Number(servicePrice ?? 0).toLocaleString()}
            </span>
          </div>
          <Button
            variant="accent"
            size="pill"
            withArrow="inline"
            render={
              <Link
                href={`/book/${selectedSlot.id}${rescheduleFrom ? `?reschedule=${rescheduleFrom}` : ''}`}
              />
            }
          >
            {rescheduleFrom ? '改期到此時段' : '前往預約'}
          </Button>
        </div>
      )}
    </div>
  )
}
