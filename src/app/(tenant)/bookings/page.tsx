import Link from 'next/link'
import { Calendar, ClipboardList, User } from 'lucide-react'
import { requireTenantMember } from '@/lib/auth/get-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { BookingActionButtons } from './booking-actions'
import { canActOnBooking, loadTenantMembers } from './booking-access'
import { formatTaipeiSlotRange } from '@/lib/taipei-time'
import { STATUS_STYLES, cancelSummary, statusLabel } from './booking-display'

export default async function TenantBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const session = await requireTenantMember()
  const { status: filter } = await searchParams
  const supabase = await createSupabaseServerClient()

  let query = supabase
    .from('bookings')
    .select(
      'id, status, customer_notes, customer_id, created_at, cancel_category, cancel_reason, class_disposition, customers(display_name), services(name, duration_minutes), availability_slots(start_at, end_at, member_id)',
    )
    .order('created_at', { ascending: false })
  if (filter && filter !== 'all') query = query.eq('status', filter)
  const { data: bookings, error } = await query
  if (error) {
    console.error('[bookings] 讀取預約失敗', error)
    throw new Error('讀取預約失敗')
  }

  // 助教看到別人時段的預約時，要標出是誰的時段
  const memberNames =
    session.role === 'tenant_staff'
      ? new Map((await loadTenantMembers(supabase, session.tenantId)).map((m) => [m.id, m.name]))
      : null

  const filters = [
    { key: 'all', label: '全部' },
    { key: 'pending', label: statusLabel('pending') },
    { key: 'confirmed', label: statusLabel('confirmed') },
    { key: 'completed', label: statusLabel('completed') },
    { key: 'no_show', label: statusLabel('no_show') },
    { key: 'cancelled', label: statusLabel('cancelled') },
  ]
  const activeFilter = filter ?? 'all'

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">預約管理</h1>
        <p className="mt-1 text-sm text-muted-foreground">確認、取消、查看所有預約</p>
      </header>

      <div className="flex flex-wrap gap-1">
        {filters.map((f) => (
          <a
            key={f.key}
            href={`/bookings${f.key === 'all' ? '' : `?status=${f.key}`}`}
            className={`rounded-full border px-3 py-1.5 text-xs transition ${
              activeFilter === f.key
                ? 'border-primary bg-primary text-primary-foreground font-medium'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
            }`}
          >
            {f.label}
          </a>
        ))}
      </div>

      {!bookings || bookings.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <ClipboardList className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 text-sm text-muted-foreground">尚無預約</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => {
            const customer = b.customers as { display_name: string | null } | null
            const service = b.services as { name: string; duration_minutes: number } | null
            const slot = b.availability_slots as {
              start_at: string
              end_at: string
              member_id: string
            } | null
            const canAct = canActOnBooking(session, slot?.member_id)
            const actionable = b.status === 'pending' || b.status === 'confirmed'
            const slotOwnerName =
              !canAct && memberNames && slot ? (memberNames.get(slot.member_id) ?? null) : null
            const summary = b.status === 'cancelled' ? cancelSummary(b) : null
            return (
              <Card key={b.id}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="inline-flex items-center gap-1.5 text-base font-semibold">
                          <User className="h-4 w-4 text-slate-400" />
                          {customer?.display_name ?? '匿名學員'}
                        </h3>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            STATUS_STYLES[b.status] ?? STATUS_STYLES.pending
                          }`}
                        >
                          {statusLabel(b.status)}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <span>
                          {service?.name} · {service?.duration_minutes} 分
                        </span>
                        {slot && (
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {formatTaipeiSlotRange(slot.start_at, slot.end_at)}
                            {slotOwnerName && ` · ${slotOwnerName}的時段`}
                          </span>
                        )}
                      </div>
                      {b.customer_notes && (
                        <div className="mt-2 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
                          學員備註：{b.customer_notes}
                        </div>
                      )}
                      {summary && (
                        <div
                          className="mt-2 truncate rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600"
                          title={summary}
                        >
                          {summary}
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {canAct && actionable && (
                        <BookingActionButtons
                          bookingId={b.id}
                          bookingStatus={b.status as 'pending' | 'confirmed'}
                        />
                      )}
                      <Link
                        href={`/bookings/${b.id}`}
                        className="px-2 text-xs text-slate-500 underline underline-offset-2 hover:text-slate-700"
                      >
                        明細
                      </Link>
                    </div>
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
