import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Package } from 'lucide-react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getTenantBySlug } from '@/lib/auth/get-tenant-context'
import { getSession } from '@/lib/auth/get-session'
import { SectionHead } from '@/components/ui/section-head'
import { Badge } from '@/components/ui/badge'
import { PrimaryCtaLink } from '@/components/ui/primary-cta'
import PurchaseRequestForm from './purchase-request-form'

export default async function PublicPackagesPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>
}) {
  const { tenantSlug } = await params
  const tenant = await getTenantBySlug(tenantSlug)
  if (!tenant) notFound()

  const supabase = await createSupabaseServerClient()

  const [{ data: services }, session] = await Promise.all([
    supabase
      .from('services')
      .select('id, name, description, duration_minutes')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true)
      .order('name'),
    getSession(),
  ])

  const serviceIds = (services ?? []).map((s) => s.id)
  const { data: packages } =
    serviceIds.length === 0
      ? { data: [] }
      : await supabase
          .from('service_packages')
          .select('id, service_id, name, class_count, price, expires_in_days')
          .in('service_id', serviceIds)
          .eq('is_active', true)
          .order('class_count', { ascending: true })

  const pkgsByService: Record<
    string,
    Array<{
      id: string
      name: string
      class_count: number
      price: number
      expires_in_days: number | null
    }>
  > = {}
  for (const p of packages ?? []) {
    pkgsByService[p.service_id] = pkgsByService[p.service_id] ?? []
    pkgsByService[p.service_id]!.push({
      id: p.id,
      name: p.name,
      class_count: p.class_count,
      price: Number(p.price),
      expires_in_days: p.expires_in_days,
    })
  }

  const hasAnyPackage = (services ?? []).some((s) => (pkgsByService[s.id] ?? []).length > 0)
  const returnPath = `/${tenantSlug}/packages`

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-[1200px] px-5 py-10 sm:px-10 sm:py-14 lg:px-[72px] lg:py-16">
        <Link
          href={`/${tenantSlug}`}
          className="font-mono mb-6 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3" />
          回 {tenant.name}
        </Link>

        <SectionHead
          kicker={`/${tenantSlug}/packages · 教練套裝`}
          title={`${tenant.name} 套裝`}
          eng="PACKAGES"
          hint="選擇方案、自報付款狀態後送出申請。教練確認後即可開始預約。"
        />

        {!session && (
          <div className="mb-8 flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card p-5">
            <div className="flex-1 min-w-0">
              <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                SIGN IN
              </div>
              <p className="font-cjk mt-1 text-sm font-medium">登入後即可送出套裝申請。</p>
            </div>
            <PrimaryCtaLink href={`/login?redirect=${encodeURIComponent(returnPath)}`} size="md">
              登入
            </PrimaryCtaLink>
          </div>
        )}

        <div className="space-y-12">
          {(services ?? []).map((svc, svcIdx) => {
            const list = pkgsByService[svc.id] ?? []
            if (list.length === 0) return null
            return (
              <section key={svc.id}>
                <div className="mb-4 flex flex-wrap items-baseline gap-3">
                  <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    SERVICE / 0{svcIdx + 1}
                  </span>
                  <h2 className="font-display font-cjk text-2xl font-black leading-tight sm:text-3xl">
                    {svc.name}
                  </h2>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map((p, i) => {
                    const perLesson = Math.round(p.price / p.class_count)
                    const popular = i === 1 && list.length >= 2
                    return (
                      <div
                        key={p.id}
                        className="relative flex flex-col gap-3 rounded-2xl border border-border bg-card p-6 shadow-[0_1px_0_var(--border),0_8px_24px_-18px_rgba(0,0,0,0.18)]"
                      >
                        {popular && (
                          <Badge variant="yellow" className="absolute right-4 top-4">
                            熱門
                          </Badge>
                        )}
                        <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
                          PACKAGE
                        </div>
                        <h3 className="font-display font-cjk text-[20px] font-black leading-tight">
                          {p.name}
                        </h3>
                        <div className="flex items-baseline gap-2">
                          <span className="font-display text-5xl leading-none">{p.class_count}</span>
                          <span className="font-cjk text-base text-muted-foreground">堂</span>
                        </div>
                        <div className="font-cjk text-xs text-muted-foreground">
                          {p.expires_in_days ? `${p.expires_in_days} 天內上完` : '永久有效'}
                        </div>
                        <div className="mt-auto flex items-baseline justify-between border-t border-dashed border-border pt-4">
                          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                            PER · NT$ {perLesson.toLocaleString()}
                          </span>
                          <span className="font-display border-b-[3px] border-accent pb-px text-[22px] leading-none">
                            NT$ {p.price.toLocaleString()}
                          </span>
                        </div>
                        <div className="mt-2">
                          <PurchaseRequestForm packageId={p.id} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>

        {!hasAnyPackage && (
          <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-16 text-center">
            <Package className="mx-auto size-10 text-muted-foreground" />
            <div className="font-mono mt-4 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              NO PACKAGES
            </div>
            <p className="font-cjk mt-2 text-sm text-muted-foreground">此教練尚未開放套裝</p>
          </div>
        )}
      </main>
    </div>
  )
}
