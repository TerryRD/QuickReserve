import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Info, Package, Plus, Star } from 'lucide-react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getTenantBySlug } from '@/lib/auth/get-tenant-context'
import { getSession } from '@/lib/auth/get-session'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PrimaryCtaLink } from '@/components/ui/primary-cta'
import PurchaseRequestForm from './purchase-request-form'

type PackageRow = {
  id: string
  name: string
  class_count: number
  price: number
  expires_in_days: number | null
  is_popular: boolean
}

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
  const { data: packagesRaw } =
    serviceIds.length === 0
      ? { data: [] as Array<Record<string, unknown>> }
      : await supabase
          .from('service_packages')
          .select(
            'id, service_id, name, class_count, price, expires_in_days, is_popular',
          )
          .in('service_id', serviceIds)
          .eq('is_active', true)
          .order('class_count', { ascending: true })

  const pkgsByService: Record<string, PackageRow[]> = {}
  for (const raw of packagesRaw ?? []) {
    const p = raw as {
      id: string
      service_id: string
      name: string
      class_count: number
      price: number | string
      expires_in_days: number | null
      is_popular?: boolean | null
    }
    pkgsByService[p.service_id] = pkgsByService[p.service_id] ?? []
    pkgsByService[p.service_id]!.push({
      id: p.id,
      name: p.name,
      class_count: p.class_count,
      price: Number(p.price),
      expires_in_days: p.expires_in_days,
      is_popular: Boolean(p.is_popular),
    })
  }

  const groups = (services ?? [])
    .map((svc) => ({ svc, list: pkgsByService[svc.id] ?? [] }))
    .filter((g) => g.list.length > 0)

  const hasAnyPackage = groups.length > 0
  const returnPath = `/${tenantSlug}/packages`

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-[1200px] px-5 py-10 sm:px-10 sm:py-14 lg:px-[72px] lg:py-16">
        <Link
          href={`/${tenantSlug}`}
          className="font-mono mb-6 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3" />
          回 {tenant.name} 主頁
        </Link>

        <header className="mb-10 sm:mb-12">
          <div className="font-mono mb-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            /{tenantSlug} · PACKAGES
          </div>
          <h1 className="font-display flex flex-wrap items-baseline gap-3.5 text-[56px] font-normal uppercase leading-[0.9] tracking-tight sm:text-[88px]">
            <span className="font-cjk">套裝</span>
            <span className="relative inline-block">
              PACKAGES
              <span
                aria-hidden
                className="absolute inset-x-0 -bottom-0.5 h-1.5 rounded-md bg-accent"
              />
            </span>
          </h1>
          <p className="font-cjk mt-4 max-w-[540px] text-[13px] leading-[1.6] text-muted-foreground sm:text-sm">
            買套裝享更划算的單堂單價。送出申請後等教練核可、確認付款狀態,核可後即可預約時段。
          </p>
        </header>

        {!session && (
          <div className="mb-10 flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card p-5">
            <Info className="size-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
                SIGN IN · 申請套裝前需要登入
              </div>
              <p className="font-cjk mt-1 text-sm font-medium">
                登入或註冊後填寫付款狀態、送出後等教練核可。
              </p>
            </div>
            <div className="flex gap-2">
              <Link href={`/signup?redirect=${encodeURIComponent(returnPath)}`}>
                <Button variant="outline" size="pill">
                  建立帳號
                </Button>
              </Link>
              <PrimaryCtaLink
                href={`/login?redirect=${encodeURIComponent(returnPath)}`}
                size="md"
              >
                登入
              </PrimaryCtaLink>
            </div>
          </div>
        )}

        <div className="space-y-12 sm:space-y-14">
          {groups.map((g, gi) => (
            <section key={g.svc.id}>
              <div className="mb-5 flex flex-wrap items-baseline gap-3">
                <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
                  GROUP / 0{gi + 1}
                </span>
                <h2 className="font-display font-cjk text-2xl font-black leading-tight sm:text-3xl">
                  {g.svc.name}
                </h2>
                <span className="font-cjk text-xs text-muted-foreground">
                  · {g.svc.duration_minutes} 分鐘 · {g.list.length} ITEMS
                </span>
                <span
                  aria-hidden
                  className="ml-2 hidden h-px flex-1 bg-border sm:block"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:gap-5">
                {g.list.map((p) => {
                  const perLesson = Math.round(p.price / p.class_count)
                  return (
                    <div
                      key={p.id}
                      className="relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-[0_8px_24px_-18px_rgba(0,0,0,0.18)] sm:p-7"
                    >
                      {p.is_popular && (
                        <Badge
                          variant="yellow"
                          icon={<Star className="size-3" />}
                          className="absolute right-4 top-4"
                        >
                          POPULAR
                        </Badge>
                      )}
                      <div className="flex items-center gap-2 font-mono text-[10.5px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                        <span
                          aria-hidden
                          className="inline-block h-0.5 w-3.5 rounded-sm bg-accent"
                        />
                        PACKAGE
                      </div>
                      <div>
                        <h3 className="font-display font-cjk text-[22px] font-black leading-[1.15] sm:text-[26px]">
                          {p.name}
                        </h3>
                        <div className="font-cjk mt-1.5 text-[13px] text-muted-foreground">
                          <span className="font-mono mr-2 text-xs">
                            {p.class_count} 堂
                          </span>
                          ·{' '}
                          {p.expires_in_days
                            ? `${p.expires_in_days} 天內上完`
                            : '永久有效'}
                        </div>
                      </div>
                      <div className="flex items-baseline justify-between border-t border-dashed border-border pt-3">
                        <div>
                          <div className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground">
                            每堂
                          </div>
                          <div className="font-display mt-0.5 text-lg leading-none">
                            NT$ {perLesson.toLocaleString()}
                          </div>
                        </div>
                        <span className="font-display border-b-[3px] border-accent pb-px text-[32px] leading-none">
                          NT$ {p.price.toLocaleString()}
                        </span>
                      </div>
                      <PurchaseRequestForm
                        packageId={p.id}
                        packageName={p.name}
                        signedIn={Boolean(session)}
                        loginHref={`/login?redirect=${encodeURIComponent(returnPath)}`}
                      />
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
        </div>

        {!hasAnyPackage && (
          <div className="mt-6 rounded-2xl border border-dashed border-border bg-muted/40 p-12 text-center sm:p-16">
            <Package className="mx-auto size-10 text-muted-foreground" />
            <div className="font-mono mt-4 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              NO PACKAGES
            </div>
            <p className="font-cjk mt-2 text-sm text-muted-foreground">
              此教練尚未開放套裝
            </p>
          </div>
        )}

        {hasAnyPackage && (
          <div className="mt-12 flex flex-col items-center gap-2.5 rounded-2xl border border-dashed border-border p-10 text-center sm:mt-14 sm:p-12">
            <div className="flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
              <Plus className="size-5" />
            </div>
            <h3 className="font-display font-cjk text-lg font-black">
              還沒看到喜歡的方案?
            </h3>
            <p className="font-cjk max-w-[380px] text-[13px] text-muted-foreground">
              可以直接私訊教練詢問客製套裝。教練建立後會出現在這個頁面。
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
