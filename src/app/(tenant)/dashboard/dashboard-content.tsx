import Link from 'next/link'
import { addDays, format, formatDistanceToNow, startOfDay, startOfMonth } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { ArrowRight, Calendar, Check, Clock, Sparkles, Users } from 'lucide-react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Kicker } from '@/components/ui/kicker'
import { KpiCard } from '@/components/ui/kpi-card'
import { StatusBadge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const TZ_OFFSET_HOURS = 8
const toLocal = (iso: string) =>
  new Date(new Date(iso).getTime() + TZ_OFFSET_HOURS * 3600 * 1000)

type TodayBookingRow = {
  id: string
  status: string
  customers: { display_name: string | null } | null
  services: { name: string; max_capacity: number } | null
  availability_slots: { start_at: string; end_at: string } | null
}

type PendingBookingRow = {
  id: string
  status: string
  created_at: string
  customers: { display_name: string | null } | null
  services: { name: string } | null
  availability_slots: { start_at: string } | null
}

/**
 * Streamed dashboard body — KPI grid + today timeline + pending column.
 * Wrapped in <Suspense> in the page shell so the hero renders immediately
 * while these 6 queries run in parallel.
 */
export default async function DashboardContent({
  tenantId,
  tenantSlug,
}: {
  tenantId: string
  tenantSlug: string
}) {
  const supabase = await createSupabaseServerClient()

  const now = new Date()
  const todayStart = startOfDay(now).toISOString()
  const tomorrowStart = addDays(startOfDay(now), 1).toISOString()
  const weekEnd = addDays(startOfDay(now), 7).toISOString()
  const monthStart = startOfMonth(now).toISOString()

  const [
    pendingRes,
    weekSlotsRes,
    todayBookingsRes,
    pendingBookingsRes,
    newCustomersRes,
    tenantDetailRes,
  ] = await Promise.all([
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'pending'),
    supabase
      .from('availability_slots')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('start_at', todayStart)
      .lte('start_at', weekEnd)
      .neq('status', 'cancelled'),
    supabase
      .from('bookings')
      .select(
        'id, status, customers(display_name), services(name, max_capacity), availability_slots!inner(start_at, end_at)',
      )
      .eq('tenant_id', tenantId)
      .in('status', ['pending', 'confirmed'])
      .gte('availability_slots.start_at', todayStart)
      .lt('availability_slots.start_at', tomorrowStart),
    supabase
      .from('bookings')
      .select(
        'id, status, created_at, customers(display_name), services(name), availability_slots(start_at)',
      )
      .eq('tenant_id', tenantId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(3),
    supabase
      .from('tenant_customers')
      .select('customer_id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('created_at', monthStart),
    supabase
      .from('tenants')
      .select('description')
      .eq('id', tenantId)
      .maybeSingle(),
  ])

  const pendingCount = pendingRes.count ?? 0
  const weekSlotsCount = weekSlotsRes.count ?? 0
  const todayBookings = (todayBookingsRes.data ?? []) as unknown as TodayBookingRow[]
  todayBookings.sort((a, b) => {
    const aMs = a.availability_slots ? new Date(a.availability_slots.start_at).getTime() : 0
    const bMs = b.availability_slots ? new Date(b.availability_slots.start_at).getTime() : 0
    return aMs - bMs
  })
  const pendingBookings = (pendingBookingsRes.data ?? []) as unknown as PendingBookingRow[]
  const newCustomersCount = newCustomersRes.count ?? 0
  const tenantDescription =
    (tenantDetailRes.data as { description: string | null } | null)?.description ?? null

  const nowMs = now.getTime()
  const nextUpIndex = todayBookings.findIndex((b) => {
    const slot = b.availability_slots
    if (!slot) return false
    return new Date(slot.start_at).getTime() >= nowMs
  })

  return (
    <>
      {/* KPI grid */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="本週待確認"
          value={pendingCount}
          unit="筆"
          hint={pendingCount === 0 ? '一切就緒' : '需要您回覆確認'}
          icon={<Clock className="size-3.5" />}
          accent={pendingCount > 0}
        />
        <KpiCard
          label="本週時段"
          value={weekSlotsCount}
          unit="個"
          hint="未來 7 天可預約"
          icon={<Check className="size-3.5" />}
        />
        <KpiCard
          label="今日預約"
          value={todayBookings.length}
          unit="堂"
          hint={todayBookings.length === 0 ? '今天沒安排' : '依時間排序'}
          icon={<Calendar className="size-3.5" />}
          accent={todayBookings.length > 0}
        />
        <KpiCard
          label="本月新學員"
          value={newCustomersCount}
          unit="位"
          hint="加入學員名單"
          icon={<Users className="size-3.5" />}
        />
      </section>

      {/* Two-column: today timeline + pending column */}
      <section className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        {/* TODAY */}
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex items-baseline justify-between border-b border-border px-6 py-4">
            <h2 className="font-display font-cjk text-xl font-black uppercase">今日預約</h2>
            <span className="font-mono text-[11px] tracking-[0.1em] text-muted-foreground">
              {todayBookings.length} 堂
            </span>
          </div>
          {todayBookings.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={<Calendar className="size-5" />}
                title="今天沒有預約"
                hint="可以早點下班"
              />
            </div>
          ) : (
            <div className="space-y-2 p-5">
              {todayBookings.map((b, i) => {
                const slot = b.availability_slots
                const customer = b.customers
                const service = b.services
                const isNext = nextUpIndex === i
                const isGroup = (service?.max_capacity ?? 1) > 1
                return (
                  <div
                    key={b.id}
                    className={cn(
                      'flex items-center gap-3 rounded-xl border p-3',
                      isNext
                        ? 'border-accent bg-accent text-accent-foreground'
                        : 'border-border bg-card',
                    )}
                  >
                    <div className="font-display w-16 text-xl leading-none tabular-nums tracking-[0.02em]">
                      {slot ? format(toLocal(slot.start_at), 'HH:mm') : '—'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-cjk truncate text-sm font-semibold">
                        {customer?.display_name ?? '匿名'}
                      </div>
                      <div
                        className={cn(
                          'font-cjk mt-0.5 truncate text-xs',
                          isNext ? 'opacity-75' : 'text-muted-foreground',
                        )}
                      >
                        {service?.name ?? '—'}
                      </div>
                    </div>
                    {isGroup && (
                      <span
                        className={cn(
                          'font-mono rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider',
                          isNext
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-accent text-accent-foreground',
                        )}
                      >
                        GROUP
                      </span>
                    )}
                    {isNext && (
                      <span className="font-mono text-[10px] font-bold tracking-wider">
                        NEXT UP
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* PENDING column */}
        <div className="flex flex-col gap-4">
          {/* Pending list card */}
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="flex items-baseline justify-between border-b border-border px-6 py-4">
              <h2 className="font-display font-cjk text-lg font-black uppercase">
                待確認預約
              </h2>
              <span className="font-mono text-[11px] tracking-[0.1em] text-muted-foreground">
                {pendingCount} 筆
              </span>
            </div>
            {pendingBookings.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={<Check className="size-5" />}
                  title="沒有待確認"
                  hint="所有預約都已處理"
                />
              </div>
            ) : (
              <>
                <div>
                  {pendingBookings.map((p, i) => {
                    const customer = p.customers
                    const service = p.services
                    const slot = p.availability_slots
                    const since = formatDistanceToNow(new Date(p.created_at), {
                      addSuffix: true,
                      locale: zhTW,
                    })
                    return (
                      <div
                        key={p.id}
                        className={cn(
                          'px-6 py-3.5',
                          i < pendingBookings.length - 1 && 'border-b border-border',
                        )}
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-cjk truncate text-sm font-semibold">
                            {customer?.display_name ?? '匿名'}
                          </span>
                          <StatusBadge status="pending" />
                        </div>
                        <div className="font-cjk mt-1 text-xs text-muted-foreground">
                          {service?.name ?? '—'}
                          {slot && <> · {format(toLocal(slot.start_at), 'M/d HH:mm')}</>}
                          {' · '}
                          {since}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="border-t border-border px-6 py-3">
                  <Link
                    href="/bookings?status=pending"
                    className="font-mono inline-flex items-center gap-1 text-[11px] tracking-wider text-muted-foreground hover:text-foreground"
                  >
                    查看全部待確認 <ArrowRight className="size-3" />
                  </Link>
                </div>
              </>
            )}
          </div>

          {/* Quick action card — show when there are few slots this week */}
          {weekSlotsCount < 5 && (
            <div className="rounded-2xl bg-muted p-6">
              <Kicker>QUICK ACTIONS</Kicker>
              <h3 className="font-display font-cjk mt-2 text-lg font-black">
                還沒設定本週時段？
              </h3>
              <p className="font-cjk mt-1.5 text-xs leading-relaxed text-muted-foreground">
                用作息模板一次設定整週的時段、或用重複規則自動展開未來四週。
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href="/calendar/availability">
                  <Button variant="default" size="sm" withArrow="inline">
                    設定作息模板
                  </Button>
                </Link>
                <Link href="/calendar/rules">
                  <Button variant="outline" size="sm">
                    建立重複規則
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {/* Empty-state preview — fresh tenant signal */}
          {!tenantDescription && (
            <EmptyState
              icon={<Sparkles className="size-5" />}
              title="剛開始使用 QuickReserve?"
              hint={`完成 4 步驟讓你的 /${tenantSlug} 上線。`}
              cta={
                <Link href="/settings/profile">
                  <Button variant="default" size="sm" withArrow="inline">
                    前往設定
                  </Button>
                </Link>
              }
            />
          )}
        </div>
      </section>
    </>
  )
}

export function DashboardContentSkeleton() {
  return (
    <>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-2xl border border-border bg-muted/40"
          />
        ))}
      </section>
      <section className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="h-72 animate-pulse rounded-2xl border border-border bg-muted/40" />
        <div className="h-72 animate-pulse rounded-2xl border border-border bg-muted/40" />
      </section>
    </>
  )
}
