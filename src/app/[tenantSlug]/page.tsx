import { notFound } from 'next/navigation'
import { getTenantBySlug } from '@/lib/auth/get-tenant-context'

export default async function TenantPublicPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>
}) {
  const { tenantSlug } = await params
  const tenant = await getTenantBySlug(tenantSlug)
  if (!tenant) notFound()

  if (tenant.status === 'suspended') {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <p className="text-slate-600">此教練的預約服務暫停中</p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-3xl font-bold">{tenant.name}</h1>
      <p className="mt-2 text-slate-600">{tenant.slug}</p>
      <p className="mt-8 text-slate-400">服務 / 預約 UI 將在 Plan 4 實作</p>
    </main>
  )
}
