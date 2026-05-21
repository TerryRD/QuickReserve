'use server'

import { z } from 'zod'
import { randomBytes } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { actionClient } from '@/lib/safe-action'
import { requirePlatformAdmin } from '@/lib/auth/get-session'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { AppError, NotFoundError } from '@/lib/errors'

const ReinviteSchema = z.object({ memberId: z.string().uuid() })

export const reinviteOwnerAction = actionClient
  .inputSchema(ReinviteSchema)
  .action(async ({ parsedInput }) => {
    await requirePlatformAdmin()
    const supabase = createSupabaseAdminClient()

    const { data: member } = await supabase
      .from('tenant_members')
      .select('id, status, invited_email, role')
      .eq('id', parsedInput.memberId)
      .maybeSingle()
    if (!member) throw new NotFoundError('邀請')
    if (member.status !== 'invited')
      throw new AppError('ALREADY_ACTIVE', '此成員已加入，無需重新邀請')

    const newToken = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7)

    const { error } = await supabase
      .from('tenant_members')
      .update({
        invite_token: newToken,
        invite_expires_at: expiresAt.toISOString(),
      })
      .eq('id', parsedInput.memberId)
    if (error) throw new AppError('REINVITE_FAILED', error.message)

    revalidatePath('/platform/tenants')
    return {
      inviteUrl: `${process.env.NEXT_PUBLIC_APP_URL}/invite/${newToken}`,
    }
  })

const ResetPasswordSchema = z.object({ memberId: z.string().uuid() })

export const resetCoachPasswordAction = actionClient
  .inputSchema(ResetPasswordSchema)
  .action(async ({ parsedInput }) => {
    await requirePlatformAdmin()
    const supabase = createSupabaseAdminClient()

    const { data: member } = await supabase
      .from('tenant_members')
      .select('id, user_id, invited_email')
      .eq('id', parsedInput.memberId)
      .maybeSingle()
    if (!member || !member.user_id) throw new NotFoundError('成員或未啟用帳號')

    // Generate password recovery link
    const { data: link, error } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: member.invited_email!,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/login`,
      },
    })
    if (error) throw new AppError('RESET_LINK_FAILED', error.message)

    return {
      resetUrl: link.properties.action_link,
      email: member.invited_email,
    }
  })
