import Link from 'next/link'
import { format, startOfMonth, subDays } from 'date-fns'
import { ArrowLeft, ClipboardCheck, Clock, Inbox, ListChecks, TrendingUp } from 'lucide-react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { requireTenantMember } from '@/lib/auth/get-session'
import { SectionHead } from '@/components/ui/section-head'
import { KpiCard } from '@/components/ui/kpi-card'
import { EmptyState } from '@/components/ui/empty-state'
import PurchaseRow from './purchase-row'

export default async function PendingPurchasesPage() {
  const session = await requireTenantMember()
  const supabase = await createSupabaseServerClient()

  const now = new Date()
  const weekStart = subDays(now, 7).toISOString()
  const monthStart = startOfMonth(now).toISOString()

  const [purchasesRes, totalPendingRes, weekNewRes, approvedMonthRes] = await Promise.all([
    supabase
      .from('customer_purchases')
      .select(
        'id, customer_id, classes_total, payment_self_reported, created_at, services(name), service_packages(name), customers(display_name)',
      )
      .eq('tenant_id', session.tenantId)
      .eq('approval_status', 'pending_review')
      .order('created_at', { ascending: true }),
    supabase
      .from('customer_purchases')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', session.tenantId)
      .eq('approval_status', 'pending_review'),
    supabase
      .from('customer_purchases')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', session.tenantId)
      .eq('approval_status', 'pending_review')
      .gte('created_at', weekStart),
    supabase
      .from('customer_purchases')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', session.tenantId)
      .eq('approval_status', 'confirmed')
      .gte('approved_at', monthStart),
  ])

  const purchases = purchasesRes.data ?? []
  const totalPending = totalPendingRes.count ?? 0
  const weekNew = weekNewRes.count ?? 0
  const approvedMonth = approvedMonthRes.count ?? 0

  const oldest = purchases.reduce<Date | null>((acc, p) => {
    const d = new Date(p.created_at)
    return !acc || d < acc ? d : acc
  }, null)
  const oldestDays = oldest
    ? Math.floor((Date.now() - oldest.getTime()) / 86400000)
    : 0

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

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="總待審"
          value={totalPending}
          unit="筆"
          hint={totalPending === 0 ? '一切就緒' : '需要您回覆確認'}
          icon={<Inbox className="size-3.5" />}
          accent={totalPending > 0}
        />
        <KpiCard
          label="等待最久"
          value={oldestDays}
          unit="天"
          hint={oldest ? '最早一筆申請' : '尚無待審'}
          icon={<Clock className="size-3.5" />}
        />
        <KpiCard
          label="本週新進"
          value={weekNew}
          unit="筆"
          hint="近 7 天新提交"
          icon={<TrendingUp className="size-3.5" />}
        />
        <KpiCard
          label="本月通過"
          value={approvedMonth}
          unit="筆"
          hint="本月已核可"
          icon={<ListChecks className="size-3.5" />}
        />
      </section>

      {purchases.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheck className="size-5" />}
          title="NO PENDING"
          hint="無待審核項目"
        />
      ) : (
        <div className="space-y-3">
          {purchases.map((p, i) => {
            const customer = p.customers as { display_name: string | null } | null
            const svc = p.services as { name: string } | null
            const pkg = p.service_packages as { name: string } | null
            return (
              <PurchaseRow
                key={p.id}
                emphasized={i === 0}
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
