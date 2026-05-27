import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { ArrowLeft, Package } from 'lucide-react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/get-session'
import { findActivePurchaseForBooking } from '@/lib/purchases-server'
import { isActivePurchase, type CustomerPurchase } from '@/lib/purchases'
import { SectionHead } from '@/components/ui/section-head'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { PrimaryCtaLink } from '@/components/ui/primary-cta'
import BookForm from './book-form'

const TZ_OFFSET_HOURS = 8
const toLocal = (iso: string) => new Date(new Date(iso).getTime() + TZ_OFFSET_HOURS * 3600 * 1000)

type ActivePurchaseRow = CustomerPurchase & {
  service_packages: { name: string } | null
}

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
      'id, start_at, end_at, status, service_id, tenants(name, slug), services(name, duration_minutes, price, cancel_deadline_hours)',
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

  const tenant = slot.tenants as { name: string; slug: string } | null
  const service = slot.services as {
    name: string
    duration_minutes: number
    price: number | null
    cancel_deadline_hours: number
  } | null
  const tenantSlug = tenant?.slug ?? ''

  const activePurchase = await findActivePurchaseForBooking(
    supabase,
    session.userId,
    slot.service_id,
  )

  // No active purchase → empty state pointing to packages
  if (!activePurchase) {
    return (
      <div className="min-h-screen bg-background">
        <main className="mx-auto max-w-[920px] space-y-7 px-5 py-10 sm:px-10 sm:py-14">
          {tenant && (
            <Link
              href={`/${tenant.slug}`}
              className="font-mono inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-3" />
              {tenant.name}
            </Link>
          )}
          <SectionHead
            kicker={`/book · ${tenantSlug}`}
            title="預約確認"
            eng="CONFIRM"
            hint={`您尚未持有 ${service?.name ?? '此服務'} 的有效課數，請先申請套裝。`}
          />
          <EmptyState
            icon={<Package className="size-5" />}
            title="尚無可用套裝"
            hint="先去申請一個套裝才能預約"
            cta={
              <PrimaryCtaLink href={`/${tenantSlug}/packages`}>瀏覽套裝</PrimaryCtaLink>
            }
          />
        </main>
      </div>
    )
  }

  // Fetch all active purchases (with package name) for visual radio list
  const { data: rawPurchases } = await supabase
    .from('customer_purchases')
    .select(
      'id, approval_status, classes_total, classes_used, expires_at, service_packages(name)',
    )
    .eq('customer_id', session.userId)
    .eq('service_id', slot.service_id)
    .eq('approval_status', 'confirmed')
    .order('expires_at', { ascending: true, nullsFirst: false })

  const now = new Date()
  const activePurchases: ActivePurchaseRow[] = ((rawPurchases ?? []) as ActivePurchaseRow[]).filter(
    (p) => isActivePurchase(p, now),
  )

  const start = toLocal(slot.start_at)
  const end = toLocal(slot.end_at)

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-[920px] space-y-7 px-5 py-10 sm:px-10 sm:py-14">
        {tenant && (
          <Link
            href={`/${tenant.slug}`}
            className="font-mono inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3" />
            {tenant.name}
          </Link>
        )}

        <SectionHead
          kicker={`/book · ${tenantSlug}`}
          title={rescheduleFrom ? '改期確認' : '預約確認'}
          eng="CONFIRM"
          hint={
            rescheduleFrom
              ? '送出後將自動取消原預約並改為此時段。'
              : '確認資訊後送出預約申請，待教練核可。'
          }
        />

        {rescheduleFrom && (
          <div className="rounded-2xl bg-accent px-4 py-3 font-cjk text-xs text-accent-foreground">
            ⓘ 您正在改期。原預約將被取消，重新建立的新預約狀態為「待確認」。
          </div>
        )}

        {/* Slot detail card */}
        <Card className="p-7">
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {format(start, 'EEEE, MMM dd')}
          </div>
          <div className="font-display mt-1 text-5xl leading-none tracking-tight">
            {format(start, 'HH:mm')}
            <span className="text-muted-foreground/60 ml-3 text-2xl">
              –{format(end, 'HH:mm')}
            </span>
          </div>
          <div className="font-cjk mt-3 text-base">
            {service?.name} · {service?.duration_minutes} 分鐘
          </div>
          {service?.price ? (
            <div className="mt-4 border-t border-dashed border-border pt-4">
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                PRICE
              </div>
              <div className="font-display mt-1 text-lg">
                NT$ {Number(service.price).toLocaleString()}
              </div>
            </div>
          ) : null}
        </Card>

        {/* Package balance picker (radio cards; oldest-expiring auto-selected) */}
        <section>
          <SectionHead
            kicker="PACKAGE · 套裝餘額"
            title="本次將扣除"
            eng="DEDUCT"
            hint="系統自動從最快到期的套裝扣 1 堂。"
          />
          <div className="grid gap-3">
            {activePurchases.map((p) => {
              const remaining = p.classes_total - p.classes_used
              const total = p.classes_total
              const percent = total > 0 ? (remaining / total) * 100 : 0
              const isSelected = p.id === activePurchase.id
              const pkgName = p.service_packages?.name ?? '套裝'
              return (
                <label
                  key={p.id}
                  className="flex cursor-pointer items-center gap-4 rounded-2xl border border-border bg-card p-5 transition-colors has-[:checked]:border-foreground has-[:checked]:bg-accent has-[:checked]:text-accent-foreground"
                >
                  <input
                    type="radio"
                    name="package-display"
                    value={p.id}
                    defaultChecked={isSelected}
                    disabled
                    className="size-4 accent-foreground"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-cjk truncate text-sm font-semibold">{pkgName}</div>
                    <div className="font-mono mt-1 text-xs tracking-wider text-muted-foreground">
                      {remaining}/{total} 堂
                      {p.expires_at ? (
                        <>
                          {' · '}期限 {format(new Date(p.expires_at), 'yyyy/MM/dd')}
                        </>
                      ) : null}
                    </div>
                    <div className="bg-muted mt-2 h-1 overflow-hidden rounded-full">
                      <div
                        className="bg-foreground h-full"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                  <div className="font-display text-2xl leading-none">{remaining}</div>
                </label>
              )
            })}
          </div>
        </section>

        {/* Cancellation policy */}
        <div className="rounded-2xl border border-border bg-muted/40 p-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            POLICY · 取消政策
          </div>
          <p className="font-cjk mt-2 text-xs leading-relaxed text-muted-foreground">
            開始前{' '}
            <strong className="text-foreground">
              {service?.cancel_deadline_hours ?? 24} 小時
            </strong>{' '}
            以上取消，堂數退回套裝；逾時取消或未到場視同已上完一堂。
          </p>
        </div>

        {/* Submit (preserves existing server action via BookForm) */}
        <BookForm slotId={slotId} rescheduleFrom={rescheduleFrom ?? null} />
      </main>
    </div>
  )
}
