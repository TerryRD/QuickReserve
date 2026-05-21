import Link from 'next/link'
import { format } from 'date-fns'
import { requireSession } from '@/lib/auth/get-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import PushOptIn from '@/components/push-opt-in'
import CancelMyBookingButton from './cancel-button'

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

export default async function MyBookingsPage() {
  const session = await requireSession()
  const supabase = await createSupabaseServerClient()
  const { data: bookings } = await supabase
    .from('bookings')
    .select(
      'id, status, customer_notes, created_at, tenants(name, slug), services(name, duration_minutes), availability_slots(start_at, end_at)',
    )
    .eq('customer_id', session.userId)
    .order('created_at', { ascending: false })

  const now = new Date()
  const isFuture = (iso: string) => new Date(iso) > now

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">我的預約</h1>
        <Link href="/settings/notifications" className="text-sm text-blue-600 hover:underline">
          通知設定
        </Link>
      </div>
      <PushOptIn />
      {!bookings || bookings.length === 0 ? (
        <p className="rounded border bg-white p-6 text-center text-slate-400">
          尚無預約紀錄
        </p>
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => {
            const tenant = b.tenants as { name: string; slug: string } | null
            const service = b.services as { name: string; duration_minutes: number } | null
            const slot = b.availability_slots as { start_at: string; end_at: string } | null
            const status = STATUS_LABEL[b.status] ?? STATUS_LABEL.pending!
            const canCancel =
              (b.status === 'pending' || b.status === 'confirmed') && slot && isFuture(slot.start_at)
            return (
              <Card key={b.id}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-base">{tenant?.name}</CardTitle>
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
                      <span className="text-slate-500">備註：</span>
                      {b.customer_notes}
                    </div>
                  )}
                  {canCancel && (
                    <div className="pt-2">
                      <CancelMyBookingButton bookingId={b.id} />
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
