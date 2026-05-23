import Link from 'next/link'
import { format } from 'date-fns'
import { Calendar, Settings, MapPin, ExternalLink, UserCircle2 } from 'lucide-react'
import { requireSession } from '@/lib/auth/get-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import PushOptIn from '@/components/push-opt-in'
import CancelMyBookingButton from './cancel-button'

const TZ_OFFSET_HOURS = 8
const toLocal = (iso: string) => new Date(new Date(iso).getTime() + TZ_OFFSET_HOURS * 3600 * 1000)

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-emerald-100 text-emerald-800',
  completed: 'bg-slate-100 text-slate-700',
  cancelled: 'bg-slate-100 text-slate-500',
}
const STATUS_LABELS: Record<string, string> = {
  pending: '待確認',
  confirmed: '已確認',
  completed: '已完成',
  cancelled: '已取消',
}

export default async function MyBookingsPage() {
  const session = await requireSession()
  const supabase = await createSupabaseServerClient()
  const { data: bookings } = await supabase
    .from('bookings')
    .select(
      'id, status, customer_notes, created_at, service_id, tenants(name, slug), services(name, duration_minutes), availability_slots(start_at, end_at)',
    )
    .eq('customer_id', session.userId)
    .order('created_at', { ascending: false })

  const now = new Date()
  const isFuture = (iso: string) => new Date(iso) > now

  const coachStats: Record<
    string,
    { name: string; slug: string; total: number; upcoming: number; latestAt: string }
  > = {}
  for (const b of bookings ?? []) {
    const t = b.tenants as { name: string; slug: string } | null
    if (!t) continue
    const slot = b.availability_slots as { start_at: string } | null
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

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">我的預約</h1>
          <p className="mt-1 text-sm text-muted-foreground">所有預約紀錄與狀態</p>
        </div>
        <Link
          href="/settings/notifications"
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          <Settings className="mr-1 h-3.5 w-3.5" />
          通知設定
        </Link>
      </div>

      <PushOptIn />

      {coaches.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <UserCircle2 className="h-4 w-4" />
            我的教練
            <span className="text-xs font-normal text-muted-foreground">
              （曾預約 {coaches.length} 位）
            </span>
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {coaches.map((c) => (
              <Link
                key={c.slug}
                href={`/${c.slug}`}
                className="group flex items-center justify-between gap-2 rounded-xl border bg-card p-3 transition hover:border-primary/40 hover:shadow-sm"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{c.name}</div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    共 {c.total} 次
                    {c.upcoming > 0 && (
                      <span className="ml-1.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-800">
                        {c.upcoming} 即將到來
                      </span>
                    )}
                  </div>
                </div>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition group-hover:text-primary" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {!bookings || bookings.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Calendar className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 font-medium text-slate-700">尚無預約紀錄</p>
            <p className="mt-1 text-sm text-muted-foreground">透過教練的專屬連結即可預約</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => {
            const tenant = b.tenants as { name: string; slug: string } | null
            const service = b.services as { name: string; duration_minutes: number } | null
            const slot = b.availability_slots as { start_at: string; end_at: string } | null
            const canCancel =
              (b.status === 'pending' || b.status === 'confirmed') &&
              slot &&
              isFuture(slot.start_at)
            return (
              <Card key={b.id} className="overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold">{tenant?.name ?? ''}</h3>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            STATUS_STYLES[b.status] ?? STATUS_STYLES.pending
                          }`}
                        >
                          {STATUS_LABELS[b.status] ?? b.status}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {service?.name} · {service?.duration_minutes} 分
                        </span>
                        {slot && (
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {format(toLocal(slot.start_at), 'yyyy/MM/dd (EEE) HH:mm')}–
                            {format(toLocal(slot.end_at), 'HH:mm')}
                          </span>
                        )}
                      </div>
                      {b.customer_notes && (
                        <div className="mt-2 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
                          備註：{b.customer_notes}
                        </div>
                      )}
                    </div>
                    {canCancel && (
                      <div className="flex shrink-0 flex-col gap-2">
                        {tenant && b.service_id && (
                          <Link
                            href={`/${tenant.slug}?service=${b.service_id}&reschedule=${b.id}`}
                            className="rounded-md border px-2.5 py-1 text-center text-xs font-medium hover:bg-muted"
                          >
                            改時間
                          </Link>
                        )}
                        <CancelMyBookingButton bookingId={b.id} />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
