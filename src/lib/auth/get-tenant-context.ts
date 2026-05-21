import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase/server'
import { NotFoundError } from '@/lib/errors'

export type TenantContext = {
  id: string
  slug: string
  name: string
  status: 'active' | 'suspended'
}

export async function getTenantContext(tenantId: string): Promise<TenantContext> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('tenants')
    .select('id, slug, name, status')
    .eq('id', tenantId)
    .single()
  if (error || !data) throw new NotFoundError('租戶')
  return data as TenantContext
}

/**
 * Public lookup by slug (the slug is in the URL, so already public knowledge).
 * Uses admin client so we can return suspended tenants too — the page handler
 * is responsible for rendering the "suspended" state. Without this, anonymous
 * users would see a generic 404 instead of "服務暫停中".
 */
export async function getTenantBySlug(slug: string): Promise<TenantContext | null> {
  const admin = createSupabaseAdminClient()
  const { data } = await admin
    .from('tenants')
    .select('id, slug, name, status')
    .eq('slug', slug)
    .maybeSingle()
  return (data as TenantContext) ?? null
}
