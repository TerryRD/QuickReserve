import Link from 'next/link'
import { notFound } from 'next/navigation'
import { format } from 'date-fns'
import { ArrowLeft, Wallet } from 'lucide-react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { requireSession } from '@/lib/auth/get-session'
import { getTenantBySlug } from '@/lib/auth/get-tenant-context'
import { Card, CardContent } from '@/components/ui/card'

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending_review: { label: '待教練確認', color: 'bg-amber-100 text-amber-800' },
  confirmed: { label: '已生效', color: 'bg-emerald-100 text-emerald-800' },
  rejected: { label: '已拒絕', color: 'bg-slate-200 text-slate-700' },
}

export default async function MyPurchasesPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>
}) {
  const session = await requireSession()
  const { tenantSlug } = await params
  const tenant = await getTenantBySlug(tenantSlug)
  if (!tenant) notFound()

  const supabase = await createSupabaseServerClient()
  const { data: purchases } = await supabase
    .from('customer_purchases')
    .select(
      'id, classes_total, classes_used, expires_at, approval_status, rejected_reason, created_at, services(name), service_packages(name)',
    )
    .eq('customer_id', session.userId)
    .eq('tenant_id', tenant.id)
    .order('created_at', { ascending: false })

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
          <span className="italic">我的方案</span>
        </h1>
      </div>

      {!purchases || purchases.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Wallet className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 font-medium text-slate-700">尚無購買記錄</p>
            <Link
              href={`/${tenantSlug}/packages`}
              className="mt-3 inline-block text-sm text-blue-600 hover:underline"
            >
              瀏覽可購方案 →
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {purchases.map((p) => {
            const svc = p.services as { name: string } | null
            const pkg = p.service_packages as { name: string } | null
            const status = STATUS_LABEL[p.approval_status] ?? STATUS_LABEL.pending_review!
            const remaining = p.classes_total - p.classes_used
            return (
              <Card key={p.id}>
                <CardContent className="p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-display text-lg italic">
                        {pkg?.name ?? `${p.classes_total} 堂課`}
                      </h3>
                      <p className="text-xs text-muted-foreground">{svc?.name ?? '—'}</p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${status.color}`}
                    >
                      {status.label}
                    </span>
                  </div>
                  {p.approval_status === 'confirmed' && (
                    <div className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
                      <div>
                        <span className="text-muted-foreground">餘額：</span>
                        <span className="font-medium">
                          {remaining} / {p.classes_total} 堂
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">到期：</span>
                        {p.expires_at ? format(new Date(p.expires_at), 'yyyy/MM/dd') : '永久'}
                      </div>
                    </div>
                  )}
                  {p.approval_status === 'rejected' && p.rejected_reason && (
                    <div className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                      拒絕原因：{p.rejected_reason}
                    </div>
                  )}
                  <div className="mt-3 text-[10px] text-muted-foreground">
                    申請於 {format(new Date(p.created_at), 'yyyy/MM/dd HH:mm')}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
