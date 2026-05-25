'use server'

import { z } from 'zod'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { revalidateTag } from 'next/cache'
import { actionClient } from '@/lib/safe-action'
import { requireSession } from '@/lib/auth/get-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AppError, SlotUnavailableError } from '@/lib/errors'
import { notifyBookingChange } from '@/lib/notify-booking'
import { publicSlotsTag } from '@/lib/cache-tags'

const CreateBookingSchema = z.object({
  slotId: z.string().uuid(),
  customerNotes: z.string().max(500).optional().nullable(),
  rescheduleFrom: z.string().uuid().optional().nullable(),
})

export const createBookingAction = actionClient
  .inputSchema(CreateBookingSchema)
  .action(async ({ parsedInput }) => {
    const session = await requireSession()
    const supabase = await createSupabaseServerClient()

    // Look up tenantId for cache invalidation (customer context has no tenantId)
    const { data: slotRow } = await supabase
      .from('availability_slots')
      .select('tenant_id')
      .eq('id', parsedInput.slotId)
      .maybeSingle()
    const tenantId = slotRow?.tenant_id ?? null

    // Reschedule path: cancel old + book new atomically via RPC
    if (parsedInput.rescheduleFrom) {
      const { data, error } = await supabase.rpc('reschedule_booking', {
        p_old_booking_id: parsedInput.rescheduleFrom,
        p_new_slot_id: parsedInput.slotId,
      })
      if (error) {
        if (error.message?.includes('SLOT_UNAVAILABLE')) throw new SlotUnavailableError()
        if (error.message?.includes('INVALID_STATE'))
          throw new AppError('INVALID_STATE', '原預約已無法改期')
        if (error.message?.includes('CROSS_TENANT'))
          throw new AppError('CROSS_TENANT', '不可跨教練改期')
        throw new AppError('RESCHEDULE_FAILED', error.message)
      }
      const newBooking = data as { id: string }
      void notifyBookingChange(parsedInput.rescheduleFrom, 'cancelled', session.userId)
      void notifyBookingChange(newBooking.id, 'created', session.userId)
      revalidatePath('/my-bookings')
      if (tenantId) revalidateTag(publicSlotsTag(tenantId))
      redirect(`/my-bookings?rescheduled=${newBooking.id}`)
    }

    const { data, error } = await supabase.rpc('book_slot_atomic', {
      p_slot_id: parsedInput.slotId,
      p_customer_id: session.userId,
      p_customer_notes: parsedInput.customerNotes ?? undefined,
    })
    if (error) {
      if (error.message?.includes('SLOT_UNAVAILABLE')) throw new SlotUnavailableError()
      if (error.message?.includes('SLOT_NOT_FOUND'))
        throw new AppError('SLOT_NOT_FOUND', '時段不存在')
      if (error.message?.includes('CUSTOMER_BLOCKED'))
        throw new AppError('CUSTOMER_BLOCKED', '此教練已封鎖您的預約')
      throw new AppError('BOOKING_FAILED', error.message)
    }
    const booking = data as { id: string }
    void notifyBookingChange(booking.id, 'created', session.userId)
    revalidatePath('/my-bookings')
    if (tenantId) revalidateTag(publicSlotsTag(tenantId))
    redirect(`/my-bookings?booked=${booking.id}`)
  })

const CancelMyBookingSchema = z.object({ bookingId: z.string().uuid() })

export const cancelMyBookingAction = actionClient
  .inputSchema(CancelMyBookingSchema)
  .action(async ({ parsedInput }) => {
    const session = await requireSession()
    const supabase = await createSupabaseServerClient()

    // Look up tenantId for cache invalidation (customer context has no tenantId)
    const { data: bookingRow } = await supabase
      .from('bookings')
      .select('tenant_id')
      .eq('id', parsedInput.bookingId)
      .maybeSingle()
    const tenantId = bookingRow?.tenant_id ?? null

    const { error } = await supabase.rpc('cancel_booking', { p_booking_id: parsedInput.bookingId })
    if (error) {
      if (error.message?.includes('INVALID_STATE'))
        throw new AppError('INVALID_STATE', '此預約已無法取消')
      if (error.message?.includes('FORBIDDEN')) throw new AppError('FORBIDDEN', '無權限')
      throw new AppError('CANCEL_FAILED', error.message)
    }
    void notifyBookingChange(parsedInput.bookingId, 'cancelled', session.userId)
    revalidatePath('/my-bookings')
    if (tenantId) revalidateTag(publicSlotsTag(tenantId))
    return { ok: true }
  })
