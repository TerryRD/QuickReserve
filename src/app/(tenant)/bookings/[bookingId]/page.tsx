import type { ReactNode } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { z } from 'zod'
import { requireTenantMember } from '@/lib/auth/get-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getBookingTimeline, type TimelineEntry } from '@/lib/activity-log'
import { AppError } from '@/lib/errors'
import type { ActorRole } from '@/lib/booking-terms'
import { Card, CardContent } from '@/components/ui/card'
import { BookingTimeline } from '@/components/bookings/booking-timeline'
import { CancelRecord } from '@/components/bookings/cancel-record'
import { BookingActionButtons } from '../booking-actions'
import { canActOnBooking, loadTenantMembers, type MemberInfo } from '../booking-access'
import { formatTaipeiDateTime, formatTaipeiSlotRange } from '@/lib/taipei-time'
import { STATUS_STYLES, asCategory, asDisposition, statusLabel } from '../booking-display'

const TIMELINE_FAILED_MESSAGE = '目前無法取得預約歷程，請稍後再試'
const ACTOR_ROLES: readonly string[] = ['customer', 'owner', 'staff', 'system']

type SlotTime = { start_at: string } | null

/**
 * 取消人的名稱（bookings.cancelled_by 對應的使用者）。學員用預約上的學員名稱；成員用成員清單。
 * 系統取消、查不到（例如助教看不到其他成員）時回傳 null，畫面只顯示身分。
 */
function cancelActorDisplayName(
  role: ActorRole | null,
  cancelledBy: string | null,
  ctx: { customerId: string; customerName: string | null; members: MemberInfo[] },
): string | null {
  if (!role || role === 'system' || !cancelledBy) return null
  if (role === 'customer') return cancelledBy === ctx.customerId ? ctx.customerName : null
  return ctx.members.find((m) => m.userId === cancelledBy)?.name ?? null
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-16 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1 break-words">{children}</dd>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <h2 className="text-sm font-semibold">{title}</h2>
        {children}
      </CardContent>
    </Card>
  )
}

export default async function TenantBookingDetailPage({
  params,
}: {
  params: Promise<{ bookingId: string }>
}) {
  const session = await requireTenantMember()
  const { bookingId } = await params
  if (!z.string().uuid().safeParse(bookingId).success) notFound()

  const supabase = await createSupabaseServerClient()
  const { data: booking, error } = await supabase
    .from('bookings')
    .select(
      'id, status, customer_id, customer_notes, cancel_deadline_at, cancel_category, cancel_reason, cancel_actor_role, cancelled_by, cancelled_at, class_disposition, rescheduled_from_booking_id, customers(display_name), services(name, duration_minutes), availability_slots(start_at, end_at, member_id), customer_purchases(classes_total, classes_used)',
    )
    .eq('id', bookingId)
    .eq('tenant_id', session.tenantId)
    .maybeSingle()
  if (error) {
    console.error('[bookings] 讀取預約明細失敗', error)
    throw new Error('讀取預約明細失敗')
  }
  if (!booking) notFound()

  const customer = booking.customers as { display_name: string | null } | null
  const service = booking.services as { name: string; duration_minutes: number } | null
  const slot = booking.availability_slots as {
    start_at: string
    end_at: string
    member_id: string
  } | null
  const purchase = booking.customer_purchases as {
    classes_total: number
    classes_used: number
  } | null

  // 是否為這個時段的教練（或 Owner）：在伺服器端依時段的負責成員判斷
  const canAct = canActOnBooking(session, slot?.member_id)
  const actionable = booking.status === 'pending' || booking.status === 'confirmed'

  const [members, rescheduledFrom, rescheduledTo, timeline] = await Promise.all([
    loadTenantMembers(supabase, session.tenantId),
    booking.rescheduled_from_booking_id
      ? supabase
          .from('bookings')
          .select('id, availability_slots(start_at)')
          .eq('id', booking.rescheduled_from_booking_id)
          .eq('tenant_id', session.tenantId)
          .maybeSingle()
      : null,
    supabase
      .from('bookings')
      .select('id, availability_slots(start_at)')
      .eq('rescheduled_from_booking_id', booking.id)
      .eq('tenant_id', session.tenantId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    canAct
      ? getBookingTimeline(supabase, booking.id, { withActorNames: true }).then(
          (entries): { entries: TimelineEntry[] } | { error: string } => ({ entries }),
          (e: unknown) => ({ error: e instanceof AppError ? e.message : TIMELINE_FAILED_MESSAGE }),
        )
      : null,
  ])
  if (rescheduledFrom?.error || rescheduledTo.error) {
    console.error('[bookings] 讀取改期關聯失敗', rescheduledFrom?.error ?? rescheduledTo.error)
    throw new Error('讀取改期關聯失敗')
  }

  const slotCoach = slot ? members.find((m) => m.id === slot.member_id) : undefined
  const fromStart = (rescheduledFrom?.data?.availability_slots as SlotTime)?.start_at
  const toStart = (rescheduledTo.data?.availability_slots as SlotTime)?.start_at

  const cancelCategory = booking.status === 'cancelled' ? asCategory(booking.cancel_category) : null
  const cancelActorRole =
    booking.cancel_actor_role && ACTOR_ROLES.includes(booking.cancel_actor_role)
      ? (booking.cancel_actor_role as ActorRole)
      : null
  const cancelActorName = cancelCategory
    ? cancelActorDisplayName(cancelActorRole, booking.cancelled_by, {
        customerId: booking.customer_id,
        customerName: customer?.display_name ?? null,
        members,
      })
    : null

  return (
    <div className="space-y-6">
      <Link href="/bookings" className="text-sm text-muted-foreground hover:text-foreground">
        ← 預約管理
      </Link>

      <header>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">
            {customer?.display_name ?? '匿名學員'}
          </h1>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
              STATUS_STYLES[booking.status] ?? STATUS_STYLES.pending
            }`}
          >
            {statusLabel(booking.status)}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {service?.name} · {service?.duration_minutes} 分
          {slot && ` · ${formatTaipeiSlotRange(slot.start_at, slot.end_at)}`}
        </p>
      </header>

      <Section title="預約資料">
        <dl className="flex flex-col gap-1.5 text-sm">
          <Row label="時段教練">{slotCoach?.name ?? '—'}</Row>
          <Row label="使用堂數">
            {purchase
              ? `${purchase.classes_total} 堂課的其中 1 堂（剩餘 ${Math.max(
                  purchase.classes_total - purchase.classes_used,
                  0,
                )} 堂）`
              : '—'}
          </Row>
          <Row label="取消期限">
            {booking.cancel_deadline_at ? formatTaipeiDateTime(booking.cancel_deadline_at) : '—'}
          </Row>
          {booking.customer_notes && <Row label="學員備註">{booking.customer_notes}</Row>}
          {rescheduledFrom?.data && (
            <Row label="改期">
              <Link
                href={`/bookings/${rescheduledFrom.data.id}`}
                className="underline underline-offset-2"
              >
                {fromStart
                  ? `由 ${formatTaipeiDateTime(fromStart)} 的預約改期而來`
                  : '由另一筆預約改期而來'}
              </Link>
            </Row>
          )}
          {rescheduledTo.data && (
            <Row label="改期">
              <Link
                href={`/bookings/${rescheduledTo.data.id}`}
                className="underline underline-offset-2"
              >
                {toStart ? `已改期到 ${formatTaipeiDateTime(toStart)}` : '已改期到另一筆預約'}
              </Link>
            </Row>
          )}
        </dl>
      </Section>

      {cancelCategory && (
        <Section title="取消紀錄">
          <CancelRecord
            viewer="tenant"
            category={cancelCategory}
            reason={booking.cancel_reason}
            actorRole={cancelActorRole}
            cancelledAt={booking.cancelled_at}
            disposition={asDisposition(booking.class_disposition)}
            actorName={cancelActorName}
          />
        </Section>
      )}

      {canAct && timeline ? (
        <>
          <Section title="歷程">
            {'entries' in timeline ? (
              <BookingTimeline entries={timeline.entries} viewer="tenant" />
            ) : (
              <p className="text-sm text-rose-600">{timeline.error}</p>
            )}
          </Section>
          {actionable && (
            <div className="flex flex-wrap gap-2">
              <BookingActionButtons
                bookingId={booking.id}
                bookingStatus={booking.status as 'pending' | 'confirmed'}
              />
            </div>
          )}
        </>
      ) : (
        <div className="rounded-md bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
          只有這個時段的教練或 Owner 可以查看歷程和操作這筆預約。
        </div>
      )}
    </div>
  )
}
