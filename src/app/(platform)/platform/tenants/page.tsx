import { Suspense } from 'react'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { Kicker } from '@/components/ui/kicker'
import { SectionHead } from '@/components/ui/section-head'
import InviteCoachForm from './invite-coach-form'
import TenantsTable from './tenants-table'

export default function TenantsListPage() {
  return (
    <div className="space-y-7">
      <header>
        <Kicker>PLATFORM · 平台後台</Kicker>
        <h1 className="mt-2 font-display font-cjk text-3xl font-black uppercase sm:text-4xl">
          租戶管理
        </h1>
        <p className="font-cjk mt-2 text-sm text-muted-foreground">
          邀請、暫停、重發邀請、重設密碼
        </p>
      </header>

      <InviteCoachForm />

      <section>
        <SectionHead kicker="TENANTS · 租戶列表" title="租戶列表" eng="ALL TENANTS" />
        <Suspense fallback={<TenantsListSkeleton />}>
          <TenantsList />
        </Suspense>
      </section>
    </div>
  )
}

async function TenantsList() {
  const supabase = createSupabaseAdminClient()

  const { data: tenants } = await supabase
    .from('tenants')
    .select('id, slug, name, status, created_at')
    .order('created_at', { ascending: false })

  const tenantIds = (tenants ?? []).map((t) => t.id)
  const { data: owners } =
    tenantIds.length === 0
      ? {
          data: [] as Array<{
            id: string
            tenant_id: string
            status: string
            invited_email: string | null
            user_id: string | null
          }>,
        }
      : await supabase
          .from('tenant_members')
          .select('id, tenant_id, status, invited_email, user_id')
          .in('tenant_id', tenantIds)
          .eq('role', 'owner')

  const ownerByTenant: Record<
    string,
    {
      id: string
      status: string
      invited_email: string | null
      user_id: string | null
    }
  > = {}
  for (const o of owners ?? []) {
    ownerByTenant[o.tenant_id] = {
      id: o.id,
      status: o.status,
      invited_email: o.invited_email,
      user_id: o.user_id,
    }
  }

  const enriched = (tenants ?? []).map((t) => ({
    ...t,
    ownerMember: ownerByTenant[t.id] ?? null,
  }))

  return <TenantsTable tenants={enriched} />
}

function TenantsListSkeleton() {
  return (
    <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="h-12 animate-pulse rounded-xl bg-muted/50"
          style={{ animationDelay: `${i * 60}ms` }}
        />
      ))}
    </div>
  )
}
