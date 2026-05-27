import Link from 'next/link'
import { Package as PackageIcon, Plus, Star } from 'lucide-react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { requireTenantMember } from '@/lib/auth/get-session'
import { buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SectionHead } from '@/components/ui/section-head'
import { cn } from '@/lib/utils'
import PackageFormDialog from './package-form-dialog'
import PackageActionsRow from './package-actions-row'

type Tab = 'all' | '1on1' | 'group' | 'draft'

type Service = {
  id: string
  name: string
  duration_minutes: number
  max_capacity: number
}

type Pkg = {
  id: string
  service_id: string
  name: string
  class_count: number
  price: number
  expires_in_days: number | null
  is_active: boolean
  is_popular: boolean
}

export default async function PackagesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: Tab }>
}) {
  const session = await requireTenantMember()
  const params = await searchParams
  const tab: Tab =
    params.tab === '1on1' || params.tab === 'group' || params.tab === 'draft' ? params.tab : 'all'
  const supabase = await createSupabaseServerClient()

  const [servicesRes, packagesRes] = await Promise.all([
    supabase
      .from('services')
      .select('id, name, duration_minutes, max_capacity')
      .eq('tenant_id', session.tenantId)
      .eq('is_active', true)
      .order('created_at', { ascending: false }),
    // Pull both active and draft packages — we filter by tab below.
    supabase
      .from('service_packages')
      .select(
        'id, service_id, name, class_count, price, expires_in_days, is_active, is_popular',
      )
      .eq('tenant_id', session.tenantId)
      .order('created_at', { ascending: false }),
  ])

  const services = (servicesRes.data as Service[] | null) ?? []
  const packages = (packagesRes.data as Pkg[] | null) ?? []
  const servicesById = new Map(services.map((s) => [s.id, s] as const))

  const filtered = packages.filter((p) => {
    if (tab === 'draft') return !p.is_active
    // active-only tabs:
    if (!p.is_active) return false
    if (tab === 'all') return true
    const svc = servicesById.get(p.service_id)
    if (!svc) return false
    if (tab === '1on1') return svc.max_capacity === 1
    if (tab === 'group') return svc.max_capacity > 1
    return true
  })

  // Group by service. Preserve `services` order; only show groups that have
  // matching packages (except in 'all' tab where we show every service so the
  // coach can use the placeholder card to add packages to empty services).
  const groups = services
    .map((svc) => ({
      service: svc,
      packages: filtered.filter((p) => p.service_id === svc.id),
    }))
    .filter((g) => (tab === 'all' ? true : g.packages.length > 0))

  // Packages whose service is missing (e.g., service soft-deleted) — show
  // separately so the coach doesn't lose track of them.
  const orphanPackages = filtered.filter((p) => !servicesById.has(p.service_id))

  const canEdit = session.role === 'tenant_owner'
  const draftCount = packages.filter((p) => !p.is_active).length

  const tabs: { id: Tab; label: string; eng: string }[] = [
    { id: 'all', label: '全部', eng: 'ALL' },
    { id: '1on1', label: '一對一', eng: '1-ON-1' },
    { id: 'group', label: '團班', eng: 'GROUP' },
    { id: 'draft', label: '草稿', eng: 'DRAFT' },
  ]

  return (
    <div className="space-y-6">
      <SectionHead
        kicker="PACKAGES · 套裝管理"
        title="套裝管理"
        eng="PACKAGES"
        hint="按服務分組管理可購買的套裝（單堂、N 堂等）"
        right={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/packages/pending"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              審核佇列
            </Link>
            {canEdit && services.length > 0 && (
              <PackageFormDialog mode="create" services={services} />
            )}
          </div>
        }
      />

      <nav
        aria-label="套裝分類"
        className="inline-flex rounded-full border border-border bg-card p-1 shadow-[0_8px_24px_-18px_rgba(0,0,0,0.18)]"
      >
        {tabs.map((t) => {
          const isActive = t.id === tab
          const showCount = t.id === 'draft' && draftCount > 0
          return (
            <Link
              key={t.id}
              href={{ pathname: '/packages', query: t.id === 'all' ? {} : { tab: t.id } }}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex items-baseline gap-2 rounded-full px-4 py-2 text-sm transition',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <span className="font-cjk">{t.label}</span>
              <span className="font-mono text-[10px] tracking-[0.15em] opacity-70">{t.eng}</span>
              {showCount && (
                <span
                  className={cn(
                    'font-mono rounded-full px-1.5 py-px text-[10px] tabular-nums',
                    isActive
                      ? 'bg-primary-foreground/15 text-primary-foreground'
                      : 'bg-accent text-accent-foreground',
                  )}
                >
                  {draftCount}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {services.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-16 text-center">
          <PackageIcon className="mx-auto size-10 text-muted-foreground" />
          <div className="font-mono mt-4 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            NO SERVICES
          </div>
          <p className="font-cjk mt-2 text-sm text-muted-foreground">
            請先建立服務，才能為服務新增可購買的套裝。
          </p>
        </div>
      ) : tab === 'draft' ? (
        <DraftSection
          packages={filtered}
          services={services}
          servicesById={servicesById}
          canEdit={canEdit}
        />
      ) : (
        <div className="space-y-10">
          {groups.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-12 text-center">
              <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                NO MATCHING PACKAGES
              </div>
              <p className="font-cjk mt-2 text-sm text-muted-foreground">
                此分類目前沒有套裝
              </p>
            </div>
          ) : (
            groups.map((g, gi) => (
              <ServiceGroup
                key={g.service.id}
                index={gi}
                service={g.service}
                packages={g.packages}
                services={services}
                canEdit={canEdit}
              />
            ))
          )}

          {orphanPackages.length > 0 && (
            <section className="space-y-4">
              <SectionHead
                kicker="ORPHAN · 找不到服務"
                title="未分類"
                eng={`${orphanPackages.length} ITEMS`}
              />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {orphanPackages.map((p) => (
                  <PackageCard
                    key={p.id}
                    pkg={p}
                    services={services}
                    canEdit={canEdit}
                    serviceName={null}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

function ServiceGroup({
  index,
  service,
  packages,
  services,
  canEdit,
}: {
  index: number
  service: Service
  packages: Pkg[]
  services: Service[]
  canEdit: boolean
}) {
  const groupLabel = `GROUP / 0${index + 1}`
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          {groupLabel}
        </span>
        <h2 className="font-display font-cjk text-2xl font-black">{service.name}</h2>
        <span className="font-cjk text-xs text-muted-foreground">
          · {service.duration_minutes} 分鐘 · {packages.length} 個套裝
        </span>
        <span aria-hidden className="ml-2 hidden h-px flex-1 bg-border sm:block" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {packages.map((p) => (
          <PackageCard
            key={p.id}
            pkg={p}
            services={services}
            canEdit={canEdit}
            serviceName={service.name}
          />
        ))}
        {canEdit && (
          <PackageFormDialog
            mode="create"
            services={services}
            defaultServiceId={service.id}
            trigger={
              <button
                type="button"
                className="grid min-h-[180px] place-items-center rounded-2xl border-[1.5px] border-dashed border-border bg-muted/40 p-6 text-center transition hover:border-foreground/40 hover:bg-muted/60"
              >
                <div className="space-y-2">
                  <div className="mx-auto grid size-10 place-items-center rounded-full bg-secondary text-muted-foreground">
                    <Plus className="size-4" />
                  </div>
                  <div className="font-cjk text-sm font-semibold">新增 {service.name} 套裝</div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    CREATE NEW
                  </div>
                </div>
              </button>
            }
          />
        )}
      </div>
    </section>
  )
}

function DraftSection({
  packages,
  services,
  servicesById,
  canEdit,
}: {
  packages: Pkg[]
  services: Service[]
  servicesById: Map<string, Service>
  canEdit: boolean
}) {
  if (packages.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-12 text-center">
        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          NO DRAFTS
        </div>
        <p className="font-cjk mt-2 text-sm text-muted-foreground">沒有草稿（已刪除）套裝</p>
      </div>
    )
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {packages.map((p) => {
        const svc = servicesById.get(p.service_id) ?? null
        return (
          <PackageCard
            key={p.id}
            pkg={p}
            services={services}
            canEdit={canEdit}
            serviceName={svc?.name ?? null}
          />
        )
      })}
    </div>
  )
}

function PackageCard({
  pkg,
  services,
  canEdit,
  serviceName,
}: {
  pkg: Pkg
  services: Service[]
  canEdit: boolean
  serviceName: string | null
}) {
  const perClass = pkg.class_count > 0 ? Math.round(Number(pkg.price) / pkg.class_count) : null
  return (
    <div className="relative space-y-3 rounded-2xl border border-border bg-card p-6 shadow-[0_8px_24px_-18px_rgba(0,0,0,0.18)]">
      {pkg.is_popular && pkg.is_active && (
        <Badge variant="yellow" className="absolute right-4 top-4">
          <Star className="size-3" /> POPULAR
        </Badge>
      )}
      {!pkg.is_active && (
        <Badge variant="outline" className="absolute right-4 top-4">
          草稿
        </Badge>
      )}

      <div className="flex items-center gap-2">
        <span aria-hidden className="h-0.5 w-3.5 rounded bg-accent" />
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          PACKAGE
        </span>
      </div>

      <h3
        className={cn(
          'font-display font-cjk text-lg font-black leading-tight',
          (pkg.is_popular || !pkg.is_active) && 'max-w-[70%]',
        )}
      >
        {pkg.name}
      </h3>

      <div className="font-cjk text-xs text-muted-foreground">
        <span className="font-mono">{pkg.class_count} 堂</span>
        {serviceName && (
          <>
            <span aria-hidden> · </span>
            <span>{serviceName}</span>
          </>
        )}
        <span aria-hidden> · </span>
        <span>{pkg.expires_in_days ? `${pkg.expires_in_days} 天有效` : '永久有效'}</span>
      </div>

      <div className="flex items-baseline justify-between gap-2 border-t border-dashed border-border pt-3">
        {perClass !== null ? (
          <span className="font-mono text-[11px] tracking-[0.06em] text-muted-foreground">
            每堂 NT$ {perClass.toLocaleString()}
          </span>
        ) : (
          <span aria-hidden />
        )}
        <span className="font-display border-b-[3px] border-accent pb-px text-2xl leading-none">
          NT$ {Number(pkg.price).toLocaleString()}
        </span>
      </div>

      {canEdit && (
        <div className="flex items-center gap-2 pt-1">
          {pkg.is_active && (
            <PackageFormDialog
              mode="edit"
              services={services}
              pkg={{
                id: pkg.id,
                service_id: pkg.service_id,
                name: pkg.name,
                class_count: pkg.class_count,
                price: Number(pkg.price),
                expires_in_days: pkg.expires_in_days,
              }}
            />
          )}
          <div className="ml-auto">
            <PackageActionsRow id={pkg.id} isActive={pkg.is_active} />
          </div>
        </div>
      )}
    </div>
  )
}
