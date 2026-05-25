import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { Clock, DollarSign, Mail, Phone, MessageCircle } from 'lucide-react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getTenantBySlug } from '@/lib/auth/get-tenant-context'
import SlotPicker from './slot-picker'

export default async function TenantPublicPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>
  searchParams: Promise<{
    service?: string
    date?: string
    from?: string
    reschedule?: string
  }>
}) {
  const { tenantSlug } = await params
  const {
    service: selectedServiceId,
    date: selectedDate,
    from: fromOffset,
    reschedule: rescheduleFrom,
  } = await searchParams
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

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-3xl px-4 pb-16">
        {/* Editorial hero */}
        <header className="relative -mx-4 mb-2 overflow-hidden bg-foreground px-6 pb-12 pt-14 text-background sm:mx-0 sm:mt-8 sm:rounded-3xl sm:px-10">
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-br from-foreground via-foreground to-[oklch(0.28_0.12_270)]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent/40 blur-3xl"
            aria-hidden
          />
          <div className="relative">
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] opacity-60">
              預約 · /{tenant.slug}
            </div>
            <h1 className="mt-4 font-display text-5xl leading-[0.95] tracking-tight sm:text-6xl">
              <span className="italic">{tenant.name}</span>
            </h1>
            <p className="mt-6 max-w-md text-sm leading-relaxed text-background/75">
              {tenant.description?.trim() ||
                '在下方選擇您想預訂的服務、日期與時段。送出後狀態為「待確認」，教練確認後即正式成立。'}
            </p>
            {(tenant.contact_email ||
              tenant.contact_phone ||
              tenant.contact_line_id ||
              tenant.contact_note) && (
              <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-xs text-background/80">
                {tenant.contact_email && (
                  <a
                    href={`mailto:${tenant.contact_email}`}
                    className="inline-flex items-center gap-1.5 hover:text-background"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    {tenant.contact_email}
                  </a>
                )}
                {tenant.contact_phone && (
                  <a
                    href={`tel:${tenant.contact_phone}`}
                    className="inline-flex items-center gap-1.5 hover:text-background"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    {tenant.contact_phone}
                  </a>
                )}
                {tenant.contact_line_id && (
                  <span className="inline-flex items-center gap-1.5">
                    <MessageCircle className="h-3.5 w-3.5" />
                    LINE：{tenant.contact_line_id}
                  </span>
                )}
                {tenant.contact_note && (
                  <span className="inline-flex items-center gap-1.5 text-background/70">
                    {tenant.contact_note}
                  </span>
                )}
              </div>
            )}
          </div>
        </header>

        {rescheduleFrom && (
          <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            ⓘ <strong>改期模式</strong>：選擇新時段後，原預約會自動取消並建立新「待確認」預約。
          </div>
        )}
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
                        <div className="font-semibold text-foreground">{s.name}</div>
                        {isActive && (
                          <div className="grid h-5 w-5 place-items-center rounded-full bg-accent text-xs text-accent-foreground">
                            ✓
                          </div>
                        )}
                      </div>
                      {s.description && (
                        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                          {s.description}
                        </p>
                      )}
                      <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
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

            {/* Date + Time selection via SlotPicker */}
            {activeServiceId && (
              <Suspense fallback={null}>
                <SlotPicker
                  tenantSlug={tenantSlug}
                  tenantId={tenant.id}
                  serviceId={activeServiceId}
                  initialDate={dateStr}
                  fromOffset={Math.max(0, parseInt(fromOffset ?? '0', 10) || 0)}
                  rescheduleFrom={rescheduleFrom ?? null}
                />
              </Suspense>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
