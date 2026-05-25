'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { revalidateTag } from 'next/cache'
import { actionClient } from '@/lib/safe-action'
import { requireTenantMember } from '@/lib/auth/get-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AppError, SlotConflictError } from '@/lib/errors'
import { findConflictingSlots, isExclusionViolation } from '@/lib/conflicts'
import { publicSlotsTag } from '@/lib/cache-tags'
import { validateInEffectiveRange } from '@/lib/availability-server'

const CreateSlotSchema = z.object({
  serviceId: z.string().uuid(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
})

export const createSlotAction = actionClient
  .inputSchema(CreateSlotSchema)
  .action(async ({ parsedInput }) => {
    const session = await requireTenantMember()
    const supabase = await createSupabaseServerClient()
    const startAt = new Date(parsedInput.startAt)
    const endAt = new Date(parsedInput.endAt)
    const inRange = await validateInEffectiveRange(
      supabase,
      session.memberId,
      startAt,
      endAt,
    )
    if (!inRange) {
      throw new AppError(
        'OUT_OF_AVAILABILITY',
        '時段超出可上課時段範圍（檢查作息模板與不可用事件）',
      )
    }
    const { error } = await supabase.from('availability_slots').insert({
      tenant_id: session.tenantId,
      member_id: session.memberId,
      service_id: parsedInput.serviceId,
      start_at: parsedInput.startAt,
      end_at: parsedInput.endAt,
      status: 'available',
    })
    if (error) {
      if (isExclusionViolation(error)) {
        const conflicts = await findConflictingSlots(supabase, {
          memberId: session.memberId,
          startAt: parsedInput.startAt,
          endAt: parsedInput.endAt,
        })
        throw new SlotConflictError(conflicts)
      }
      throw new AppError('SLOT_CREATE_FAILED', error.message)
    }
    revalidatePath('/calendar')
    revalidateTag(publicSlotsTag(session.tenantId))
    return { ok: true }
  })

const DeleteSlotSchema = z.object({ id: z.string().uuid() })

export const deleteSlotAction = actionClient
  .inputSchema(DeleteSlotSchema)
  .action(async ({ parsedInput }) => {
    const session = await requireTenantMember()
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase.from('availability_slots').delete().eq('id', parsedInput.id)
    if (error) throw new AppError('SLOT_DELETE_FAILED', error.message)
    revalidatePath('/calendar')
    revalidateTag(publicSlotsTag(session.tenantId))
    return { ok: true }
  })
