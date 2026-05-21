import { createSupabaseServerClient } from '@/lib/supabase/server'
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

export async function getTenantBySlug(slug: string): Promise<TenantContext | null> {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from('tenants')
    .select('id, slug, name, status')
    .eq('slug', slug)
    .maybeSingle()
  return (data as TenantContext) ?? null
}
