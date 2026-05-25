'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { actionClient } from '@/lib/safe-action'
import { requireTenantMember } from '@/lib/auth/get-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AppError, NotFoundError } from '@/lib/errors'
import { notifyPurchaseDecision } from '@/lib/notify-booking'

const ApproveSchema = z.object({ id: z.string().uuid() })

export const approvePurchaseAction = actionClient
  .inputSchema(ApproveSchema)
  .action(async ({ parsedInput }) => {
    const session = await requireTenantMember()
    const supabase = await createSupabaseServerClient()

    const { data: purchase } = await supabase
      .from('customer_purchases')
      .select(
        'id, tenant_id, customer_id, service_id, package_id, classes_total, approval_status, service_packages(expires_in_days)',
      )
      .eq('id', parsedInput.id)
      .maybeSingle()
    if (!purchase) throw new NotFoundError('購買記錄')
    if (purchase.tenant_id !== session.tenantId) throw new NotFoundError('購買記錄')
    if (purchase.approval_status !== 'pending_review')
      throw new AppError('INVALID_STATE', '只能審核待審核狀態的購買')

    const now = new Date()
    const pkg = purchase.service_packages as { expires_in_days: number | null } | null
    const expiresAt =
      pkg?.expires_in_days != null
        ? new Date(now.getTime() + pkg.expires_in_days * 24 * 3600 * 1000).toISOString()
        : null

    const { error } = await supabase
      .from('customer_purchases')
      .update({
        approval_status: 'confirmed',
        approved_at: now.toISOString(),
        approved_by: session.userId,
        expires_at: expiresAt,
      })
      .eq('id', parsedInput.id)
    if (error) throw new AppError('APPROVE_FAILED', error.message)

    void notifyPurchaseDecision(parsedInput.id, 'approved', session.userId)
    revalidatePath('/packages/pending')
    return { ok: true }
  })

const RejectSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().min(1).max(200),
})

export const rejectPurchaseAction = actionClient
  .inputSchema(RejectSchema)
  .action(async ({ parsedInput }) => {
    const session = await requireTenantMember()
    const supabase = await createSupabaseServerClient()

    const { data: purchase } = await supabase
      .from('customer_purchases')
      .select('tenant_id, approval_status')
      .eq('id', parsedInput.id)
      .maybeSingle()
    if (!purchase || purchase.tenant_id !== session.tenantId) throw new NotFoundError('購買記錄')
    if (purchase.approval_status !== 'pending_review')
      throw new AppError('INVALID_STATE', '只能審核待審核狀態的購買')

    const { error } = await supabase
      .from('customer_purchases')
      .update({
        approval_status: 'rejected',
        approved_at: new Date().toISOString(),
        approved_by: session.userId,
        rejected_reason: parsedInput.reason,
      })
      .eq('id', parsedInput.id)
    if (error) throw new AppError('REJECT_FAILED', error.message)

    void notifyPurchaseDecision(parsedInput.id, 'rejected', session.userId)
    revalidatePath('/packages/pending')
    return { ok: true }
  })
