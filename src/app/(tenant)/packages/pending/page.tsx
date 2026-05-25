import Link from 'next/link'
import { format } from 'date-fns'
import { ArrowLeft, ClipboardCheck } from 'lucide-react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { requireTenantMember } from '@/lib/auth/get-session'
import { Card, CardContent } from '@/components/ui/card'
import PurchaseRow from './purchase-row'

export default async function PendingPurchasesPage() {
  const session = await requireTenantMember()
  const supabase = await createSupabaseServerClient()

  const { data: purchases } = await supabase
    .from('customer_purchases')
    .select(
      'id, customer_id, classes_total, payment_self_reported, created_at, services(name), service_packages(name), customers(display_name)',
    )
    .eq('tenant_id', session.tenantId)
    .eq('approval_status', 'pending_review')
    .order('created_at', { ascending: true })

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/packages"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          回套裝管理
        </Link>
        <h1 className="font-display text-3xl tracking-tight">
          <span className="italic">套裝審核佇列</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          學員提交的購買申請，確認收款後點「確認」開放餘額
        </p>
      </div>

      {!purchases || purchases.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <ClipboardCheck className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 font-medium text-slate-700">無待審核項目</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {purchases.map((p) => {
            const customer = p.customers as { display_name: string | null } | null
            const svc = p.services as { name: string } | null
            const pkg = p.service_packages as { name: string } | null
            return (
              <PurchaseRow
                key={p.id}
                purchase={{
                  id: p.id,
                  customerName: customer?.display_name ?? '匿名',
                  serviceName: svc?.name ?? '—',
                  packageName: pkg?.name ?? `${p.classes_total} 堂課`,
                  classesTotal: p.classes_total,
                  paymentSelfReported: p.payment_self_reported as
                    | 'claimed_paid'
                    | 'awaiting_payment',
                  createdAt: format(new Date(p.created_at), 'yyyy/MM/dd HH:mm'),
                }}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
