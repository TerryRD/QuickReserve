import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Package } from 'lucide-react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getTenantBySlug } from '@/lib/auth/get-tenant-context'
import { getSession } from '@/lib/auth/get-session'
import { Card, CardContent } from '@/components/ui/card'
import PurchaseRequestForm from './purchase-request-form'
import AuthCta from '@/components/public-page/auth-cta'

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

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <Link
          href={`/${tenantSlug}`}
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          回 {tenant.name}
        </Link>
        <h1 className="font-display text-3xl tracking-tight">
          <span className="italic">{tenant.name} 的方案</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">選擇方案、自報付款狀態後送出申請。教練確認後即可開始預約。</p>
        {!session && <AuthCta returnPath={`/${tenantSlug}/packages`} />}
      </div>

      {(services ?? []).map((svc) => {
        const list = pkgsByService[svc.id] ?? []
        if (list.length === 0) return null
        return (
          <section key={svc.id}>
            <h2 className="mb-2 font-display text-xl">{svc.name}</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {list.map((p) => (
                <Card key={p.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold">{p.name}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {p.class_count} 堂 · {p.expires_in_days ? `${p.expires_in_days} 天內上完` : '永久有效'}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="font-display text-xl italic">${p.price.toLocaleString()}</div>
                      </div>
                    </div>
                    <div className="mt-3">
                      <PurchaseRequestForm packageId={p.id} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )
      })}

      {(services ?? []).every((s) => (pkgsByService[s.id] ?? []).length === 0) && (
        <Card>
          <CardContent className="p-12 text-center">
            <Package className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 font-medium text-slate-700">此教練尚未開放套裝</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
