import Link from 'next/link'
import { Package } from 'lucide-react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { requireTenantMember } from '@/lib/auth/get-session'
import { buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SectionHead } from '@/components/ui/section-head'
import PackageFormDialog from './package-form-dialog'
import PackageActionsRow from './package-actions-row'

export default async function PackagesPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>
}) {
  const session = await requireTenantMember()
  const params = await searchParams
  const showArchived = params.archived === '1'
  const supabase = await createSupabaseServerClient()

  const { data: services } = await supabase
    .from('services')
    .select('id, name, duration_minutes')
    .eq('tenant_id', session.tenantId)
    .eq('is_active', true)
    .order('name')

  const { data: packages } = await supabase
    .from('service_packages')
    .select('id, service_id, name, class_count, price, expires_in_days, is_active, services(name)')
    .eq('tenant_id', session.tenantId)
    .eq('is_active', !showArchived)
    .order('created_at', { ascending: false })

  const canEdit = session.role === 'tenant_owner'

  return (
    <div className="space-y-6">
      <SectionHead
        kicker="PACKAGES · 套裝管理"
        title="套裝管理"
        eng="PACKAGES"
        hint="為每個服務定義可購買的方案（單堂、N 堂套裝等）"
        right={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={showArchived ? '/packages' : '/packages?archived=1'}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              {showArchived ? '看使用中' : '看已刪除'}
            </Link>
            <Link href="/packages/pending" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              審核佇列
            </Link>
            {canEdit && !showArchived && (services?.length ?? 0) > 0 && (
              <PackageFormDialog mode="create" services={services ?? []} />
            )}
          </div>
        }
      />

      {!packages || packages.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-16 text-center">
          <Package className="mx-auto size-10 text-muted-foreground" />
          <div className="font-mono mt-4 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">NO PACKAGES</div>
          <p className="font-cjk mt-2 text-sm text-muted-foreground">
            {showArchived ? '無已刪除的套裝' : (services?.length ?? 0) === 0 ? '請先建立服務' : '為服務建立套裝以開放販售'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {packages.map((p) => {
            const svc = p.services as { name: string } | null
            return (
              <div key={p.id} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-xl italic">{p.name}</h3>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                        {svc?.name ?? '—'}
                      </span>
                      {!p.is_active && (
                        <Badge variant="outline">已刪除</Badge>
                      )}
                    </div>
                    <div className="mt-2 grid gap-x-4 gap-y-1 text-sm text-foreground/80 sm:grid-cols-3">
                      <div>
                        <span className="text-muted-foreground">堂數：</span>
                        {p.class_count}
                      </div>
                      <div>
                        <span className="text-muted-foreground">價格：</span>$
                        {Number(p.price).toLocaleString()}
                      </div>
                      <div>
                        <span className="text-muted-foreground">有效期：</span>
                        {p.expires_in_days ? `${p.expires_in_days} 天` : '永久'}
                      </div>
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-2">
                      {p.is_active && (
                        <PackageFormDialog
                          mode="edit"
                          services={services ?? []}
                          pkg={{
                            id: p.id,
                            service_id: p.service_id,
                            name: p.name,
                            class_count: p.class_count,
                            price: Number(p.price),
                            expires_in_days: p.expires_in_days,
                          }}
                        />
                      )}
                      <PackageActionsRow id={p.id} isActive={p.is_active} />
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
