'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { revalidateTag } from 'next/cache'
import { actionClient } from '@/lib/safe-action'
import { requireTenantMember } from '@/lib/auth/get-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { toBookingAppError } from '@/lib/booking-rpc-errors'
import { notifyBookingChange } from '@/lib/notify-booking'
import { publicSlotsTag } from '@/lib/cache-tags'

const ConfirmSchema = z.object({ bookingId: z.string().uuid() })

export const confirmBookingAction = actionClient
  .inputSchema(ConfirmSchema)
  .action(async ({ parsedInput }) => {
    const session = await requireTenantMember()
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase.rpc('confirm_booking', { p_booking_id: parsedInput.bookingId })
    if (error) throw toBookingAppError(error)
    void notifyBookingChange(parsedInput.bookingId, 'confirmed', session.userId)
    revalidatePath('/bookings')
    revalidatePath(`/bookings/${parsedInput.bookingId}`)
    revalidatePath('/calendar')
    revalidateTag(publicSlotsTag(session.tenantId))
    return { ok: true }
  })

const CancelSchema = z.object({
  bookingId: z.string().uuid(),
  reason: z.string().trim().min(1, '請填寫原因').max(500, '原因請不要超過 500 字'),
})

export const cancelBookingByTenantAction = actionClient
  .inputSchema(CancelSchema)
  .action(async ({ parsedInput }) => {
    const session = await requireTenantMember()
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase.rpc('cancel_booking', {
      p_booking_id: parsedInput.bookingId,
      p_reason: parsedInput.reason,
    })
    if (error) throw toBookingAppError(error)
    void notifyBookingChange(parsedInput.bookingId, 'cancelled', session.userId)
    revalidatePath('/bookings')
    revalidatePath(`/bookings/${parsedInput.bookingId}`)
    revalidatePath('/calendar')
    revalidateTag(publicSlotsTag(session.tenantId))
    return { ok: true }
  })
