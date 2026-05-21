'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { actionClient } from '@/lib/safe-action'
import { requirePlatformAdmin } from '@/lib/auth/get-session'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { AppError } from '@/lib/errors'

const SetTenantStatusSchema = z.object({
  tenantId: z.string().uuid(),
  status: z.enum(['active', 'suspended']),
})

export const setTenantStatusAction = actionClient
  .inputSchema(SetTenantStatusSchema)
  .action(async ({ parsedInput }) => {
    await requirePlatformAdmin()
    const supabase = createSupabaseAdminClient()
    const { error } = await supabase
      .from('tenants')
      .update({ status: parsedInput.status })
      .eq('id', parsedInput.tenantId)
    if (error) throw new AppError('TENANT_STATUS_FAILED', error.message)
    revalidatePath('/platform/tenants')
    revalidatePath('/platform/dashboard')
    return { ok: true }
  })
