import Link from 'next/link'
import { format } from 'date-fns'
import { ArrowLeft, ClipboardCheck } from 'lucide-react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { requireTenantMember } from '@/lib/auth/get-session'
import { SectionHead } from '@/components/ui/section-head'
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
      <Link
        href="/packages"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        回套裝管理
      </Link>

      <SectionHead
        kicker="PENDING REVIEW · 套裝審核"
        title="套裝審核佇列"
        eng="PENDING"
        hint="學員提交的購買申請，確認收款後點「確認」開放餘額"
      />

      {!purchases || purchases.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-16 text-center">
          <ClipboardCheck className="mx-auto size-10 text-muted-foreground" />
          <div className="font-mono mt-4 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">NO PENDING</div>
          <p className="font-cjk mt-2 text-sm text-muted-foreground">無待審核項目</p>
        </div>
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
