import { format } from 'date-fns'
import { Calendar, ClipboardList, User } from 'lucide-react'
import { requireTenantMember } from '@/lib/auth/get-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { CancelButton, ConfirmButton } from './booking-actions'

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

  const filters = [
    { key: 'all', label: '全部' },
    { key: 'pending', label: '待確認' },
    { key: 'confirmed', label: '已確認' },
    { key: 'completed', label: '已完成' },
    { key: 'cancelled', label: '已取消' },
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
            const slot = b.availability_slots as { start_at: string; end_at: string } | null
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
                          {STATUS_LABELS[b.status] ?? b.status}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <span>
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
                          學員備註：{b.customer_notes}
                        </div>
                      )}
                    </div>
                    {(b.status === 'pending' || b.status === 'confirmed') && (
                      <div className="flex shrink-0 gap-2">
                        {b.status === 'pending' && <ConfirmButton bookingId={b.id} />}
                        <CancelButton bookingId={b.id} />
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
