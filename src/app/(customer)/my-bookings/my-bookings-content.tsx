import Link from 'next/link'
import { Calendar } from 'lucide-react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { StatusBadge, type StatusType } from '@/components/ui/badge'
import { KpiCard } from '@/components/ui/kpi-card'
import { DateStrip, type DateStripGroup } from '@/components/bookings/date-strip'
import BookingChangeActions from './booking-change-actions'
import CheckinButton from './checkin-button'
import { canCheckIn } from '@/lib/checkin-window'
import { getCustomerCancelReasons } from '@/lib/platform-settings'
import { formatTaipeiTime, taipeiParts } from '@/lib/taipei-time'
import {
  canCustomerChangeBooking,
  cancelOutcomeText,
  cancelSummaryLine,
  resolveMyBookingsView,
  type CancelInfo,
} from './booking-display'

const STATUS_TYPES: ReadonlyArray<StatusType> = [
  'pending',
  'confirmed',
  'cancelled',
  'completed',
  'no_show',
]
function asStatus(s: string): StatusType {
  return (STATUS_TYPES as readonly string[]).includes(s) ? (s as StatusType) : 'pending'
}

type BookingRow = {
  id: string
  status: string
  customer_notes: string | null
  created_at: string
  service_id: string
  checked_in_at: string | null
  cancel_deadline_at: string | null
  cancel_category: string | null
  cancel_reason: string | null
  cancel_actor_role: string | null
  class_disposition: string | null
  tenants: { name: string; slug: string } | null
  services: { name: string; duration_minutes: number; cancel_deadline_hours: number } | null
  availability_slots: { start_at: string; end_at: string } | null
}

function groupKey(slotStart: string | undefined, status: string, now: Date): string {
  if (status === 'cancelled' || status === 'completed') return '已過'
  if (!slotStart) return '其他'
  const start = new Date(slotStart)
  const diffMs = start.getTime() - now.getTime()
  const dayMs = 24 * 3600 * 1000
  if (start < now) return '已過'
  if (diffMs < dayMs) return '今日'
  if (diffMs < 7 * dayMs) return '本週'
  return '之後'
}

const GROUP_ORDER = ['今日', '本週', '之後', '已過', '其他']

const groupKeyMap: Record<string, DateStripGroup> = {
  今日: 'today',
  本週: 'thisWeek',
  之後: 'later',
  已過: 'past',
  其他: 'past',
}

function BookingCard({ b, cancelReasons }: { b: BookingRow; cancelReasons: string[] | null }) {
  const tenant = b.tenants
  const service = b.services
  const slot = b.availability_slots
  const isCancelledOrCompleted = b.status === 'cancelled' || b.status === 'completed'
  const canCancel = canCustomerChangeBooking(b.status, slot?.start_at, new Date())
  const cancelInfo: CancelInfo = {
    category: b.cancel_category,
    reason: b.cancel_reason,
    actorRole: b.cancel_actor_role,
    disposition: b.class_disposition,
  }
  const cancelSummary = b.status === 'cancelled' ? cancelSummaryLine(cancelInfo) : null

  // Render-time visibility gate only; checkin_booking RPC is the authoritative check.
  const canDoCheckin =
    b.status === 'confirmed' &&
    !b.checked_in_at &&
    !!slot &&
    canCheckIn(new Date(), slot.start_at, slot.end_at)

  const start = slot ? taipeiParts(slot.start_at) : null
  const day = start?.day
  const month = start ? String(start.month).padStart(2, '0') : ''
  const year = start?.year
  const weekday = start?.weekday ?? ''
  const time = slot ? formatTaipeiTime(slot.start_at) : ''

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-2xl border border-border bg-card sm:flex-row ${
        isCancelledOrCompleted ? 'opacity-70' : ''
      }`}
    >
      <div className="flex w-full shrink-0 flex-row items-center gap-3.5 border-b border-border bg-muted px-5 py-4 sm:w-[132px] sm:flex-col sm:items-start sm:gap-1.5 sm:border-b-0 sm:border-r sm:px-[18px] sm:py-6">
        <div className="flex items-baseline gap-1.5">
          <span className="font-display text-[32px] font-normal leading-none sm:text-[44px]">
            {day ?? '—'}
          </span>
          <span className="font-mono text-[11px] tracking-[0.1em] text-muted-foreground">
            /{month}
          </span>
        </div>
        {start && (
          <>
            <div className="font-cjk text-[11px] tracking-[0.05em] text-muted-foreground">
              {year} · 週{weekday}
            </div>
            <div className="font-display text-[18px] font-normal tracking-[0.02em] sm:mt-auto sm:text-[22px]">
              {time}
            </div>
          </>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2.5 px-5 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="font-mono mb-1 text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
              {tenant ? (
                <Link
                  href={`/${tenant.slug}`}
                  className="underline-offset-2 hover:text-foreground hover:underline"
                >
                  {tenant.name}
                </Link>
              ) : (
                '—'
              )}
              {service?.duration_minutes != null && <> · {service.duration_minutes} MIN</>}
            </div>
            <h3 className="font-display font-cjk text-lg font-black leading-tight sm:text-[22px]">
              {service?.name ?? '—'}
            </h3>
          </div>
          <StatusBadge status={asStatus(b.status)} />
        </div>

        {b.customer_notes && (
          <div className="font-cjk rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
            <span className="font-mono mr-1 uppercase tracking-wider text-foreground/70">
              NOTE ·
            </span>
            {b.customer_notes}
          </div>
        )}

        {cancelSummary && (
          <div
            className="font-cjk truncate rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground"
            title={cancelSummary}
          >
            {cancelSummary}
          </div>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-2">
          {canDoCheckin && <CheckinButton bookingId={b.id} />}
          {canCancel ? (
            <BookingChangeActions
              bookingId={b.id}
              status={b.status}
              tenantSlug={tenant?.slug ?? null}
              serviceId={b.service_id}
              startAt={slot?.start_at ?? null}
              cancelDeadlineAt={b.cancel_deadline_at}
              cancelDeadlineHours={service?.cancel_deadline_hours ?? null}
              cancelReasons={cancelReasons}
            />
          ) : (
            !canDoCheckin && (
              <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">
                {b.status === 'completed'
                  ? b.checked_in_at
                    ? `已簽到 · ${formatTaipeiTime(b.checked_in_at)}`
                    : '已出席 · 期待下次見面'
                  : b.status === 'cancelled'
                    ? cancelOutcomeText(cancelInfo)
                    : b.status === 'no_show'
                      ? '未出席 · 不退回此堂'
                      : ''}
              </span>
            )
          )}
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto text-muted-foreground"
            render={<Link href={`/my-bookings/${b.id}`} />}
          >
            查看明細
          </Button>
        </div>
      </div>
    </div>
  )
}

/**
 * Streamed body — KPI cards + grouped bookings list.
 * Wrapped in <Suspense> in the page shell so hero + push-opt-in render fast.
 */
export default async function MyBookingsContent({ userId }: { userId: string }) {
  const supabase = await createSupabaseServerClient()

  const [bookingsRes, pendingCountRes, completedCountRes, cancelledCountRes, cancelReasons] =
    await Promise.all([
      supabase
        .from('bookings')
        .select(
          'id, status, customer_notes, created_at, service_id, checked_in_at, cancel_deadline_at, cancel_category, cancel_reason, cancel_actor_role, class_disposition, tenants(name, slug), services(name, duration_minutes, cancel_deadline_hours), availability_slots(start_at, end_at)',
        )
        .eq('customer_id', userId)
        .order('created_at', { ascending: false }),
      supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('customer_id', userId)
        .eq('status', 'pending'),
      supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('customer_id', userId)
        .eq('status', 'completed'),
      supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('customer_id', userId)
        .eq('status', 'cancelled'),
      // 讀取失敗時為 null（錯誤已在 getCustomerCancelReasons 內記錄），卡片改顯示無法取消
      getCustomerCancelReasons(supabase).catch(() => null),
    ])

  const view = resolveMyBookingsView({
    bookings: { data: bookingsRes.data as BookingRow[] | null, error: bookingsRes.error },
    pending: pendingCountRes,
    completed: completedCountRes,
    cancelled: cancelledCountRes,
  })
  if (!view.ok) {
    console.error('[my-bookings] 讀取預約失敗', view.failures)
    return (
      <div className="mt-8 rounded-2xl border border-dashed border-border bg-muted/40 p-16 text-center">
        <Calendar className="mx-auto size-10 text-muted-foreground" />
        <p className="font-cjk mt-4 text-sm text-muted-foreground">目前無法取得預約，請稍後再試</p>
      </div>
    )
  }
  const { bookings, pendingCount, completedCount, cancelledCount } = view

  const now = new Date()
  const weekAhead = new Date(now.getTime() + 7 * 24 * 3600 * 1000)
  const thisWeekCount = bookings.filter((b) => {
    if (b.status !== 'pending' && b.status !== 'confirmed') return false
    const start = b.availability_slots?.start_at
    if (!start) return false
    const t = new Date(start)
    return t >= now && t <= weekAhead
  }).length

  const grouped: Record<string, BookingRow[]> = {}
  for (const b of bookings) {
    const key = groupKey(b.availability_slots?.start_at, b.status, now)
    grouped[key] = grouped[key] ?? []
    grouped[key].push(b)
  }

  return (
    <>
      <section className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="本週" value={thisWeekCount} unit="筆" hint="未來 7 天" />
        <KpiCard
          label="待回覆"
          value={pendingCount}
          unit="筆"
          hint="等教練確認"
          accent={pendingCount > 0}
        />
        <KpiCard label="已出席" value={completedCount} unit="筆" />
        <KpiCard label="已取消" value={cancelledCount} unit="筆" />
      </section>

      {bookings.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border bg-muted/40 p-16 text-center">
          <Calendar className="mx-auto size-10 text-muted-foreground" />
          <div className="font-mono mt-4 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            NO BOOKINGS
          </div>
          <p className="font-cjk mt-2 text-sm text-muted-foreground">
            尚無預約紀錄。透過教練的專屬連結即可預約。
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          {GROUP_ORDER.filter((g) => grouped[g] && grouped[g].length > 0).map((g) => {
            const items = grouped[g]!
            return (
              <section key={g} className="space-y-3.5">
                <DateStrip groupKey={groupKeyMap[g] ?? 'past'} count={items.length} />
                <div className="flex flex-col gap-3">
                  {items.map((b) => (
                    <BookingCard key={b.id} b={b} cancelReasons={cancelReasons} />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </>
  )
}

export function MyBookingsContentSkeleton() {
  return (
    <>
      <section className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-2xl border border-border bg-muted/40"
          />
        ))}
      </section>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-32 animate-pulse rounded-2xl border border-border bg-muted/40"
            style={{ animationDelay: `${i * 80}ms` }}
          />
        ))}
      </div>
    </>
  )
}
