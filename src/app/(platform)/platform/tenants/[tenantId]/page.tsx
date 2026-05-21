import Link from 'next/link'
import { notFound } from 'next/navigation'
import { format } from 'date-fns'
import { ArrowLeft, Calendar, ClipboardList, ExternalLink, Package, Users } from 'lucide-react'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'

const TZ_OFFSET_HOURS = 8
const toLocal = (iso: string) =>
  new Date(new Date(iso).getTime() + TZ_OFFSET_HOURS * 3600 * 1000)

export default async function PlatformTenantDetailPage({
  params,
}: {
  params: Promise<{ tenantId: string }>
}) {
  const { tenantId } = await params
  const admin = createSupabaseAdminClient()

  const { data: tenant } = await admin
    .from('tenants')
    .select('id, slug, name, description, status, created_at')
    .eq('id', tenantId)
    .maybeSingle()
  if (!tenant) notFound()

  const [{ data: members }, { data: services }, { data: customers }, { count: bookingCount }, { count: pendingCount }, { count: slotCount }] =
    await Promise.all([
      admin
        .from('tenant_members')
        .select('id, role, status, invited_email, user_id, created_at')
        .eq('tenant_id', tenantId)
        .order('role', { ascending: false }),
      admin
        .from('services')
        .select('id, name, duration_minutes, price, is_active')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false }),
      admin
        .from('tenant_customers')
        .select('customer_id, customers(display_name)')
        .eq('tenant_id', tenantId)
        .limit(50),
      admin.from('bookings').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      admin
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'pending'),
      admin
        .from('availability_slots')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .gte('start_at', new Date().toISOString())
        .neq('status', 'cancelled'),
    ])

  // Last 10 bookings
  const { data: recentBookings } = await admin
    .from('bookings')
    .select(
      'id, status, created_at, customers(display_name), services(name), availability_slots(start_at)',
    )
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(10)

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/platform/tenants"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          回租戶列表
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl tracking-tight">
              <span className="italic">{tenant.name}</span>
            </h1>
            <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
              <span className="font-mono">/{tenant.slug}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  tenant.status === 'active'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {tenant.status === 'active' ? '啟用中' : '已暫停'}
              </span>
              <span>建立於 {format(new Date(tenant.created_at), 'yyyy/MM/dd')}</span>
            </div>
          </div>
          <Link
            href={`/${tenant.slug}`}
            target="_blank"
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            開公開頁 <ExternalLink className="ml-1 h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 text-xs text-amber-800">
        ⓘ 唯讀視圖。平台管理員不能代教練 / 學員操作預約。
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Users} label="成員" value={members?.length ?? 0} />
        <Stat icon={Package} label="服務" value={services?.length ?? 0} />
        <Stat icon={Calendar} label="未來時段" value={slotCount ?? 0} />
        <Stat icon={ClipboardList} label={`預約（待確認 ${pendingCount ?? 0}）`} value={bookingCount ?? 0} />
      </div>

      {/* Members */}
      <section>
        <h2 className="mb-2 font-display text-xl">成員</h2>
        <Card>
          <CardContent className="divide-y p-0">
            {(members ?? []).map((m) => (
              <div key={m.id} className="flex items-center justify-between p-4 text-sm">
                <div>
                  <div className="font-medium">{m.invited_email ?? (m.user_id ? '已加入' : '?')}</div>
                  <div className="text-xs text-muted-foreground">
                    {m.role === 'owner' ? 'Owner' : 'Staff'} · {m.status}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {format(new Date(m.created_at), 'yyyy/MM/dd')}
                </div>
              </div>
            ))}
            {!members?.length && (
              <div className="p-6 text-center text-sm text-muted-foreground">無成員</div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Services */}
      <section>
        <h2 className="mb-2 font-display text-xl">服務</h2>
        <Card>
          <CardContent className="divide-y p-0">
            {(services ?? []).map((s) => (
              <div key={s.id} className="flex items-center justify-between p-4 text-sm">
                <div>
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {s.duration_minutes} 分鐘 ·{' '}
                    {s.price ? `$${Number(s.price).toLocaleString()}` : '洽詢'}
                  </div>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] ${
                    s.is_active
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {s.is_active ? '啟用' : '停用'}
                </span>
              </div>
            ))}
            {!services?.length && (
              <div className="p-6 text-center text-sm text-muted-foreground">無服務</div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Recent bookings */}
      <section>
        <h2 className="mb-2 font-display text-xl">最近 10 筆預約</h2>
        <Card>
          <CardContent className="divide-y p-0">
            {(recentBookings ?? []).map((b) => {
              const c = b.customers as { display_name: string | null } | null
              const sv = b.services as { name: string } | null
              const sl = b.availability_slots as { start_at: string } | null
              return (
                <div key={b.id} className="flex items-center justify-between p-4 text-sm">
                  <div>
                    <div className="font-medium">{c?.display_name ?? '匿名'}</div>
                    <div className="text-xs text-muted-foreground">
                      {sv?.name} · {sl ? format(toLocal(sl.start_at), 'M/d HH:mm') : ''}
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      b.status === 'pending'
                        ? 'bg-amber-100 text-amber-800'
                        : b.status === 'confirmed'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {b.status}
                  </span>
                </div>
              )
            })}
            {!recentBookings?.length && (
              <div className="p-6 text-center text-sm text-muted-foreground">無預約</div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Customers preview */}
      <section>
        <h2 className="mb-2 font-display text-xl">學員（最多 50 位）</h2>
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-2 text-xs">
              {(customers ?? []).map((tc) => {
                const c = tc.customers as { display_name: string | null } | null
                return (
                  <span key={tc.customer_id} className="rounded-full bg-muted px-3 py-1">
                    {c?.display_name ?? '?'}
                  </span>
                )
              })}
              {!customers?.length && (
                <span className="text-muted-foreground">無學員</span>
              )}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Calendar
  label: string
  value: number | string
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-muted">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="font-display text-2xl italic">{value}</div>
        </div>
      </CardContent>
    </Card>
  )
}
