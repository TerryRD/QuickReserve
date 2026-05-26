import Link from 'next/link'
import { addDays, format, startOfDay } from 'date-fns'
import { Calendar, ClipboardList, Package, TrendingUp, ExternalLink } from 'lucide-react'
import { requireTenantMember } from '@/lib/auth/get-session'
import { getTenantContext } from '@/lib/auth/get-tenant-context'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { SectionHead } from '@/components/ui/section-head'
import { StatusBadge, type StatusType } from '@/components/ui/badge'

const TZ_OFFSET_HOURS = 8
const toLocal = (iso: string) => new Date(new Date(iso).getTime() + TZ_OFFSET_HOURS * 3600 * 1000)

const STATUS_TYPES: ReadonlyArray<StatusType> = ['pending', 'confirmed', 'cancelled', 'completed']
function asStatus(s: string): StatusType {
  return (STATUS_TYPES as readonly string[]).includes(s) ? (s as StatusType) : 'pending'
}

export default async function TenantDashboard() {
  const session = await requireTenantMember()
  const tenant = await getTenantContext(session.tenantId)
  const supabase = await createSupabaseServerClient()

  const now = new Date()
  const todayStart = startOfDay(now).toISOString()
  const weekEnd = addDays(startOfDay(now), 7).toISOString()
  const greeting =
    now.getHours() < 12 ? '早安' : now.getHours() < 18 ? '午安' : '晚安'

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
        .select(
          'id, status, customers(display_name), services(name), availability_slots(start_at)',
        )
        .in('status', ['pending', 'confirmed'])
        .order('created_at', { ascending: false })
        .limit(5),
    ])

  const stats: Array<{
    label: string
    eng: string
    value: number
    hint: string
  }> = [
    {
      label: '待確認預約',
      eng: 'PENDING',
      value: pendingCount ?? 0,
      hint: '需要您回覆確認',
    },
    {
      label: '本週時段',
      eng: 'WEEK SLOTS',
      value: weekSlotsCount ?? 0,
      hint: '未來 7 天可預約',
    },
  ]

  const quickLinks = [
    {
      href: '/calendar',
      label: '行事曆',
      hint: '建立、批量、重複規則',
      icon: TrendingUp,
    },
    {
      href: '/services',
      label: '服務管理',
      hint: '新增 / 編輯服務項目',
      icon: Package,
    },
    {
      href: '/packages',
      label: '套裝管理',
      hint: '審核學員申請',
      icon: ClipboardList,
    },
  ]

  return (
    <div className="space-y-12">
      {/* Hero — greeting */}
      <header>
        <div className="font-mono mb-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          DASHBOARD · {format(now, 'EEE · MMM dd')}
        </div>
        <h1 className="font-display text-[44px] uppercase leading-[0.95] tracking-tight sm:text-[56px] lg:text-[72px]">
          {greeting}
          <span className="font-cjk">，</span>
          <span className="relative inline-block">
            <span className="font-cjk">{tenant.name}</span>
            <span aria-hidden className="absolute inset-x-0 -bottom-1 h-2 rounded bg-accent" />
          </span>
        </h1>
        <p className="font-mono mt-4 inline-flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          <span>PUBLIC LINK ·</span>
          <Link
            href={`/${tenant.slug}`}
            target="_blank"
            className="inline-flex items-center gap-1 underline-offset-4 hover:underline hover:text-foreground"
          >
            /{tenant.slug}
            <ExternalLink className="size-3" />
          </Link>
        </p>
      </header>

      {/* KPI */}
      <section>
        <SectionHead kicker="OVERVIEW · 本週狀態" title="本週" eng="THIS WEEK" />
        <div className="grid gap-4 sm:grid-cols-2">
          {stats.map((s) => (
            <div
              key={s.eng}
              className="rounded-2xl border border-border bg-card p-6 shadow-[0_1px_0_var(--border),0_8px_24px_-18px_rgba(0,0,0,0.18)]"
            >
              <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                {s.eng}
              </div>
              <div className="mt-2 flex items-baseline gap-3">
                <span className="font-display text-6xl leading-none">{s.value}</span>
                <span className="font-cjk text-base text-muted-foreground">{s.label}</span>
              </div>
              <div className="font-cjk mt-3 text-xs text-muted-foreground">{s.hint}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Quick actions */}
      <section>
        <SectionHead kicker="QUICK ACTIONS · 快速操作" title="操作" eng="ACTIONS" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {quickLinks.map((q) => (
            <Link
              key={q.href}
              href={q.href}
              className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-5 transition hover:border-foreground/40 hover:shadow-[0_8px_24px_-18px_rgba(0,0,0,0.25)]"
            >
              <div className="grid size-10 shrink-0 place-items-center rounded-full bg-foreground text-background transition-colors group-hover:bg-accent group-hover:text-accent-foreground">
                <q.icon className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-cjk text-sm font-semibold">{q.label}</div>
                <div className="font-mono mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {q.hint}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Upcoming bookings */}
      <section>
        <SectionHead
          kicker="UPCOMING · 即將到來"
          title="預約"
          eng="UPCOMING"
          hint="最近 5 筆 pending / confirmed"
          right={
            <Link
              href="/bookings"
              className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground"
            >
              VIEW ALL →
            </Link>
          }
        />
        {!nextBookings || nextBookings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-12 text-center">
            <Calendar className="mx-auto size-9 text-muted-foreground" />
            <div className="font-mono mt-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              NO BOOKINGS
            </div>
            <p className="font-cjk mt-2 text-sm text-muted-foreground">尚無預約</p>
          </div>
        ) : (
          <div className="space-y-3">
            {nextBookings.map((b) => {
              const customer = b.customers as { display_name: string | null } | null
              const service = b.services as { name: string } | null
              const slot = b.availability_slots as { start_at: string } | null
              return (
                <div
                  key={b.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-cjk text-base font-semibold">
                        {customer?.display_name ?? '匿名'}
                      </span>
                      <StatusBadge status={asStatus(b.status)} />
                    </div>
                    <div className="font-cjk mt-1.5 text-xs text-muted-foreground">
                      {service?.name}
                      {slot && (
                        <>
                          <span className="font-mono ml-2 tracking-wider">·</span>
                          <span className="font-mono ml-2 tracking-wider">
                            {format(toLocal(slot.start_at), 'M/d HH:mm')}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
