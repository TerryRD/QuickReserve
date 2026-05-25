'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { addDays, format, parseISO, startOfDay } from 'date-fns'
import { Calendar, ChevronRight } from 'lucide-react'

type Slot = { id: string; start_at: string; end_at: string }

const TZ_OFFSET_HOURS = 8
const toLocal = (iso: string) =>
  new Date(new Date(iso).getTime() + TZ_OFFSET_HOURS * 3600 * 1000)

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
  initialDate: string // 'yyyy-MM-dd'
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

  return (
    <>
      {/* Date strip */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
              2
            </span>
            選擇日期
          </h2>
          <div className="flex items-center gap-1 text-xs">
            {fromOffset > 0 && (
              <Link
                href={`/${tenantSlug}?service=${serviceId}&from=${Math.max(0, fromOffset - 7)}`}
                className="rounded-md border bg-white px-2 py-1 hover:bg-muted"
              >
                ◄ 上週
              </Link>
            )}
            <Link
              href={`/${tenantSlug}?service=${serviceId}&from=${fromOffset + 7}`}
              className="rounded-md border bg-white px-2 py-1 hover:bg-muted"
            >
              再 7 天 ►
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {days.map((d) => {
            const key = format(d, 'yyyy-MM-dd')
            const isSelected = key === date
            const isToday = key === format(today, 'yyyy-MM-dd')
            return (
              <button
                type="button"
                key={key}
                onClick={() => selectDate(key)}
                className={`flex flex-col items-center gap-0.5 rounded-xl border p-2 text-center transition ${
                  isSelected
                    ? 'border-blue-500 bg-blue-500 text-white shadow-sm'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="text-[10px] opacity-80">{format(d, 'EEE')}</div>
                <div className="text-base font-semibold">{format(d, 'd')}</div>
                <div
                  className={`text-[10px] ${
                    isSelected ? 'text-white/85' : 'text-slate-400'
                  }`}
                >
                  {isToday ? '今天' : ''}
                </div>
              </button>
            )
          })}
        </div>
      </section>

      {/* Time selection */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <span className="grid h-5 w-5 place-items-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
            3
          </span>
          {format(parseISO(date), 'M/d (EEEEEE)')} 可選時段
        </h2>
        {loading ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-14 animate-pulse rounded-xl border bg-card"
                style={{ animationDelay: `${i * 50}ms` }}
              />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            載入時段失敗：{error}
          </div>
        ) : !slots || slots.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-slate-50/50 p-8 text-center">
            <Calendar className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-2 text-sm text-slate-500">當天沒有可預約時段</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {slots.map((s) => {
              const start = toLocal(s.start_at)
              const end = toLocal(s.end_at)
              return (
                <Link
                  key={s.id}
                  href={`/book/${s.id}${rescheduleFrom ? `?reschedule=${rescheduleFrom}` : ''}`}
                  className="group flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 transition hover:border-blue-400 hover:bg-blue-50/30 hover:shadow-sm"
                >
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      {format(start, 'HH:mm')}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      – {format(end, 'HH:mm')}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-500" />
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </>
  )
}
