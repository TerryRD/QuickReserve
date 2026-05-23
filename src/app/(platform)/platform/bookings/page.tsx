import Link from 'next/link'
import { format } from 'date-fns'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import TenantFilter from './tenant-filter'

const TZ_OFFSET_HOURS = 8
const toLocal = (iso: string) =>
  new Date(new Date(iso).getTime() + TZ_OFFSET_HOURS * 3600 * 1000)

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

export default async function PlatformBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; tenant?: string }>
}) {
  const { status, tenant } = await searchParams
  const admin = createSupabaseAdminClient()

  let bookingsQuery = admin
    .from('bookings')
    .select(
      'id, status, created_at, customer_id, tenants(id, name, slug), customers(display_name), services(name), availability_slots(start_at, end_at)',
    )
    .order('created_at', { ascending: false })
    .limit(100)
  if (status && status !== 'all') bookingsQuery = bookingsQuery.eq('status', status)
  if (tenant) bookingsQuery = bookingsQuery.eq('tenant_id', tenant)

  const [{ data: bookings }, { data: tenants }] = await Promise.all([
    bookingsQuery,
    admin.from('tenants').select('id, name').order('name'),
  ])

  const filters = [
    { key: 'all', label: '全部' },
    { key: 'pending', label: '待確認' },
    { key: 'confirmed', label: '已確認' },
    { key: 'completed', label: '已完成' },
    { key: 'cancelled', label: '已取消' },
  ]
  const activeFilter = status ?? 'all'

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl tracking-tight">
          <span className="italic">全平台預約</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          最近 100 筆 · 唯讀檢視
        </p>
      </header>

      <div className="flex flex-wrap gap-3">
        <div className="flex flex-wrap gap-1">
          {filters.map((f) => (
            <Link
              key={f.key}
              href={
                f.key === 'all'
                  ? '/platform/bookings' + (tenant ? `?tenant=${tenant}` : '')
                  : `/platform/bookings?status=${f.key}` + (tenant ? `&tenant=${tenant}` : '')
              }
              className={`rounded-full border px-3 py-1.5 text-xs ${
                activeFilter === f.key
                  ? 'border-primary bg-primary text-primary-foreground font-medium'
                  : 'border-border bg-card hover:bg-muted'
              }`}
            >
              {f.label}
            </Link>
          ))}
        </div>
        <TenantFilter tenants={tenants ?? []} />
      </div>

      {!bookings || bookings.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-sm text-muted-foreground">
            無預約紀錄
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="p-3">租戶</th>
                <th className="p-3">學員</th>
                <th className="p-3">服務</th>
                <th className="p-3">時段</th>
                <th className="p-3">狀態</th>
                <th className="p-3">建立</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => {
                const t = b.tenants as { id: string; name: string; slug: string } | null
                const c = b.customers as { display_name: string | null } | null
                const sv = b.services as { name: string } | null
                const sl = b.availability_slots as { start_at: string; end_at: string } | null
                return (
                  <tr key={b.id} className="border-t">
                    <td className="p-3">
                      {t && (
                        <Link
                          href={`/platform/tenants/${t.id}`}
                          className="hover:underline"
                        >
                          {t.name}
                        </Link>
                      )}
                    </td>
                    <td className="p-3">{c?.display_name ?? '匿名'}</td>
                    <td className="p-3 text-xs">{sv?.name}</td>
                    <td className="p-3 text-xs">
                      {sl ? format(toLocal(sl.start_at), 'M/d HH:mm') : ''}
                    </td>
                    <td className="p-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          STATUS_STYLES[b.status] ?? STATUS_STYLES.pending
                        }`}
                      >
                        {STATUS_LABELS[b.status] ?? b.status}
                      </span>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {format(new Date(b.created_at), 'M/d HH:mm')}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
