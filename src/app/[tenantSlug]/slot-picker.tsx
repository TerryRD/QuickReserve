'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { addMonths, format, parseISO, startOfDay, startOfMonth } from 'date-fns'
import { BookingCalendar } from '@/components/booking/booking-calendar'
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
  rescheduleFrom,
}: SlotPickerProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [date, setDate] = useState(initialDate)
  const [monthAnchor, setMonthAnchor] = useState(() =>
    format(startOfMonth(parseISO(initialDate)), 'yyyy-MM-dd'),
  )
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null)
  const [slots, setSlots] = useState<Slot[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dayCounts, setDayCounts] = useState<Record<string, number> | null>(null)

  const today = useMemo(() => format(startOfDay(new Date()), 'yyyy-MM-dd'), [])

  // Fetch which days in the visible month have bookable slots.
  useEffect(() => {
    let cancelled = false
    setDayCounts(null)
    const usp = new URLSearchParams({ tenantId, serviceId, month: monthAnchor })
    fetch(`/api/public/slot-days?${usp.toString()}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<{ days: Record<string, number> }>
      })
      .then(({ days }) => {
        if (!cancelled) setDayCounts(days)
      })
      .catch(() => {
        // On failure, fall back to an empty map so days simply aren't dotted;
        // the per-day slot fetch below remains the source of truth.
        if (!cancelled) setDayCounts({})
      })
    return () => {
      cancelled = true
    }
  }, [tenantId, serviceId, monthAnchor])

  // Fetch the time slots for the selected day.
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

  function shiftMonth(delta: number) {
    setMonthAnchor(format(addMonths(parseISO(monthAnchor), delta), 'yyyy-MM-dd'))
  }

  function goToday() {
    setMonthAnchor(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
    selectDate(today)
  }

  const selectedSlot = useMemo(
    () => slots?.find((s) => s.id === selectedSlotId) ?? null,
    [slots, selectedSlotId],
  )

  return (
    <div className="grid gap-7 lg:grid-cols-[320px_1fr] lg:gap-9">
      {/* Calendar — pick a day */}
      <BookingCalendar
        monthAnchor={monthAnchor}
        selected={date}
        dayCounts={dayCounts}
        minDate={today}
        onSelect={selectDate}
        onPrevMonth={() => shiftMonth(-1)}
        onNextMonth={() => shiftMonth(1)}
        onToday={goToday}
      />

      {/* Time slots for the selected day */}
      <section className="min-w-0">
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

        {selectedSlot && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-primary px-5 py-4 text-primary-foreground sm:px-6 sm:py-5">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className="font-display text-2xl font-normal sm:text-3xl">
                {format(parseISO(date), 'M/d')} · {format(toLocal(selectedSlot.start_at), 'HH:mm')}
              </span>
              <span className="font-cjk text-xs opacity-70 sm:text-sm">
                · {serviceName} · {serviceDuration} 分鐘 · NT${' '}
                {Number(servicePrice ?? 0).toLocaleString()}
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
      </section>
    </div>
  )
}
