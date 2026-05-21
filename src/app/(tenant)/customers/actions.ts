'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { actionClient } from '@/lib/safe-action'
import { requireTenantMember } from '@/lib/auth/get-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AppError } from '@/lib/errors'

const ToggleBlockSchema = z.object({
  customerId: z.string().uuid(),
  isBlocked: z.boolean(),
})

export const toggleCustomerBlockAction = actionClient
  .inputSchema(ToggleBlockSchema)
  .action(async ({ parsedInput }) => {
    const session = await requireTenantMember()
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase
      .from('tenant_customers')
      .update({ is_blocked: parsedInput.isBlocked })
      .eq('tenant_id', session.tenantId)
      .eq('customer_id', parsedInput.customerId)
    if (error) throw new AppError('TOGGLE_BLOCK_FAILED', error.message)
    revalidatePath('/customers')
    return { ok: true }
  })
