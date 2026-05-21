import { notFound } from 'next/navigation'
import Link from 'next/link'
import { addDays, format, parseISO, startOfDay } from 'date-fns'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getTenantBySlug } from '@/lib/auth/get-tenant-context'
import { buttonVariants } from '@/components/ui/button'

const TZ_OFFSET_HOURS = 8

function toLocal(iso: string): Date {
  return new Date(new Date(iso).getTime() + TZ_OFFSET_HOURS * 3600 * 1000)
}

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
      <main className="flex min-h-screen items-center justify-center p-8">
        <p className="text-slate-600">此教練的預約服務暫停中</p>
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

  let availableSlots:
    | Array<{ id: string; start_at: string; end_at: string }>
    | null
    | undefined = null
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

  // 7-day strip starting today
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
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <header className="rounded-lg bg-gradient-to-br from-blue-600 to-blue-800 p-6 text-white">
        <h1 className="text-3xl font-bold">{tenant.name}</h1>
        <p className="mt-2 text-sm text-white/85">/{tenant.slug}</p>
      </header>

      {!services || services.length === 0 ? (
        <div className="rounded border bg-white p-6 text-center text-slate-500">
          此教練尚未開放任何服務
        </div>
      ) : (
        <>
          <section>
            <h2 className="mb-2 text-sm font-medium text-slate-600">選擇服務</h2>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {services.map((s) => {
                const isActive = s.id === activeServiceId
                return (
                  <Link
                    key={s.id}
                    href={`/${tenantSlug}?service=${s.id}${selectedDate ? `&date=${selectedDate}` : ''}`}
                    className={`rounded border p-3 text-sm ${
                      isActive ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="font-semibold">{s.name}</div>
                    <div className="text-xs text-slate-500">
                      {s.duration_minutes} 分鐘 · {s.price ? `$${s.price}` : '價格洽詢'}
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-medium text-slate-600">選擇日期</h2>
            <div className="grid grid-cols-7 gap-1">
              {days.map((d) => {
                const key = format(d, 'yyyy-MM-dd')
                const count = dayCounts[key] ?? 0
                const isSelected = key === dateStr
                return (
                  <Link
                    key={key}
                    href={`/${tenantSlug}?service=${activeServiceId}&date=${key}`}
                    className={`rounded border p-2 text-center text-xs ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-slate-400">{format(d, 'EEE')}</div>
                    <div className="text-base font-semibold">{format(d, 'd')}</div>
                    <div className={count > 0 ? 'mt-1 text-emerald-600' : 'mt-1 text-slate-300'}>
                      {count > 0 ? `${count} 個` : '無'}
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-medium text-slate-600">
              {format(parseISO(dateStr), 'M/d')} 可選時段
            </h2>
            {!availableSlots || availableSlots.length === 0 ? (
              <p className="rounded border bg-white p-4 text-sm text-slate-400">
                當天沒有可預約時段
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2 md:grid-cols-4">
                {availableSlots.map((s) => {
                  const start = toLocal(s.start_at)
                  const end = toLocal(s.end_at)
                  return (
                    <Link
                      key={s.id}
                      href={`/book/${s.id}`}
                      className={buttonVariants({ variant: 'outline', size: 'sm' })}
                    >
                      {format(start, 'HH:mm')}–{format(end, 'HH:mm')}
                    </Link>
                  )
                })}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  )
}
