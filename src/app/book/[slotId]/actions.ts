'use server'

import { z } from 'zod'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { actionClient } from '@/lib/safe-action'
import { requireSession } from '@/lib/auth/get-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AppError, SlotUnavailableError } from '@/lib/errors'
import { notifyBookingChange } from '@/lib/notify-booking'

const CreateBookingSchema = z.object({
  slotId: z.string().uuid(),
  customerNotes: z.string().max(500).optional().nullable(),
})

export const createBookingAction = actionClient
  .inputSchema(CreateBookingSchema)
  .action(async ({ parsedInput }) => {
    const session = await requireSession()
    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase.rpc('book_slot_atomic', {
      p_slot_id: parsedInput.slotId,
      p_customer_id: session.userId,
      p_customer_notes: parsedInput.customerNotes ?? undefined,
    })
    if (error) {
      if (error.message?.includes('SLOT_UNAVAILABLE')) throw new SlotUnavailableError()
      if (error.message?.includes('SLOT_NOT_FOUND')) throw new AppError('SLOT_NOT_FOUND', '時段不存在')
      throw new AppError('BOOKING_FAILED', error.message)
    }
    const booking = data as { id: string }
    void notifyBookingChange(booking.id, 'created', session.userId)
    revalidatePath('/my-bookings')
    redirect(`/my-bookings?booked=${booking.id}`)
  })

const CancelMyBookingSchema = z.object({ bookingId: z.string().uuid() })

export const cancelMyBookingAction = actionClient
  .inputSchema(CancelMyBookingSchema)
  .action(async ({ parsedInput }) => {
    const session = await requireSession()
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase.rpc('cancel_booking', { p_booking_id: parsedInput.bookingId })
    if (error) {
      if (error.message?.includes('INVALID_STATE'))
        throw new AppError('INVALID_STATE', '此預約已無法取消')
      if (error.message?.includes('FORBIDDEN')) throw new AppError('FORBIDDEN', '無權限')
      throw new AppError('CANCEL_FAILED', error.message)
    }
    void notifyBookingChange(parsedInput.bookingId, 'cancelled', session.userId)
    revalidatePath('/my-bookings')
    return { ok: true }
  })
