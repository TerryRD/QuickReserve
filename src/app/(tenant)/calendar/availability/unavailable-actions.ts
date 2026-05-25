'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { actionClient } from '@/lib/safe-action'
import { requireTenantMember } from '@/lib/auth/get-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AppError } from '@/lib/errors'

const CreateEventSchema = z
  .object({
    startAt: z.string().datetime(),
    endAt: z.string().datetime(),
    reason: z.string().max(200).optional().nullable(),
  })
  .refine((v) => new Date(v.endAt) > new Date(v.startAt), {
    message: '結束時間需晚於開始時間',
    path: ['endAt'],
  })

export const createUnavailableEventAction = actionClient
  .inputSchema(CreateEventSchema)
  .action(async ({ parsedInput }) => {
    const session = await requireTenantMember()
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase.from('unavailable_events').insert({
      member_id: session.memberId,
      start_at: parsedInput.startAt,
      end_at: parsedInput.endAt,
      reason: parsedInput.reason ?? null,
    })
    if (error) throw new AppError('EVENT_CREATE_FAILED', error.message)
    revalidatePath('/calendar/availability')
    revalidatePath('/calendar')
    return { ok: true }
  })

const DeleteSchema = z.object({ eventId: z.string().uuid() })

export const deleteUnavailableEventAction = actionClient
  .inputSchema(DeleteSchema)
  .action(async ({ parsedInput }) => {
    await requireTenantMember()
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase
      .from('unavailable_events')
      .delete()
      .eq('id', parsedInput.eventId)
    if (error) throw new AppError('EVENT_DELETE_FAILED', error.message)
    revalidatePath('/calendar/availability')
    revalidatePath('/calendar')
    return { ok: true }
  })
