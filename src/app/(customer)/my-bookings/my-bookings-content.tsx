import Link from 'next/link'
import { format } from 'date-fns'
import { Calendar } from 'lucide-react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { StatusBadge, type StatusType } from '@/components/ui/badge'
import { KpiCard } from '@/components/ui/kpi-card'
import { DateStrip, type DateStripGroup } from '@/components/bookings/date-strip'
import CancelMyBookingButton from './cancel-button'

const TZ_OFFSET_HOURS = 8
const toLocal = (iso: string) =>
  new Date(new Date(iso).getTime() + TZ_OFFSET_HOURS * 3600 * 1000)

const STATUS_TYPES: ReadonlyArray<StatusType> = ['pending', 'confirmed', 'cancelled', 'completed']
function asStatus(s: string): StatusType {
  return (STATUS_TYPES as readonly string[]).includes(s) ? (s as StatusType) : 'pending'
}

type BookingRow = {
  id: string
  status: string
  customer_notes: string | null
  created_at: string
  service_id: string
  tenants: { name: string; slug: string } | null
  services: { name: string; duration_minutes: number } | null
  availability_slots: { start_at: string; end_at: string } | null
}

const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六'] as const

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
  '今日': 'today',
  '本週': 'thisWeek',
  '之後': 'later',
  '已過': 'past',
  '其他': 'past',
}

function BookingCard({ b }: { b: BookingRow }) {
  const tenant = b.tenants
  const service = b.services
  const slot = b.availability_slots
  const isCancelledOrCompleted = b.status === 'cancelled' || b.status === 'completed'
  const canCancel =
    (b.status === 'pending' || b.status === 'confirmed') &&
    slot &&
    new Date(slot.start_at) > new Date()

  const start = slot ? toLocal(slot.start_at) : null
  const day = start?.getDate()
  const month = start ? String(start.getMonth() + 1).padStart(2, '0') : ''
  const year = start?.getFullYear()
  const weekday = start ? WEEKDAY[start.getDay()] : ''
  const time = start ? format(start, 'HH:mm') : ''

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
              {tenant?.name ?? '—'}
              {service?.duration_minutes != null && (
                <> · {service.duration_minutes} MIN</>
              )}
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

        {canCancel ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {tenant && b.service_id && (
              <Button
                variant="secondary"
                size="sm"
                render={
                  <Link
                    href={`/${tenant.slug}?service=${b.service_id}&reschedule=${b.id}`}
                  />
                }
              >
                <Calendar className="size-3" /> 改期
              </Button>
            )}
            <CancelMyBookingButton bookingId={b.id} />
            {tenant && (
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto text-muted-foreground"
                render={<Link href={`/${tenant.slug}`} />}
              >
                查看詳情
              </Button>
            )}
          </div>
        ) : (
          <div className="font-mono mt-2 text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">
            {b.status === 'completed'
              ? '已完成 · 期待下次見面'
              : b.status === 'cancelled'
                ? '已取消 · 不會佔用套裝堂數'
                : ''}
          </div>
        )}
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

  const [
    bookingsRes,
    pendingCountRes,
    completedCountRes,
    cancelledCountRes,
  ] = await Promise.all([
    supabase
      .from('bookings')
      .select(
        'id, status, customer_notes, created_at, service_id, tenants(name, slug), services(name, duration_minutes), availability_slots(start_at, end_at)',
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
  ])

  const bookings = (bookingsRes.data ?? []) as BookingRow[]
  const pendingCount = pendingCountRes.count ?? 0
  const completedCount = completedCountRes.count ?? 0
  const cancelledCount = cancelledCountRes.count ?? 0

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
          hint="教練核可中"
          accent={pendingCount > 0}
        />
        <KpiCard label="已完成" value={completedCount} unit="筆" />
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
                    <BookingCard key={b.id} b={b} />
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
