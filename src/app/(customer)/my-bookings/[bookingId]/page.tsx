import type { ReactNode } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireSession } from '@/lib/auth/get-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getBookingTimeline, type TimelineEntry } from '@/lib/activity-log'
import { getCustomerCancelReasons } from '@/lib/platform-settings'
import { AppError } from '@/lib/errors'
import {
  CANCEL_CATEGORY_LABEL,
  type ActorRole,
  type CancelCategory,
  type ClassDisposition,
} from '@/lib/booking-terms'
import { StatusBadge, type StatusType } from '@/components/ui/badge'
import { BookingTimeline } from '@/components/bookings/booking-timeline'
import { CancelRecord } from '@/components/bookings/cancel-record'
import BookingChangeActions from '../booking-change-actions'
import { formatTaipeiDateTime, formatTaipeiSlotRange } from '@/lib/taipei-time'
import { canCustomerChangeBooking, isLegacyCancel } from '../booking-display'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const STATUS_TYPES: ReadonlyArray<StatusType> = [
  'pending',
  'confirmed',
  'cancelled',
  'completed',
  'no_show',
]
const ACTOR_ROLES: ReadonlyArray<ActorRole> = ['customer', 'owner', 'staff', 'system']
const DISPOSITIONS: ReadonlyArray<ClassDisposition> = ['refunded', 'forfeited', 'transferred']

const TIMELINE_FAILED_MESSAGE = '目前無法取得預約歷程，請稍後再試'
const RESCHEDULE_FAILED_MESSAGE = '目前無法取得改期資料，請稍後再試'

type BookingDetailRow = {
  id: string
  status: string
  customer_notes: string | null
  service_id: string
  cancel_deadline_at: string | null
  cancel_category: string | null
  cancel_reason: string | null
  cancel_actor_role: string | null
  class_disposition: string | null
  cancelled_at: string | null
  rescheduled_from_booking_id: string | null
  tenants: { name: string; slug: string } | null
  services: { name: string; duration_minutes: number; cancel_deadline_hours: number } | null
  availability_slots: { start_at: string; end_at: string } | null
  customer_purchases: { classes_total: number } | null
}

type RelatedBooking = { id: string; startAt: string | null }
/** 改期的另一筆預約：查詢失敗時為 error，不以「沒有改期」頂替（B6.9） */
type RelatedResult = { ok: true; booking: RelatedBooking | null } | { ok: false }

function pick<T extends string>(list: ReadonlyArray<T>, value: string | null): T | null {
  return value !== null && (list as readonly string[]).includes(value) ? (value as T) : null
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="font-mono text-[11px] font-bold tracking-[0.14em] text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </>
  )
}

export default async function MyBookingDetailPage({
  params,
}: {
  params: Promise<{ bookingId: string }>
}) {
  const { bookingId } = await params
  if (!UUID_PATTERN.test(bookingId)) notFound()

  const session = await requireSession()
  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase
    .from('bookings')
    .select(
      'id, status, customer_notes, service_id, cancel_deadline_at, cancel_category, cancel_reason, cancel_actor_role, class_disposition, cancelled_at, rescheduled_from_booking_id, tenants(name, slug), services(name, duration_minutes, cancel_deadline_hours), availability_slots(start_at, end_at), customer_purchases(classes_total)',
    )
    .eq('id', bookingId)
    .eq('customer_id', session.userId)
    .maybeSingle()

  if (error) {
    console.error('[my-bookings] 讀取預約明細失敗', error)
    throw new AppError('BOOKING_LOAD_FAILED', '目前無法取得預約資料，請稍後再試')
  }
  // 查不到、或不是自己的預約：一律當作不存在，不透露這筆預約是否存在
  if (!data) notFound()

  const b = data as unknown as BookingDetailRow
  const tenant = b.tenants
  const service = b.services
  const slot = b.availability_slots
  const now = new Date()
  const canChange = canCustomerChangeBooking(b.status, slot?.start_at, now)
  const isCancelled = b.status === 'cancelled'
  const rescheduledOut = isCancelled && b.cancel_category === 'rescheduled'

  const loadRelated = async (
    query: PromiseLike<{
      data: { id: string; availability_slots: { start_at: string } | null }[] | null
      error: unknown
    }>,
  ): Promise<RelatedResult> => {
    const res = await query
    if (res.error) {
      console.error('[my-bookings] 讀取改期預約失敗', res.error)
      return { ok: false }
    }
    const row = res.data?.[0]
    return {
      ok: true,
      booking: row ? { id: row.id, startAt: row.availability_slots?.start_at ?? null } : null,
    }
  }

  const [timeline, rescheduledFrom, rescheduledTo, cancelReasons] = await Promise.all([
    getBookingTimeline(supabase, b.id).then(
      (entries): { ok: true; entries: TimelineEntry[] } => ({ ok: true, entries }),
      (e: unknown): { ok: false; message: string } => ({
        ok: false,
        message: e instanceof AppError ? e.message : TIMELINE_FAILED_MESSAGE,
      }),
    ),
    b.rescheduled_from_booking_id
      ? loadRelated(
          supabase
            .from('bookings')
            .select('id, availability_slots(start_at)')
            .eq('id', b.rescheduled_from_booking_id)
            .eq('customer_id', session.userId)
            .limit(1),
        )
      : null,
    rescheduledOut
      ? loadRelated(
          supabase
            .from('bookings')
            .select('id, availability_slots(start_at)')
            .eq('rescheduled_from_booking_id', b.id)
            .eq('customer_id', session.userId)
            .order('created_at', { ascending: false })
            .limit(1),
        )
      : null,
    // 讀取失敗時為 null（錯誤已在 getCustomerCancelReasons 內記錄），改顯示無法取消
    canChange ? getCustomerCancelReasons(supabase).catch(() => null) : null,
  ])

  const relatedLink = (result: RelatedResult, text: (when: string) => string, fallback: string) => {
    if (!result.ok)
      return <span className="text-muted-foreground">{RESCHEDULE_FAILED_MESSAGE}</span>
    if (!result.booking) return fallback
    const when = result.booking.startAt ? formatTaipeiDateTime(result.booking.startAt) : null
    return (
      <Link
        href={`/my-bookings/${result.booking.id}`}
        className="underline underline-offset-[3px] hover:text-muted-foreground"
      >
        {when ? text(when) : fallback}
      </Link>
    )
  }

  const category = pick(Object.keys(CANCEL_CATEGORY_LABEL) as CancelCategory[], b.cancel_category)

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-[800px] px-5 py-10 sm:px-10 sm:py-12">
        <Link
          href="/my-bookings"
          className="font-cjk text-sm text-muted-foreground hover:text-foreground"
        >
          ← 我的預約
        </Link>

        <div className="mt-4 flex flex-col gap-6 rounded-2xl border border-border bg-card px-5 py-5 sm:px-6 sm:py-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="font-mono mb-1 text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
                {tenant?.name ?? '—'}
                {service?.duration_minutes != null && <> · {service.duration_minutes} MIN</>}
              </div>
              <h1 className="font-display font-cjk text-[22px] font-black leading-tight">
                {service?.name ?? '—'}
              </h1>
            </div>
            <StatusBadge status={pick(STATUS_TYPES, b.status) ?? 'pending'} />
          </div>

          <Section title="預約資料">
            <dl className="font-cjk grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              <Row label="上課時間">
                {slot ? formatTaipeiSlotRange(slot.start_at, slot.end_at) : '—'}
              </Row>
              <Row label="教練">
                {tenant ? (
                  <Link
                    href={`/${tenant.slug}`}
                    className="underline underline-offset-[3px] hover:text-muted-foreground"
                  >
                    {tenant.name}
                  </Link>
                ) : (
                  '—'
                )}
              </Row>
              {b.customer_purchases && (
                <Row label="使用堂數">{b.customer_purchases.classes_total} 堂課的其中 1 堂</Row>
              )}
              {b.cancel_deadline_at && (
                <Row label="取消期限">
                  {formatTaipeiDateTime(b.cancel_deadline_at)} 前可自行取消
                </Row>
              )}
              {rescheduledFrom && (
                <Row label="改期">
                  {relatedLink(
                    rescheduledFrom,
                    (when) => `由 ${when} 的預約改期而來`,
                    '由另一筆預約改期而來',
                  )}
                </Row>
              )}
              {rescheduledTo && (
                <Row label="改期">
                  {relatedLink(rescheduledTo, (when) => `已改期到 ${when}`, '已改期到新的時段')}
                </Row>
              )}
              {b.customer_notes && <Row label="我的備註">{b.customer_notes}</Row>}
            </dl>
          </Section>

          {isCancelled && (
            <Section title="取消紀錄">
              <CancelRecord
                viewer="customer"
                // 沒有取消類別的舊預約一律視為改版前取消（isLegacyCancel）
                category={category && !isLegacyCancel(category) ? category : 'legacy'}
                reason={b.cancel_reason}
                actorRole={pick(ACTOR_ROLES, b.cancel_actor_role)}
                cancelledAt={b.cancelled_at}
                disposition={pick(DISPOSITIONS, b.class_disposition)}
              />
            </Section>
          )}

          <Section title="歷程">
            {timeline.ok ? (
              <BookingTimeline entries={timeline.entries} viewer="customer" />
            ) : (
              <p className="font-cjk text-sm text-muted-foreground">{timeline.message}</p>
            )}
          </Section>

          {canChange && (
            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-5">
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
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
