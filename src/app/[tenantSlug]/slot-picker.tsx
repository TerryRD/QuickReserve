'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { addDays, format, parseISO, startOfDay } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'

type Slot = { id: string; start_at: string; end_at: string }

const TZ_OFFSET_HOURS = 8
const toLocal = (iso: string) => new Date(new Date(iso).getTime() + TZ_OFFSET_HOURS * 3600 * 1000)

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']

export default function SlotPicker({
  tenantSlug,
  tenantId,
  serviceId,
  initialDate,
  fromOffset,
  rescheduleFrom,
}: {
  tenantSlug: string
  tenantId: string
  serviceId: string
  initialDate: string
  fromOffset: number
  rescheduleFrom: string | null
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [date, setDate] = useState(initialDate)
  const [slots, setSlots] = useState<Slot[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const today = startOfDay(new Date())
  const stripStart = addDays(today, fromOffset)
  const days = Array.from({ length: 14 }, (_, i) => addDays(stripStart, i))

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
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

  const selectedFmt = format(parseISO(date), 'M/d')
  const selectedDow = WEEKDAY_LABELS[parseISO(date).getDay()]

  return (
    <div className="space-y-8">
      {/* Date strip nav */}
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            日期 · DATE — {format(stripStart, 'M/d')} — {format(addDays(stripStart, 13), 'M/d')}
          </div>
          <div className="flex items-center gap-1.5">
            {fromOffset > 0 && (
              <Link
                href={`/${tenantSlug}?service=${serviceId}&from=${Math.max(0, fromOffset - 7)}`}
                className="inline-flex h-8 items-center gap-1 rounded-full border border-border bg-card px-3 text-xs font-medium hover:bg-muted"
              >
                <ChevronLeft className="size-3" />
                上週
              </Link>
            )}
            <Link
              href={`/${tenantSlug}?service=${serviceId}&from=0`}
              className="inline-flex h-8 items-center rounded-full border border-border bg-card px-3 text-xs font-medium hover:bg-muted"
            >
              今天
            </Link>
            <Link
              href={`/${tenantSlug}?service=${serviceId}&from=${fromOffset + 7}`}
              className="inline-flex h-8 items-center gap-1 rounded-full border border-border bg-card px-3 text-xs font-medium hover:bg-muted"
            >
              再 7 天
              <ChevronRight className="size-3" />
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {days.map((d) => {
            const key = format(d, 'yyyy-MM-dd')
            const isSelected = key === date
            const isToday = key === format(today, 'yyyy-MM-dd')
            const dayNum = format(d, 'd')
            const dow = WEEKDAY_LABELS[d.getDay()]
            const isWeekend = d.getDay() === 0 || d.getDay() === 6
            return (
              <button
                type="button"
                key={key}
                onClick={() => selectDate(key)}
                className={`relative flex h-[70px] flex-col items-stretch justify-between rounded-xl border p-2 text-left transition sm:h-[84px] sm:p-3 ${
                  isSelected
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border bg-card hover:border-foreground/40'
                }`}
                aria-pressed={isSelected}
              >
                <div className="flex items-center justify-between">
                  {isToday ? (
                    <span
                      className="grid size-6 place-items-center rounded-full bg-accent text-accent-foreground sm:size-7"
                      aria-label="今天"
                    >
                      <span className="font-display text-sm font-bold sm:text-base">{dayNum}</span>
                    </span>
                  ) : (
                    <span
                      className={`font-display text-base font-normal sm:text-lg ${
                        isWeekend && !isSelected ? 'text-muted-foreground' : ''
                      }`}
                    >
                      {dayNum}
                    </span>
                  )}
                </div>
                <div className="flex items-baseline justify-between">
                  <span
                    className={`font-mono text-[9px] tracking-[0.08em] sm:text-[10px] ${
                      isSelected ? 'text-background/80' : 'text-muted-foreground'
                    }`}
                  >
                    {dow}
                  </span>
                </div>
                {isSelected && (
                  <span
                    aria-hidden
                    className="absolute inset-x-0 bottom-0 h-[3px] bg-accent"
                  />
                )}
              </button>
            )
          })}
        </div>
      </section>

      {/* Slot chip grid */}
      <section>
        <div className="mb-4 flex flex-wrap items-baseline gap-3.5">
          <h4 className="font-display text-2xl uppercase leading-none tracking-tight sm:text-3xl">
            {selectedFmt}
            <span className="font-cjk ml-2 text-base text-muted-foreground sm:text-lg">
              · 週{selectedDow}
            </span>
          </h4>
          {slots && slots.length > 0 && (
            <span className="rounded-full bg-accent px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-accent-foreground">
              {slots.length} SLOTS
            </span>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-16 animate-pulse rounded-xl border border-border bg-muted"
                style={{ animationDelay: `${i * 50}ms` }}
              />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 font-cjk text-sm text-destructive">
            載入時段失敗：{error}
          </div>
        ) : !slots || slots.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/50 p-8 text-center">
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              NO SLOTS
            </div>
            <p className="font-cjk mt-2 text-sm text-muted-foreground">當天沒有可預約時段</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
            {slots.map((s) => {
              const start = toLocal(s.start_at)
              const end = toLocal(s.end_at)
              return (
                <Link
                  key={s.id}
                  href={`/book/${s.id}${rescheduleFrom ? `?reschedule=${rescheduleFrom}` : ''}`}
                  className="group flex h-16 flex-col items-start justify-center gap-0.5 rounded-xl border border-border bg-card px-3.5 transition hover:border-foreground/60 hover:bg-muted"
                >
                  <span className="font-display text-lg font-normal leading-none tracking-tight">
                    {format(start, 'HH:mm')}
                  </span>
                  <span className="font-mono text-[9px] tracking-[0.06em] text-muted-foreground">
                    – {format(end, 'HH:mm')}
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
