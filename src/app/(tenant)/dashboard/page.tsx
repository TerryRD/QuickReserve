import Link from 'next/link'
import { addDays, format, startOfDay } from 'date-fns'
import { Calendar, ClipboardList, Package, TrendingUp, ChevronRight } from 'lucide-react'
import { requireTenantMember } from '@/lib/auth/get-session'
import { getTenantContext } from '@/lib/auth/get-tenant-context'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'

const TZ_OFFSET_HOURS = 8
const toLocal = (iso: string) => new Date(new Date(iso).getTime() + TZ_OFFSET_HOURS * 3600 * 1000)

export default async function TenantDashboard() {
  const session = await requireTenantMember()
  const tenant = await getTenantContext(session.tenantId)
  const supabase = await createSupabaseServerClient()

  const now = new Date()
  const todayStart = startOfDay(now).toISOString()
  const weekEnd = addDays(startOfDay(now), 7).toISOString()

  const [{ count: pendingCount }, { count: weekSlotsCount }, { data: nextBookings }] =
    await Promise.all([
      supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),
      supabase
        .from('availability_slots')
        .select('id', { count: 'exact', head: true })
        .gte('start_at', todayStart)
        .lte('start_at', weekEnd)
        .neq('status', 'cancelled'),
      supabase
        .from('bookings')
        .select('id, status, customers(display_name), services(name), availability_slots(start_at)')
        .in('status', ['pending', 'confirmed'])
        .order('created_at', { ascending: false })
        .limit(5),
    ])

  const stats = [
    { label: '待確認預約', value: pendingCount ?? 0, icon: ClipboardList, color: 'amber' },
    { label: '本週時段', value: weekSlotsCount ?? 0, icon: Calendar, color: 'blue' },
  ]

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">儀表板</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {tenant.name} · 公開連結{' '}
          <Link
            href={`/${tenant.slug}`}
            target="_blank"
            className="font-mono text-primary hover:underline"
          >
            /{tenant.slug}
          </Link>
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => {
          const colorClass =
            s.color === 'amber'
              ? 'bg-amber-50 text-amber-600'
              : s.color === 'blue'
                ? 'bg-blue-50 text-blue-600'
                : 'bg-slate-100 text-slate-600'
          return (
            <Card key={s.label}>
              <CardContent className="flex items-center gap-4 p-5">
                <div className={`grid h-10 w-10 place-items-center rounded-lg ${colorClass}`}>
                  <s.icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                  <div className="text-2xl font-bold">{s.value}</div>
                </div>
              </CardContent>
            </Card>
          )
        })}
        <Link href="/calendar" className="block">
          <Card className="h-full transition hover:shadow-md">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-indigo-50 text-indigo-600">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">查看行事曆</div>
                <div className="text-xs text-muted-foreground">建立、批量、重複規則</div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/services" className="block">
          <Card className="h-full transition hover:shadow-md">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-50 text-emerald-600">
                <Package className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">管理服務</div>
                <div className="text-xs text-muted-foreground">新增 / 編輯服務項目</div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">即將到來的預約</h2>
          <Link href="/bookings" className="text-sm text-primary hover:underline">
            查看全部
          </Link>
        </div>
        {!nextBookings || nextBookings.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center text-sm text-muted-foreground">
              <Calendar className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2">尚無預約</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {nextBookings.map((b) => {
              const customer = b.customers as { display_name: string | null } | null
              const service = b.services as { name: string } | null
              const slot = b.availability_slots as { start_at: string } | null
              return (
                <Card key={b.id}>
                  <CardContent className="flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{customer?.display_name ?? '匿名'}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            b.status === 'pending'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {b.status === 'pending' ? '待確認' : '已確認'}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {service?.name} · {slot ? format(toLocal(slot.start_at), 'M/d HH:mm') : ''}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
