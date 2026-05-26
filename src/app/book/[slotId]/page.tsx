import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { ArrowLeft, Calendar } from 'lucide-react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/get-session'
import { findActivePurchaseForBooking } from '@/lib/purchases-server'
import { SectionHead } from '@/components/ui/section-head'
import { Badge } from '@/components/ui/badge'
import { PrimaryCtaLink } from '@/components/ui/primary-cta'
import BookForm from './book-form'

const TZ_OFFSET_HOURS = 8
const toLocal = (iso: string) => new Date(new Date(iso).getTime() + TZ_OFFSET_HOURS * 3600 * 1000)

export default async function BookConfirmPage({
  params,
  searchParams,
}: {
  params: Promise<{ slotId: string }>
  searchParams: Promise<{ reschedule?: string }>
}) {
  const { slotId } = await params
  const { reschedule: rescheduleFrom } = await searchParams
  const supabase = await createSupabaseServerClient()

  const { data: slot } = await supabase
    .from('availability_slots')
    .select(
      'id, start_at, end_at, status, service_id, tenants(name, slug), services(name, duration_minutes, price)',
    )
    .eq('id', slotId)
    .maybeSingle()
  if (!slot) notFound()

  if (slot.status !== 'available') {
    const tenant = slot.tenants as { slug: string } | null
    return (
      <main className="grid min-h-screen place-items-center bg-background p-6">
        <div className="max-w-md rounded-2xl border border-border bg-card p-10 text-center">
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            UNAVAILABLE
          </div>
          <h2 className="font-display mt-4 text-2xl uppercase">時段已不可預約</h2>
          <p className="font-cjk mt-2 text-sm text-muted-foreground">
            該時段可能已被其他學員預約或取消。
          </p>
          {tenant && (
            <Link
              href={`/${tenant.slug}`}
              className="font-mono mt-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs uppercase tracking-wider hover:bg-muted"
            >
              <ArrowLeft className="size-3" /> 回教練頁
            </Link>
          )}
        </div>
      </main>
    )
  }

  const session = await getSession()
  if (!session) {
    redirect(`/login?redirect=/book/${slotId}`)
  }

  const activePurchase = await findActivePurchaseForBooking(
    supabase,
    session.userId,
    slot.service_id,
  )

  if (!activePurchase) {
    const { data: packages } = await supabase
      .from('service_packages')
      .select('id, name, class_count, price, expires_in_days')
      .eq('service_id', slot.service_id)
      .eq('is_active', true)
      .order('class_count', { ascending: true })

    const serviceName = (slot.services as { name: string } | null)?.name ?? '此服務'
    const tenantSlug = (slot.tenants as { slug: string } | null)?.slug ?? ''

    return (
      <div className="min-h-screen bg-background">
        <main className="mx-auto max-w-2xl px-5 py-10 sm:px-10 sm:py-14">
          <SectionHead
            kicker="NEED PACKAGE · 需先購買套裝"
            title="需先購買套裝"
            eng="STOP"
            hint={`您尚未持有 ${serviceName} 的有效課數。請先選擇方案、送出申請、待教練確認後即可預約。`}
          />
          {packages && packages.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {packages.map((p) => (
                <div key={p.id} className="rounded-2xl border border-border bg-card p-5">
                  <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
                    PACKAGE
                  </div>
                  <div className="font-display font-cjk mt-1 text-lg font-black">{p.name}</div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="font-display text-3xl leading-none">{p.class_count}</span>
                    <span className="font-cjk text-xs text-muted-foreground">堂</span>
                  </div>
                  <div className="font-cjk mt-2 text-xs text-muted-foreground">
                    {p.expires_in_days ? `${p.expires_in_days} 天內上完` : '永久有效'}
                  </div>
                  <div className="mt-3 border-t border-dashed border-border pt-3">
                    <span className="font-display border-b-[3px] border-accent pb-px text-lg">
                      NT$ {Number(p.price).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-8">
            <PrimaryCtaLink href={`/${tenantSlug}/packages`} size="lg">
              前往購買套裝
            </PrimaryCtaLink>
          </div>
        </main>
      </div>
    )
  }

  const tenant = slot.tenants as { name: string; slug: string } | null
  const service = slot.services as {
    name: string
    duration_minutes: number
    price: number | null
  } | null
  const start = toLocal(slot.start_at)
  const end = toLocal(slot.end_at)

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-md px-5 py-10 sm:py-14">
        {tenant && (
          <Link
            href={`/${tenant.slug}`}
            className="font-mono mb-6 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3" />
            {tenant.name}
          </Link>
        )}

        <div className="font-mono mb-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          {rescheduleFrom ? 'RESCHEDULE · 確認改期' : 'BOOKING · 確認預約'}
        </div>
        <h1 className="font-display text-4xl uppercase leading-none tracking-tight">
          {rescheduleFrom ? (
            <>
              確認<span className="font-cjk">改期</span>
            </>
          ) : (
            <>
              確認<span className="font-cjk">預約</span>
            </>
          )}
        </h1>
        <p className="font-cjk mt-3 text-sm text-muted-foreground">
          {rescheduleFrom ? '送出後將自動取消原預約並改為此時段。' : '確認資訊後送出預約申請。'}
        </p>

        {rescheduleFrom && (
          <div className="mt-5 rounded-2xl bg-accent px-4 py-3 font-cjk text-xs text-accent-foreground">
            ⓘ 您正在改期。原預約將被取消，重新建立的新預約狀態為「待確認」。
          </div>
        )}

        <div className="mt-7 rounded-2xl border border-border bg-card p-5 shadow-[0_1px_0_var(--border),0_8px_24px_-18px_rgba(0,0,0,0.18)]">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-full bg-foreground text-background">
              <Calendar className="size-5" />
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                DATE / TIME
              </div>
              <div className="font-display mt-0.5 text-lg leading-none">
                {format(start, 'yyyy/MM/dd')} · {format(start, 'HH:mm')}–{format(end, 'HH:mm')}
              </div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-dashed border-border pt-4">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                SERVICE
              </div>
              <div className="font-cjk mt-0.5 text-sm font-semibold">
                {service?.name} <span className="text-muted-foreground">({service?.duration_minutes} 分)</span>
              </div>
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                PRICE
              </div>
              <div className="font-display mt-0.5 text-base">
                {service?.price ? `NT$ ${Number(service.price).toLocaleString()}` : '洽詢'}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-border bg-muted/40 p-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            ACTIVE PACKAGE · 套裝餘額
          </div>
          <div className="font-cjk mt-1.5 text-sm font-medium">
            預約成立後將從現有套裝扣除 1 堂。
          </div>
        </div>

        <div className="mt-7">
          <BookForm slotId={slotId} rescheduleFrom={rescheduleFrom ?? null} />
        </div>
      </main>
    </div>
  )
}
