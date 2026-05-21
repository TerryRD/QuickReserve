import { notFound } from 'next/navigation'
import Link from 'next/link'
import { addDays, format, parseISO, startOfDay } from 'date-fns'
import { Calendar, Clock, DollarSign, ChevronRight } from 'lucide-react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getTenantBySlug } from '@/lib/auth/get-tenant-context'

const TZ_OFFSET_HOURS = 8
const toLocal = (iso: string) => new Date(new Date(iso).getTime() + TZ_OFFSET_HOURS * 3600 * 1000)

export default async function TenantPublicPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>
  searchParams: Promise<{ service?: string; date?: string }>
}) {
  const { tenantSlug } = await params
  const { service: selectedServiceId, date: selectedDate } = await searchParams
  const tenant = await getTenantBySlug(tenantSlug)
  if (!tenant) notFound()

  if (tenant.status === 'suspended') {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 p-8">
        <div className="max-w-md rounded-xl border bg-white p-10 text-center shadow-sm">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-2xl">
            ⏸️
          </div>
          <h2 className="mt-4 text-xl font-semibold text-slate-900">服務暫停中</h2>
          <p className="mt-2 text-sm text-slate-600">此教練目前不開放預約，請稍後再試。</p>
        </div>
      </main>
    )
  }

  const supabase = await createSupabaseServerClient()
  const { data: services } = await supabase
    .from('services')
    .select('id, name, description, duration_minutes, price')
    .eq('tenant_id', tenant.id)
    .eq('is_active', true)
    .order('name')

  const activeServiceId = selectedServiceId ?? services?.[0]?.id ?? null
  const dateStr = selectedDate ?? format(new Date(), 'yyyy-MM-dd')
  const dayStart = startOfDay(parseISO(dateStr)).toISOString()
  const dayEnd = addDays(startOfDay(parseISO(dateStr)), 1).toISOString()

  let availableSlots: Array<{ id: string; start_at: string; end_at: string }> | null = null
  if (activeServiceId) {
    const { data } = await supabase
      .from('availability_slots')
      .select('id, start_at, end_at')
      .eq('tenant_id', tenant.id)
      .eq('service_id', activeServiceId)
      .eq('status', 'available')
      .gte('start_at', dayStart)
      .lt('start_at', dayEnd)
      .order('start_at')
    availableSlots = data
  }

  const today = startOfDay(new Date())
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i))
  const dayCounts: Record<string, number> = {}
  if (activeServiceId) {
    const weekEnd = addDays(today, 7)
    const { data: weekSlots } = await supabase
      .from('availability_slots')
      .select('start_at')
      .eq('tenant_id', tenant.id)
      .eq('service_id', activeServiceId)
      .eq('status', 'available')
      .gte('start_at', today.toISOString())
      .lt('start_at', weekEnd.toISOString())
    for (const s of weekSlots ?? []) {
      const key = format(toLocal(s.start_at), 'yyyy-MM-dd')
      dayCounts[key] = (dayCounts[key] ?? 0) + 1
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <main className="mx-auto max-w-3xl px-4 pb-12">
        {/* Hero */}
        <header className="relative -mx-4 overflow-hidden rounded-b-3xl bg-gradient-to-br from-blue-600 via-indigo-700 to-slate-900 px-6 pb-10 pt-12 text-white sm:mx-0 sm:rounded-3xl sm:mt-8">
          <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-indigo-400/30 blur-3xl" />
          <div className="relative flex items-center gap-4">
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-white/15 text-3xl backdrop-blur">
              {tenant.name.slice(0, 1)}
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{tenant.name}</h1>
              <p className="mt-1 text-sm text-white/75">線上預約 · /{tenant.slug}</p>
            </div>
          </div>
        </header>

        {!services || services.length === 0 ? (
          <div className="mt-8 rounded-xl border bg-white p-10 text-center text-sm text-slate-500">
            此教練尚未開放任何服務
          </div>
        ) : (
          <div className="mt-6 space-y-6 sm:mt-8">
            {/* Service selection */}
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                  1
                </span>
                選擇服務
              </h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {services.map((s) => {
                  const isActive = s.id === activeServiceId
                  return (
                    <Link
                      key={s.id}
                      href={`/${tenantSlug}?service=${s.id}${selectedDate ? `&date=${selectedDate}` : ''}`}
                      className={`group rounded-xl border p-4 transition ${
                        isActive
                          ? 'border-blue-500 bg-blue-50/50 shadow-sm ring-2 ring-blue-500/10'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-semibold text-slate-900">{s.name}</div>
                        {isActive && (
                          <div className="grid h-5 w-5 place-items-center rounded-full bg-blue-500 text-xs text-white">
                            ✓
                          </div>
                        )}
                      </div>
                      <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {s.duration_minutes} 分鐘
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          {s.price ? Number(s.price).toLocaleString() : '洽詢'}
                        </span>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </section>

            {/* Date selection */}
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                  2
                </span>
                選擇日期
              </h2>
              <div className="grid grid-cols-7 gap-1.5">
                {days.map((d) => {
                  const key = format(d, 'yyyy-MM-dd')
                  const count = dayCounts[key] ?? 0
                  const isSelected = key === dateStr
                  const isToday = key === format(today, 'yyyy-MM-dd')
                  return (
                    <Link
                      key={key}
                      href={`/${tenantSlug}?service=${activeServiceId}&date=${key}`}
                      className={`flex flex-col items-center gap-0.5 rounded-xl border p-2 text-center transition ${
                        isSelected
                          ? 'border-blue-500 bg-blue-500 text-white shadow-sm'
                          : count > 0
                            ? 'border-slate-200 bg-white hover:border-slate-300'
                            : 'border-slate-100 bg-slate-50/60 text-slate-400'
                      }`}
                    >
                      <div className="text-[10px] opacity-80">{format(d, 'EEE')}</div>
                      <div className="text-base font-semibold">{format(d, 'd')}</div>
                      <div
                        className={`text-[10px] ${
                          isSelected
                            ? 'text-white/85'
                            : count > 0
                              ? 'text-emerald-600'
                              : 'text-slate-300'
                        }`}
                      >
                        {count > 0 ? `${count} 個` : isToday ? '今天' : '—'}
                      </div>
                    </Link>
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
                {format(parseISO(dateStr), 'M/d (EEEEEE)')} 可選時段
              </h2>
              {!availableSlots || availableSlots.length === 0 ? (
                <div className="rounded-xl border border-dashed bg-slate-50/50 p-8 text-center">
                  <Calendar className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-2 text-sm text-slate-500">當天沒有可預約時段</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {availableSlots.map((s) => {
                    const start = toLocal(s.start_at)
                    const end = toLocal(s.end_at)
                    return (
                      <Link
                        key={s.id}
                        href={`/book/${s.id}`}
                        className="group flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 transition hover:border-blue-400 hover:bg-blue-50/30 hover:shadow-sm"
                      >
                        <div>
                          <div className="text-sm font-semibold text-slate-900">
                            {format(start, 'HH:mm')}
                          </div>
                          <div className="text-[10px] text-slate-500">– {format(end, 'HH:mm')}</div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-500" />
                      </Link>
                    )
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  )
}
