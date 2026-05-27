import { Building2, ClipboardList, Bell, Users, UserCheck, Clock } from 'lucide-react'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { Kicker } from '@/components/ui/kicker'
import { KpiCard } from '@/components/ui/kpi-card'

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
    hint?: string
    icon: typeof Building2
    accent?: boolean
  }> = [
    {
      label: '啟用租戶',
      value: `${activeTenantCount ?? 0} / ${tenantCount ?? 0}`,
      hint: '啟用 / 總數',
      icon: Building2,
    },
    {
      label: '使用者總數',
      value: String(userCount ?? 0),
      icon: Users,
    },
    {
      label: '預約紀錄總數',
      value: String(bookingCount ?? 0),
      icon: ClipboardList,
    },
    {
      label: '待確認預約',
      value: String(pendingBookingCount ?? 0),
      hint: (pendingBookingCount ?? 0) > 0 ? '需要教練處理' : '一切就緒',
      icon: Clock,
      accent: (pendingBookingCount ?? 0) > 0,
    },
    {
      label: '推播訂閱數',
      value: String(subscriptionCount ?? 0),
      icon: Bell,
    },
    {
      label: '平台管理員',
      value: '1',
      icon: UserCheck,
    },
  ]

  return (
    <div className="space-y-7">
      <header>
        <Kicker>PLATFORM · 平台後台</Kicker>
        <h1 className="mt-2 font-display font-cjk text-3xl font-black uppercase sm:text-4xl">
          平台儀表板
        </h1>
        <p className="font-cjk mt-2 text-sm text-muted-foreground">即時系統狀態與統計</p>
      </header>
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <KpiCard
            key={s.label}
            label={s.label}
            value={s.value}
            hint={s.hint}
            icon={<s.icon className="size-3.5" />}
            accent={s.accent}
          />
        ))}
      </div>
    </div>
  )
}
