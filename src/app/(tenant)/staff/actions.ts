'use server'

import { z } from 'zod'
import { randomBytes } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { actionClient } from '@/lib/safe-action'
import { requireTenantOwner } from '@/lib/auth/get-session'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { AppError, NotFoundError } from '@/lib/errors'

const InviteStaffSchema = z.object({
  email: z.string().email('Email 格式不正確'),
})

export const inviteStaffAction = actionClient
  .inputSchema(InviteStaffSchema)
  .action(async ({ parsedInput }) => {
    const session = await requireTenantOwner()
    const supabase = createSupabaseAdminClient()

    const inviteToken = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7) // 7 days

    const { error } = await supabase.from('tenant_members').insert({
      tenant_id: session.tenantId,
      user_id: null,
      role: 'staff',
      status: 'invited',
      invited_email: parsedInput.email,
      invite_token: inviteToken,
      invite_expires_at: expiresAt.toISOString(),
    })
    if (error) throw new AppError('INVITE_CREATE_FAILED', error.message)

    revalidatePath('/staff')
    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${inviteToken}`
    return { inviteUrl }
  })

const RemoveStaffSchema = z.object({ memberId: z.string().uuid() })

export const removeStaffAction = actionClient
  .inputSchema(RemoveStaffSchema)
  .action(async ({ parsedInput }) => {
    const session = await requireTenantOwner()
    const supabase = createSupabaseAdminClient()

    // Verify member belongs to this tenant and is staff
    const { data: member } = await supabase
      .from('tenant_members')
      .select('id, tenant_id, role')
      .eq('id', parsedInput.memberId)
      .maybeSingle()
    if (!member) throw new NotFoundError('助教')
    if (member.tenant_id !== session.tenantId) throw new NotFoundError('助教')
    if (member.role === 'owner') throw new AppError('CANNOT_REMOVE_OWNER', '無法移除 Owner')

    // Soft-remove (status='removed') instead of hard delete so historical bookings stay intact
    const { error } = await supabase
      .from('tenant_members')
      .update({ status: 'removed' })
      .eq('id', parsedInput.memberId)
    if (error) throw new AppError('REMOVE_FAILED', error.message)
    revalidatePath('/staff')
    return { ok: true }
  })
