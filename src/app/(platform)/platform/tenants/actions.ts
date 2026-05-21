'use server'

import { z } from 'zod'
import { randomBytes } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { actionClient } from '@/lib/safe-action'
import { requirePlatformAdmin } from '@/lib/auth/get-session'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { AppError } from '@/lib/errors'

const SlugSchema = z
  .string()
  .min(2, 'slug 至少 2 個字')
  .max(40, 'slug 最多 40 個字')
  .regex(/^[a-z0-9-]+$/, '只允許小寫英數與短橫線')

const InviteCoachSchema = z.object({
  email: z.string().email('Email 格式不正確'),
  tenantName: z.string().min(1, '請填租戶名稱').max(60),
  tenantSlug: SlugSchema,
})

export const inviteCoachAction = actionClient
  .inputSchema(InviteCoachSchema)
  .action(async ({ parsedInput }) => {
    await requirePlatformAdmin()
    const supabase = createSupabaseAdminClient()

    // 1. Check slug is free
    const { data: existing } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', parsedInput.tenantSlug)
      .maybeSingle()
    if (existing) throw new AppError('SLUG_TAKEN', '該 slug 已被使用')

    // 2. Create tenant
    const { data: tenant, error: tenantErr } = await supabase
      .from('tenants')
      .insert({
        slug: parsedInput.tenantSlug,
        name: parsedInput.tenantName,
        status: 'active',
      })
      .select('id')
      .single()
    if (tenantErr || !tenant)
      throw new AppError('TENANT_CREATE_FAILED', tenantErr?.message ?? '建立租戶失敗')

    // 3. Create pending invite row (user_id null until accepted)
    const inviteToken = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7) // 7 days

    const { error: memberErr } = await supabase.from('tenant_members').insert({
      tenant_id: tenant.id,
      user_id: null,
      role: 'owner',
      status: 'invited',
      invited_email: parsedInput.email,
      invite_token: inviteToken,
      invite_expires_at: expiresAt.toISOString(),
    })
    if (memberErr) {
      // Roll back tenant
      await supabase.from('tenants').delete().eq('id', tenant.id)
      throw new AppError('INVITE_CREATE_FAILED', memberErr.message)
    }

    revalidatePath('/platform/tenants')

    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${inviteToken}`
    return {
      inviteUrl,
      tenantId: tenant.id,
    }
  })
