'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { actionClient } from '@/lib/safe-action'
import { requireSession } from '@/lib/auth/get-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AppError, NotFoundError } from '@/lib/errors'

const RequestSchema = z.object({
  packageId: z.string().uuid(),
  paymentSelfReported: z.enum(['claimed_paid', 'awaiting_payment']),
})

export const requestPurchaseAction = actionClient
  .inputSchema(RequestSchema)
  .action(async ({ parsedInput }) => {
    const session = await requireSession()
    const supabase = await createSupabaseServerClient()

    const { data: pkg } = await supabase
      .from('service_packages')
      .select('id, tenant_id, service_id, class_count, is_active')
      .eq('id', parsedInput.packageId)
      .maybeSingle()
    if (!pkg || !pkg.is_active) throw new NotFoundError('套裝')

    // Ensure tenant_customers bridge
    await supabase
      .from('tenant_customers')
      .upsert(
        { tenant_id: pkg.tenant_id, customer_id: session.userId },
        { onConflict: 'tenant_id,customer_id' },
      )

    const { error } = await supabase.from('customer_purchases').insert({
      tenant_id: pkg.tenant_id,
      customer_id: session.userId,
      service_id: pkg.service_id,
      package_id: pkg.id,
      classes_total: pkg.class_count,
      classes_used: 0,
      payment_self_reported: parsedInput.paymentSelfReported,
      approval_status: 'pending_review',
    })
    if (error) throw new AppError('REQUEST_FAILED', error.message)

    revalidatePath('/[tenantSlug]/packages', 'layout')
    return { ok: true }
  })
