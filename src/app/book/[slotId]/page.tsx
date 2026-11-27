import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { ArrowLeft, Package } from 'lucide-react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/get-session'
import { findActivePurchaseForBooking } from '@/lib/purchases-server'
import { isActivePurchase, type CustomerPurchase } from '@/lib/purchases'
import { isSlotBookable } from '@/lib/public-slots'
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

const UNAVAILABLE_NOTICE = {
  kicker: '無法預約',
  title: '時段已不可預約',
  hint: '該時段可能已被其他學員預約或取消。',
}

const LOAD_FAILED_NOTICE = {
  kicker: '暫時無法顯示',
  title: '目前無法取得時段資料',
  hint: '請稍後再試。',
}

const ALREADY_BOOKED_NOTICE = {
  kicker: '已預約',
  title: '你已預約這個時段',
  hint: '可以到「我的預約」查看這筆預約。',
}

const NOTICE_LINK_CLASS =
  'font-mono inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs uppercase tracking-wider hover:bg-muted'

/** 不能進入預約表單時的提示卡片（時段已不可預約、讀不到時段資料、已預約這個時段共用同一個版型） */
function SlotNotice({
  kicker,
  title,
  hint,
  tenantSlug,
  showMyBookingsLink = false,
}: {
  kicker: string
  title: string
  hint: string
  tenantSlug: string | null
  showMyBookingsLink?: boolean
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-background p-6">
      <div className="max-w-md rounded-2xl border border-border bg-card p-10 text-center">
        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          {kicker}
        </div>
        <h2 className="font-display mt-4 text-2xl uppercase">{title}</h2>
        <p className="font-cjk mt-2 text-sm text-muted-foreground">{hint}</p>
        {(tenantSlug || showMyBookingsLink) && (
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {tenantSlug && (
              <Link href={`/${tenantSlug}`} className={NOTICE_LINK_CLASS}>
                <ArrowLeft className="size-3" /> 回教練頁
              </Link>
            )}
            {showMyBookingsLink && (
              <Link href="/my-bookings" className={NOTICE_LINK_CLASS}>
                查看我的預約
              </Link>
            )}
          </div>
        )}
      </div>
    </main>
  )
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
      'id, start_at, end_at, status, service_id, tenants(name, slug), services(name, duration_minutes, price, cancel_deadline_hours, max_capacity)',
    )
    .eq('id', slotId)
    .maybeSingle()
  if (!slot) notFound()

  const slotTenant = slot.tenants as { slug: string } | null
  const slotTenantSlug = slotTenant?.slug ?? null

  // 已登入時先查本人是否已預約這個時段（含已額滿的時段）；查詢失敗就擋下，不當成沒預約
  const session = await getSession()
  if (session) {
    const { data: ownBookings, error: ownBookingsError } = await supabase
      .from('bookings')
      .select('id')
      .eq('slot_id', slotId)
      .eq('customer_id', session.userId)
      .neq('status', 'cancelled')
      .limit(1)
    if (ownBookingsError) {
      return <SlotNotice {...LOAD_FAILED_NOTICE} tenantSlug={slotTenantSlug} />
    }
    if (ownBookings && ownBookings.length > 0) {
      return (
        <SlotNotice {...ALREADY_BOOKED_NOTICE} tenantSlug={slotTenantSlug} showMyBookingsLink />
      )
    }
  }

  // 沒人預約（available）或有人預約但未額滿（pending）才可能還能約；其他狀態直接擋下
  if (slot.status !== 'available' && slot.status !== 'pending') {
    return <SlotNotice {...UNAVAILABLE_NOTICE} tenantSlug={slotTenantSlug} />
  }

  // 已佔名額由資料庫函式算（學員讀不到別人的預約）；讀不到就擋下，不當成可預約、也不當成 0 人
  const slotService = slot.services as { max_capacity: number } | null
  const { data: taken, error: takenError } = await supabase.rpc('slot_taken_count', {
    p_slot_id: slotId,
  })
  const maxCapacity = slotService?.max_capacity
  if (takenError || typeof taken !== 'number' || typeof maxCapacity !== 'number') {
    return <SlotNotice {...LOAD_FAILED_NOTICE} tenantSlug={slotTenantSlug} />
  }
  if (!isSlotBookable({ status: slot.status, taken, maxCapacity })) {
    return <SlotNotice {...UNAVAILABLE_NOTICE} tenantSlug={slotTenantSlug} />
  }

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
            hint={`您目前沒有 ${service?.name ?? '此服務'} 的剩餘堂數，請先購買。`}
          />
          <EmptyState
            icon={<Package className="size-5" />}
            title="沒有可用的剩餘堂數"
            hint="先購買堂數才能預約"
            cta={<PrimaryCtaLink href={`/${tenantSlug}/packages`}>去購買堂數</PrimaryCtaLink>}
          />
        </main>
      </div>
    )
  }

  // Fetch all active purchases (with package name) for visual radio list
  const { data: rawPurchases } = await supabase
    .from('customer_purchases')
    .select('id, approval_status, classes_total, classes_used, expires_at, service_packages(name)')
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
              : '確認資訊後送出預約申請，等教練確認。'
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
            <span className="text-muted-foreground/60 ml-3 text-2xl">–{format(end, 'HH:mm')}</span>
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

        {/* Cancellation policy */}
        <div className="rounded-2xl border border-border bg-muted/40 p-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            POLICY · 取消政策
          </div>
          <p className="font-cjk mt-2 text-xs leading-relaxed text-muted-foreground">
            開始前{' '}
            <strong className="text-foreground">{service?.cancel_deadline_hours ?? 24} 小時</strong>{' '}
            以上取消，堂數退回；逾期取消或未出席不退回。
          </p>
        </div>

        {/* Submit (preserves existing server action via BookForm) */}
        <BookForm
          slotId={slotId}
          rescheduleFrom={rescheduleFrom ?? null}
          purchases={activePurchases}
          defaultPurchaseId={activePurchase.id}
        />
      </main>
    </div>
  )
}
