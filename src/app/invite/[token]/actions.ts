'use server'

import { z } from 'zod'
import { redirect } from 'next/navigation'
import { actionClient } from '@/lib/safe-action'
import { requireSession } from '@/lib/auth/get-session'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { AppError, NotFoundError } from '@/lib/errors'

const AcceptInviteSchema = z.object({
  token: z.string().length(64),
})

export const acceptInviteAction = actionClient
  .inputSchema(AcceptInviteSchema)
  .action(async ({ parsedInput }) => {
    const session = await requireSession()
    const supabase = createSupabaseAdminClient()

    // 1. Find invite row by token
    const { data: invite, error: lookupErr } = await supabase
      .from('tenant_members')
      .select('id, tenant_id, role, status, invited_email, invite_expires_at')
      .eq('invite_token', parsedInput.token)
      .maybeSingle()
    if (lookupErr || !invite) throw new NotFoundError('邀請')

    // 2. Validate invite state
    if (invite.status !== 'invited') throw new AppError('INVITE_USED', '此邀請已被使用')
    if (invite.invite_expires_at && new Date(invite.invite_expires_at) < new Date())
      throw new AppError('INVITE_EXPIRED', '邀請已過期')
    if (
      invite.invited_email &&
      session.email &&
      invite.invited_email.toLowerCase() !== session.email.toLowerCase()
    )
      throw new AppError('INVITE_EMAIL_MISMATCH', '邀請的 Email 與您登入的帳號不符')

    // 3. Assign to current user, mark as active, clear token
    const { error: updateErr } = await supabase
      .from('tenant_members')
      .update({
        user_id: session.userId,
        status: 'active',
        invite_token: null,
        invite_expires_at: null,
      })
      .eq('id', invite.id)
    if (updateErr) throw new AppError('INVITE_ACCEPT_FAILED', updateErr.message)

    redirect('/dashboard')
  })
