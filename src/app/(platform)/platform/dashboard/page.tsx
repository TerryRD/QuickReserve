import { Building2, ClipboardList, Bell, Users, UserCheck, Clock } from 'lucide-react'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'

const STAT_COLORS = {
  blue: 'bg-blue-50 text-blue-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  indigo: 'bg-indigo-50 text-indigo-600',
  rose: 'bg-rose-50 text-rose-600',
  slate: 'bg-slate-100 text-slate-600',
} as const

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

  const stats: Array<{
    label: string
    value: string
    icon: typeof Building2
    color: keyof typeof STAT_COLORS
  }> = [
    {
      label: '啟用租戶',
      value: `${activeTenantCount ?? 0} / ${tenantCount ?? 0}`,
      icon: Building2,
      color: 'blue',
    },
    { label: '使用者總數', value: String(userCount ?? 0), icon: Users, color: 'indigo' },
    {
      label: '預約紀錄總數',
      value: String(bookingCount ?? 0),
      icon: ClipboardList,
      color: 'emerald',
    },
    {
      label: '待確認預約',
      value: String(pendingBookingCount ?? 0),
      icon: Clock,
      color: 'amber',
    },
    {
      label: '推播訂閱數',
      value: String(subscriptionCount ?? 0),
      icon: Bell,
      color: 'rose',
    },
    { label: '平台管理員', value: '1', icon: UserCheck, color: 'slate' },
  ]

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">平台儀表板</h1>
        <p className="mt-1 text-sm text-muted-foreground">即時系統狀態與統計</p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-4 p-5">
              <div
                className={`grid h-12 w-12 place-items-center rounded-xl ${STAT_COLORS[s.color]}`}
              >
                <s.icon className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs text-muted-foreground">{s.label}</div>
                <div className="text-2xl font-bold tracking-tight">{s.value}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
