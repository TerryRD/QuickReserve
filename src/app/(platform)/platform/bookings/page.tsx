import Link from 'next/link'
import { format } from 'date-fns'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { Kicker } from '@/components/ui/kicker'
import { EmptyState } from '@/components/ui/empty-state'
import { StatusBadge, type StatusType } from '@/components/ui/badge'
import { ClipboardList } from 'lucide-react'
import TenantFilter from './tenant-filter'

const TZ_OFFSET_HOURS = 8
const toLocal = (iso: string) => new Date(new Date(iso).getTime() + TZ_OFFSET_HOURS * 3600 * 1000)

const STATUS_TYPES: ReadonlyArray<StatusType> = ['pending', 'confirmed', 'cancelled', 'completed']
const asStatus = (s: string): StatusType =>
  (STATUS_TYPES as readonly string[]).includes(s) ? (s as StatusType) : 'pending'

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
    <div className="space-y-7">
      <header>
        <Kicker>PLATFORM · 平台後台</Kicker>
        <h1 className="mt-2 font-display font-cjk text-3xl font-black uppercase sm:text-4xl">
          全平台預約
        </h1>
        <p className="font-cjk mt-2 text-sm text-muted-foreground">最近 100 筆 · 唯讀檢視</p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-full border border-border bg-card p-1">
          {filters.map((f) => (
            <Link
              key={f.key}
              href={
                f.key === 'all'
                  ? '/platform/bookings' + (tenant ? `?tenant=${tenant}` : '')
                  : `/platform/bookings?status=${f.key}` + (tenant ? `&tenant=${tenant}` : '')
              }
              aria-current={activeFilter === f.key ? 'page' : undefined}
              className={
                'rounded-full px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.15em] transition ' +
                (activeFilter === f.key
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground')
              }
            >
              {f.label}
            </Link>
          ))}
        </div>
        <TenantFilter tenants={tenants ?? []} />
      </div>

      {!bookings || bookings.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="size-5" />}
          title="無預約紀錄"
          hint="目前條件下沒有任何預約"
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_8px_24px_-18px_rgba(0,0,0,0.18)]">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr className="text-left font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <th className="p-3.5">租戶</th>
                <th className="p-3.5">學員</th>
                <th className="p-3.5">服務</th>
                <th className="p-3.5">時段</th>
                <th className="p-3.5">狀態</th>
                <th className="p-3.5">建立</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b, i) => {
                const t = b.tenants as { id: string; name: string; slug: string } | null
                const c = b.customers as { display_name: string | null } | null
                const sv = b.services as { name: string } | null
                const sl = b.availability_slots as { start_at: string; end_at: string } | null
                return (
                  <tr key={b.id} className={i > 0 ? 'border-t border-border' : ''}>
                    <td className="p-3.5 font-cjk">
                      {t && (
                        <Link
                          href={`/platform/tenants/${t.id}`}
                          className="font-semibold hover:underline"
                        >
                          {t.name}
                        </Link>
                      )}
                    </td>
                    <td className="p-3.5 font-cjk">{c?.display_name ?? '匿名'}</td>
                    <td className="p-3.5 font-cjk text-xs">{sv?.name}</td>
                    <td className="p-3.5 font-mono text-xs tabular-nums">
                      {sl ? format(toLocal(sl.start_at), 'M/d HH:mm') : ''}
                    </td>
                    <td className="p-3.5">
                      <StatusBadge status={asStatus(b.status)} />
                    </td>
                    <td className="p-3.5 font-mono text-xs tabular-nums text-muted-foreground">
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
