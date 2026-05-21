import { createSupabaseServerClient } from '@/lib/supabase/server'
import { ForbiddenError } from '@/lib/errors'

export type AppUserRole =
  | 'platform_admin'
  | 'tenant_owner'
  | 'tenant_staff'
  | 'customer'
  | 'anonymous'

export type Session = {
  userId: string
  email: string | null
  role: AppUserRole
  tenantId: string | null
  memberId: string | null
}

/**
 * Returns the calling user's session and resolved role.
 * Returns null for anonymous (unauthenticated) callers.
 */
export async function getSession(): Promise<Session | null> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  // Look up role - check platform_admin first, then tenant_member, else customer
  const [{ data: adminRow }, { data: memberRow }] = await Promise.all([
    supabase.from('platform_admins').select('user_id').eq('user_id', user.id).maybeSingle(),
    supabase
      .from('tenant_members')
      .select('id, tenant_id, role, status')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle(),
  ])

  let role: AppUserRole = 'customer'
  let tenantId: string | null = null
  let memberId: string | null = null

  if (adminRow) {
    role = 'platform_admin'
  } else if (memberRow) {
    role = memberRow.role === 'owner' ? 'tenant_owner' : 'tenant_staff'
    tenantId = memberRow.tenant_id
    memberId = memberRow.id
  }

  return {
    userId: user.id,
    email: user.email ?? null,
    role,
    tenantId,
    memberId,
  }
}

export async function requireSession(): Promise<Session> {
  const s = await getSession()
  if (!s) throw new ForbiddenError('未登入')
  return s
}

export async function requirePlatformAdmin(): Promise<Session> {
  const s = await requireSession()
  if (s.role !== 'platform_admin') throw new ForbiddenError('需平台管理員權限')
  return s
}

export async function requireTenantMember(): Promise<
  Session & { tenantId: string; memberId: string }
> {
  const s = await requireSession()
  if (s.role !== 'tenant_owner' && s.role !== 'tenant_staff')
    throw new ForbiddenError('需教練/助教身分')
  if (!s.tenantId || !s.memberId) throw new ForbiddenError('租戶資訊缺失')
  return s as Session & { tenantId: string; memberId: string }
}

export async function requireTenantOwner(): Promise<
  Session & { tenantId: string; memberId: string }
> {
  const s = await requireTenantMember()
  if (s.role !== 'tenant_owner') throw new ForbiddenError('需 Owner 身分')
  return s
}
