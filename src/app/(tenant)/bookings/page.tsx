import { format } from 'date-fns'
import { requireTenantMember } from '@/lib/auth/get-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CancelButton, ConfirmButton } from './booking-actions'

const TZ_OFFSET_HOURS = 8

const STATUS_LABEL: Record<string, { label: string; class: string }> = {
  pending: { label: '待確認', class: 'bg-amber-100 text-amber-800' },
  confirmed: { label: '已確認', class: 'bg-emerald-100 text-emerald-800' },
  completed: { label: '已完成', class: 'bg-slate-100 text-slate-700' },
  cancelled: { label: '已取消', class: 'bg-slate-100 text-slate-500 line-through' },
}

function toLocal(iso: string): Date {
  return new Date(new Date(iso).getTime() + TZ_OFFSET_HOURS * 3600 * 1000)
}

export default async function TenantBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  await requireTenantMember()
  const { status: filter } = await searchParams
  const supabase = await createSupabaseServerClient()

  let query = supabase
    .from('bookings')
    .select(
      'id, status, customer_notes, customer_id, created_at, customers(display_name), services(name, duration_minutes), availability_slots(start_at, end_at)',
    )
    .order('created_at', { ascending: false })
  if (filter && filter !== 'all') query = query.eq('status', filter)
  const { data: bookings } = await query

  const statuses = ['all', 'pending', 'confirmed', 'completed', 'cancelled']
  const activeFilter = filter ?? 'all'

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">預約管理</h1>
      <div className="flex gap-1 text-sm">
        {statuses.map((s) => (
          <a
            key={s}
            href={`/bookings${s === 'all' ? '' : `?status=${s}`}`}
            className={`rounded border px-3 py-1.5 ${
              activeFilter === s
                ? 'border-blue-500 bg-blue-50 font-medium'
                : 'border-slate-200 bg-white text-slate-600'
            }`}
          >
            {s === 'all' ? '全部' : STATUS_LABEL[s]?.label ?? s}
          </a>
        ))}
      </div>
      {!bookings || bookings.length === 0 ? (
        <p className="rounded border bg-white p-6 text-center text-slate-400">尚無預約</p>
      ) : (
        <div className="space-y-2">
          {bookings.map((b) => {
            const customer = b.customers as { display_name: string | null } | null
            const service = b.services as { name: string; duration_minutes: number } | null
            const slot = b.availability_slots as { start_at: string; end_at: string } | null
            const status = STATUS_LABEL[b.status] ?? STATUS_LABEL.pending!
            return (
              <Card key={b.id}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-base">
                    {customer?.display_name ?? '匿名學員'}
                  </CardTitle>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.class}`}>
                    {status.label}
                  </span>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <div>
                    <span className="text-slate-500">服務：</span>
                    {service?.name} ({service?.duration_minutes} 分)
                  </div>
                  {slot && (
                    <div>
                      <span className="text-slate-500">時間：</span>
                      {format(toLocal(slot.start_at), 'yyyy/MM/dd (EEE) HH:mm')}–
                      {format(toLocal(slot.end_at), 'HH:mm')}
                    </div>
                  )}
                  {b.customer_notes && (
                    <div>
                      <span className="text-slate-500">學員備註：</span>
                      {b.customer_notes}
                    </div>
                  )}
                  {(b.status === 'pending' || b.status === 'confirmed') && (
                    <div className="flex gap-2 pt-2">
                      {b.status === 'pending' && <ConfirmButton bookingId={b.id} />}
                      <CancelButton bookingId={b.id} />
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
