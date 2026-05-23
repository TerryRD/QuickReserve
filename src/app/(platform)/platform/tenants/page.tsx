import { createSupabaseAdminClient } from '@/lib/supabase/server'
import InviteCoachForm from './invite-coach-form'
import TenantsTable from './tenants-table'

export default async function TenantsListPage() {
  // Use admin client so we can join tenant_members.invite_email for owners
  // even when status='invited' (RLS would otherwise hide pre-acceptance rows
  // from cross-table joins).
  const supabase = createSupabaseAdminClient()

  // Step 1: fetch tenants
  const { data: tenants } = await supabase
    .from('tenants')
    .select('id, slug, name, status, created_at')
    .order('created_at', { ascending: false })

  // Step 2: fetch owners (depends on tenantIds, so must follow tenants)
  const tenantIds = (tenants ?? []).map((t) => t.id)
  const { data: owners } =
    tenantIds.length === 0
      ? { data: [] as Array<{
          id: string
          tenant_id: string
          status: string
          invited_email: string | null
          user_id: string | null
        }> }
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

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl tracking-tight">
          <span className="italic">租戶管理</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          邀請、暫停、重發邀請、重設密碼
        </p>
      </header>

      <InviteCoachForm />

      <section>
        <h2 className="mb-2 font-display text-xl">租戶列表</h2>
        <TenantsTable tenants={enriched} />
      </section>
    </div>
  )
}
