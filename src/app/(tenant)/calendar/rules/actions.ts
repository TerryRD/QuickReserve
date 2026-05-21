'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { actionClient } from '@/lib/safe-action'
import { requireTenantMember } from '@/lib/auth/get-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AppError, NotFoundError } from '@/lib/errors'

const RuleIdSchema = z.object({ id: z.string().uuid() })

export const toggleRuleActiveAction = actionClient
  .inputSchema(z.object({ id: z.string().uuid(), isActive: z.boolean() }))
  .action(async ({ parsedInput }) => {
    const session = await requireTenantMember()
    const supabase = await createSupabaseServerClient()
    const { data: rule } = await supabase
      .from('recurring_rules')
      .select('id, tenant_id, member_id')
      .eq('id', parsedInput.id)
      .maybeSingle()
    if (!rule) throw new NotFoundError('重複規則')
    if (rule.tenant_id !== session.tenantId) throw new NotFoundError('重複規則')
    // Staff can only toggle own; Owner can toggle any
    if (session.role !== 'tenant_owner' && rule.member_id !== session.memberId)
      throw new AppError('FORBIDDEN', '只能變更自己的規則')

    const { error } = await supabase
      .from('recurring_rules')
      .update({ is_active: parsedInput.isActive })
      .eq('id', parsedInput.id)
    if (error) throw new AppError('TOGGLE_FAILED', error.message)
    revalidatePath('/calendar/rules')
    revalidatePath('/calendar')
    return { ok: true }
  })

export const deleteRuleAction = actionClient
  .inputSchema(
    z.object({
      id: z.string().uuid(),
      deleteFutureSlots: z.boolean().default(false),
    }),
  )
  .action(async ({ parsedInput }) => {
    const session = await requireTenantMember()
    const supabase = await createSupabaseServerClient()
    const { data: rule } = await supabase
      .from('recurring_rules')
      .select('id, tenant_id, member_id')
      .eq('id', parsedInput.id)
      .maybeSingle()
    if (!rule) throw new NotFoundError('重複規則')
    if (rule.tenant_id !== session.tenantId) throw new NotFoundError('重複規則')
    if (session.role !== 'tenant_owner' && rule.member_id !== session.memberId)
      throw new AppError('FORBIDDEN', '只能刪除自己的規則')

    let removedSlots = 0
    if (parsedInput.deleteFutureSlots) {
      // Delete only future, non-cancelled, available slots from this rule
      const { data: deleted, error: delErr } = await supabase
        .from('availability_slots')
        .delete()
        .eq('recurring_rule_id', parsedInput.id)
        .eq('status', 'available')
        .gte('start_at', new Date().toISOString())
        .select('id')
      if (delErr) throw new AppError('SLOT_DELETE_FAILED', delErr.message)
      removedSlots = deleted?.length ?? 0
    }

    // Delete the rule itself. Remaining slots' recurring_rule_id becomes NULL
    // via the FK ON DELETE SET NULL constraint from Plan 3.
    const { error: ruleErr } = await supabase
      .from('recurring_rules')
      .delete()
      .eq('id', parsedInput.id)
    if (ruleErr) throw new AppError('RULE_DELETE_FAILED', ruleErr.message)

    revalidatePath('/calendar/rules')
    revalidatePath('/calendar')
    return { ok: true, removedSlots }
  })
