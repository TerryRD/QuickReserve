import { Suspense } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { ArrowRight, Layers, Plus } from 'lucide-react'
import { requireTenantMember } from '@/lib/auth/get-session'
import { getTenantContext } from '@/lib/auth/get-tenant-context'
import { Button } from '@/components/ui/button'
import DashboardContent, { DashboardContentSkeleton } from './dashboard-content'

export default async function TenantDashboard() {
  const session = await requireTenantMember()
  const tenant = await getTenantContext(session.tenantId)

  const now = new Date()
  const greeting =
    now.getHours() < 12 ? '早安' : now.getHours() < 18 ? '午安' : '晚安'

  return (
    <div className="space-y-6">
      {/* Greeting hero — renders immediately, no data deps */}
      <section className="relative overflow-hidden rounded-2xl bg-primary p-7 text-primary-foreground sm:p-9">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 size-[220px] rounded-full bg-accent opacity-20"
        />
        <div className="relative">
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary-foreground/70">
            DASHBOARD · {format(now, 'EEE yyyy.MM.dd').toUpperCase()} · {tenant.name}
          </div>
          <h1 className="font-display mt-3 flex flex-wrap items-baseline gap-3.5 text-4xl uppercase leading-[0.95] tracking-tight sm:text-6xl">
            <span className="font-cjk">
              {greeting}、{tenant.name}
            </span>
            <span
              aria-hidden
              className="inline-block size-3 rounded-full bg-accent sm:size-3.5"
            />
          </h1>
          <p className="font-cjk mt-3.5 max-w-[540px] text-sm opacity-75 sm:text-base">
            今日預約、本週時段與待確認概況都在下方。
          </p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <Link
              href="/calendar"
              className="group/cta inline-flex h-11 items-center gap-3 rounded-full bg-accent pl-5 pr-1.5 text-[13.5px] font-semibold tracking-wide text-accent-foreground transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/40 active:translate-y-px"
            >
              開啟今日行事曆
              <span className="inline-flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform group-hover/cta:translate-x-0.5">
                <ArrowRight className="size-3.5" />
              </span>
            </Link>
            <Link href="/calendar/availability">
              <Button
                variant="outline"
                size="pill"
                className="border-white/25 bg-transparent text-primary-foreground hover:bg-white/10 hover:text-primary-foreground dark:border-white/25 dark:bg-transparent dark:hover:bg-white/10"
              >
                <Plus className="size-3.5" /> 建立可用時段
              </Button>
            </Link>
            <Link href="/packages">
              <Button
                variant="ghost"
                size="pill"
                className="text-primary-foreground/85 hover:bg-white/10 hover:text-primary-foreground dark:hover:bg-white/10"
              >
                <Layers className="size-3.5" /> 開放新套裝
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Suspense fallback={<DashboardContentSkeleton />}>
        <DashboardContent tenantId={session.tenantId} tenantSlug={tenant.slug} />
      </Suspense>
    </div>
  )
}
