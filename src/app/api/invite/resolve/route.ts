import { type NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

// Public endpoint: resolves an invite token to its tenant name/slug so the
// /signup page can render "您被 {tenant_name} 邀請..." instead of a generic
// banner. The token itself is the auth proof — anyone holding it can already
// reach /invite/[token] and read the same info via the existing server page.
// Returns the same shape regardless of failure reason (no row / wrong status /
// expired) to avoid leaking which tokens exist.

export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get('token')
  if (!token) {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  const admin = createSupabaseAdminClient()
  const { data: invite } = await admin
    .from('tenant_members')
    .select('status, invite_expires_at, tenant:tenants(name, slug)')
    .eq('invite_token', token)
    .maybeSingle()

  if (!invite || invite.status !== 'invited') {
    return NextResponse.json({ ok: false }, { status: 404 })
  }
  if (invite.invite_expires_at && new Date(invite.invite_expires_at) < new Date()) {
    return NextResponse.json({ ok: false }, { status: 404 })
  }

  const tenant = invite.tenant as { name: string; slug: string } | null
  if (!tenant) {
    return NextResponse.json({ ok: false }, { status: 404 })
  }

  return NextResponse.json({
    ok: true,
    tenant_name: tenant.name,
    tenant_slug: tenant.slug,
  })
}
