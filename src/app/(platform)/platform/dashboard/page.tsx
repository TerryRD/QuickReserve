import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function PlatformDashboard() {
  const admin = createSupabaseAdminClient()

  const [
    { count: tenantCount },
    { count: activeTenantCount },
    { count: userCount },
    { count: bookingCount },
    { count: pendingBookingCount },
    { count: subscriptionCount },
  ] = await Promise.all([
    admin.from('tenants').select('id', { count: 'exact', head: true }),
    admin.from('tenants').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    admin.from('customers').select('id', { count: 'exact', head: true }),
    admin.from('bookings').select('id', { count: 'exact', head: true }),
    admin.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    admin.from('push_subscriptions').select('id', { count: 'exact', head: true }),
  ])

  const stats = [
    { label: '租戶（啟用 / 全部）', value: `${activeTenantCount ?? 0} / ${tenantCount ?? 0}` },
    { label: '使用者（含學員）', value: String(userCount ?? 0) },
    { label: '預約紀錄（總數）', value: String(bookingCount ?? 0) },
    { label: '待確認預約', value: String(pendingBookingCount ?? 0) },
    { label: 'Push 訂閱數', value: String(subscriptionCount ?? 0) },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">平台儀表板</h1>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-500">{s.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
