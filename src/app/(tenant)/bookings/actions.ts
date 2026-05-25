'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { revalidateTag } from 'next/cache'
import { actionClient } from '@/lib/safe-action'
import { requireTenantMember } from '@/lib/auth/get-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AppError } from '@/lib/errors'
import { notifyBookingChange } from '@/lib/notify-booking'
import { publicSlotsTag } from '@/lib/cache-tags'

const ConfirmSchema = z.object({ bookingId: z.string().uuid() })

export const confirmBookingAction = actionClient
  .inputSchema(ConfirmSchema)
  .action(async ({ parsedInput }) => {
    const session = await requireTenantMember()
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase.rpc('confirm_booking', { p_booking_id: parsedInput.bookingId })
    if (error) {
      if (error.message?.includes('INVALID_STATE'))
        throw new AppError('INVALID_STATE', '此預約狀態無法確認')
      if (error.message?.includes('FORBIDDEN')) throw new AppError('FORBIDDEN', '無權限')
      throw new AppError('CONFIRM_FAILED', error.message)
    }
    void notifyBookingChange(parsedInput.bookingId, 'confirmed', session.userId)
    revalidatePath('/bookings')
    revalidatePath('/calendar')
    revalidateTag(publicSlotsTag(session.tenantId))
    return { ok: true }
  })

const CancelSchema = z.object({ bookingId: z.string().uuid() })

export const cancelBookingByTenantAction = actionClient
  .inputSchema(CancelSchema)
  .action(async ({ parsedInput }) => {
    const session = await requireTenantMember()
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase.rpc('cancel_booking', { p_booking_id: parsedInput.bookingId })
    if (error) throw new AppError('CANCEL_FAILED', error.message)
    void notifyBookingChange(parsedInput.bookingId, 'cancelled', session.userId)
    revalidatePath('/bookings')
    revalidatePath('/calendar')
    revalidateTag(publicSlotsTag(session.tenantId))
    return { ok: true }
  })
