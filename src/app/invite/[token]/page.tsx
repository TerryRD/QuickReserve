import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/get-session'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import AcceptInviteButton from './accept-invite-button'

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  // Look up invite (server-side, uses admin client because invite_token is the auth proof)
  const supabase = createSupabaseAdminClient()
  const { data: invite } = await supabase
    .from('tenant_members')
    .select('id, status, invited_email, invite_expires_at, tenant:tenants(name, slug)')
    .eq('invite_token', token)
    .maybeSingle()

  if (!invite) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>邀請無效</CardTitle>
          </CardHeader>
          <CardContent>
            <p>此邀請連結不存在或已失效。</p>
          </CardContent>
        </Card>
      </main>
    )
  }

  if (invite.status !== 'invited') {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>邀請已被使用</CardTitle>
          </CardHeader>
          <CardContent>
            <Link href="/login" className={buttonVariants()}>
              前往登入
            </Link>
          </CardContent>
        </Card>
      </main>
    )
  }

  if (invite.invite_expires_at && new Date(invite.invite_expires_at) < new Date()) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>邀請已過期</CardTitle>
          </CardHeader>
          <CardContent>
            <p>請聯絡平台管理員重新發送邀請。</p>
          </CardContent>
        </Card>
      </main>
    )
  }

  const session = await getSession()
  if (!session) {
    // Not logged in — direct to signup with prefilled email
    const signupUrl = `/signup?invite=${token}&email=${encodeURIComponent(invite.invited_email ?? '')}`
    redirect(signupUrl)
  }

  const tenant = invite.tenant as { name: string; slug: string } | null

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>接受邀請</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {tenant && (
            <p>
              您被邀請成為 <strong>{tenant.name}</strong>（{tenant.slug}）的 Owner。
            </p>
          )}
          <p className="text-sm text-slate-600">登入帳號：{session.email}</p>
          <AcceptInviteButton token={token} />
        </CardContent>
      </Card>
    </main>
  )
}
