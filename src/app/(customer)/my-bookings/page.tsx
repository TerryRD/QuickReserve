import Link from 'next/link'
import { format } from 'date-fns'
import { Calendar, Settings, ExternalLink } from 'lucide-react'
import { requireSession } from '@/lib/auth/get-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge, StatusBadge, type StatusType } from '@/components/ui/badge'
import { SectionHead } from '@/components/ui/section-head'
import PushOptIn from '@/components/push-opt-in'
import CancelMyBookingButton from './cancel-button'

const TZ_OFFSET_HOURS = 8
const toLocal = (iso: string) => new Date(new Date(iso).getTime() + TZ_OFFSET_HOURS * 3600 * 1000)

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

export default async function MyBookingsPage() {
  const session = await requireSession()
  const supabase = await createSupabaseServerClient()
  const { data: bookingsRaw } = await supabase
    .from('bookings')
    .select(
      'id, status, customer_notes, created_at, service_id, tenants(name, slug), services(name, duration_minutes), availability_slots(start_at, end_at)',
    )
    .eq('customer_id', session.userId)
    .order('created_at', { ascending: false })

  const bookings = (bookingsRaw ?? []) as BookingRow[]
  const now = new Date()
  const isFuture = (iso: string) => new Date(iso) > now

  const coachStats: Record<
    string,
    { name: string; slug: string; total: number; upcoming: number; latestAt: string }
  > = {}
  for (const b of bookings) {
    const t = b.tenants
    if (!t) continue
    const slot = b.availability_slots
    const entry = coachStats[t.slug] ?? {
      name: t.name,
      slug: t.slug,
      total: 0,
      upcoming: 0,
      latestAt: b.created_at,
    }
    entry.total += 1
    if (slot && isFuture(slot.start_at) && (b.status === 'pending' || b.status === 'confirmed')) {
      entry.upcoming += 1
    }
    if (b.created_at > entry.latestAt) entry.latestAt = b.created_at
    coachStats[t.slug] = entry
  }
  const coaches = Object.values(coachStats).sort((a, b) => b.total - a.total)

  const grouped: Record<string, BookingRow[]> = {}
  for (const b of bookings) {
    const key = groupKey(b.availability_slots?.start_at, b.status, now)
    grouped[key] = grouped[key] ?? []
    grouped[key].push(b)
  }

  return (
    <div className="space-y-10">
      <SectionHead
        kicker="MY BOOKINGS · 我的預約"
        title="我的預約"
        eng="BOOKINGS"
        hint={`目前有 ${bookings.length} 筆預約紀錄`}
        right={
          <Button variant="pill-outline" size="pill" render={<Link href="/settings/notifications" />}>
            <Settings className="size-3.5" />
            <span className="font-cjk">通知設定</span>
          </Button>
        }
      />

      <PushOptIn />

      {coaches.length > 0 && (
        <section>
          <div className="mb-3 flex flex-wrap items-baseline gap-3">
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              MY COACHES · 我的教練（共 {coaches.length} 位）
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {coaches.map((c) => (
              <Link
                key={c.slug}
                href={`/${c.slug}`}
                className="group flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 transition hover:border-foreground/40 hover:shadow-[0_8px_24px_-18px_rgba(0,0,0,0.25)]"
              >
                <div className="min-w-0">
                  <div className="font-cjk truncate text-sm font-semibold">{c.name}</div>
                  <div className="font-mono mt-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                    <span>{c.total} 次</span>
                    {c.upcoming > 0 && (
                      <Badge variant="yellow" className="px-2 py-0.5 text-[9px]">
                        {c.upcoming} 即將
                      </Badge>
                    )}
                  </div>
                </div>
                <ExternalLink className="size-3.5 shrink-0 text-muted-foreground transition group-hover:text-foreground" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {bookings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-16 text-center">
          <Calendar className="mx-auto size-10 text-muted-foreground" />
          <div className="font-mono mt-4 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            NO BOOKINGS
          </div>
          <p className="font-cjk mt-2 text-sm text-muted-foreground">
            尚無預約紀錄。透過教練的專屬連結即可預約。
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {GROUP_ORDER.filter((g) => grouped[g] && grouped[g].length > 0).map((g) => (
            <section key={g}>
              <div className="mb-3 flex items-baseline gap-3">
                <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  {g}
                </div>
                <div className="font-mono text-[10px] tracking-wider text-muted-foreground">
                  {String(grouped[g]!.length).padStart(2, '0')} ITEMS
                </div>
              </div>
              <div className="space-y-3">
                {grouped[g]!.map((b) => {
                  const tenant = b.tenants
                  const service = b.services
                  const slot = b.availability_slots
                  const canCancel =
                    (b.status === 'pending' || b.status === 'confirmed') &&
                    slot &&
                    isFuture(slot.start_at)
                  return (
                    <div
                      key={b.id}
                      className="rounded-2xl border border-border bg-card p-5 shadow-[0_1px_0_var(--border),0_8px_24px_-18px_rgba(0,0,0,0.18)]"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-display font-cjk text-lg font-black">
                              {tenant?.name ?? ''}
                            </h3>
                            <StatusBadge status={asStatus(b.status)} />
                          </div>
                          <div className="font-cjk mt-2 text-sm font-medium">
                            {service?.name}
                            <span className="ml-2 text-muted-foreground">
                              {service?.duration_minutes} 分
                            </span>
                          </div>
                          {slot && (
                            <div className="font-mono mt-1.5 text-xs tracking-wider text-muted-foreground">
                              {format(toLocal(slot.start_at), 'yyyy/MM/dd (EEE) HH:mm')}–
                              {format(toLocal(slot.end_at), 'HH:mm')}
                            </div>
                          )}
                          {b.customer_notes && (
                            <div className="font-cjk mt-3 rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
                              <span className="font-mono uppercase tracking-wider text-foreground/70">
                                NOTE ·{' '}
                              </span>
                              {b.customer_notes}
                            </div>
                          )}
                        </div>
                        {canCancel && (
                          <div className="flex shrink-0 flex-col gap-2">
                            {tenant && b.service_id && (
                              <Button
                                variant="pill-outline"
                                size="sm"
                                render={
                                  <Link
                                    href={`/${tenant.slug}?service=${b.service_id}&reschedule=${b.id}`}
                                  />
                                }
                              >
                                改時間
                              </Button>
                            )}
                            <CancelMyBookingButton bookingId={b.id} />
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
