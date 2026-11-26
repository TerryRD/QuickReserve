'use server'

import { z } from 'zod'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { revalidateTag } from 'next/cache'
import { actionClient } from '@/lib/safe-action'
import { requireSession } from '@/lib/auth/get-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AppError } from '@/lib/errors'
import { toBookingAppError } from '@/lib/booking-rpc-errors'
import { notifyBookingChange, notifyGroupAutoConfirm } from '@/lib/notify-booking'
import { notifyCheckinDone } from '@/lib/notify-checkin'
import { publicSlotsTag } from '@/lib/cache-tags'

const CreateBookingSchema = z.object({
  slotId: z.string().uuid(),
  customerNotes: z.string().max(500).optional().nullable(),
  rescheduleFrom: z.string().uuid().optional().nullable(),
  purchaseId: z.string().uuid().optional().nullable(),
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
      if (error) throw toBookingAppError(error)
      const newBooking = data as { id: string }
      void notifyBookingChange(parsedInput.rescheduleFrom, 'cancelled', session.userId)
      void notifyBookingChange(newBooking.id, 'created', session.userId)
      revalidatePath('/my-bookings', 'layout')
      if (tenantId) revalidateTag(publicSlotsTag(tenantId))
      redirect(`/my-bookings?rescheduled=${newBooking.id}`)
    }

    const { data, error } = await supabase.rpc('book_with_purchase', {
      p_slot_id: parsedInput.slotId,
      p_customer_id: session.userId,
      p_customer_notes: parsedInput.customerNotes ?? undefined,
      p_purchase_id: parsedInput.purchaseId ?? undefined,
    })
    if (error) throw toBookingAppError(error)
    const result = (data as Array<{ booking_id: string; auto_confirmed: boolean }>)[0]
    if (!result) {
      console.error('[book_with_purchase] empty result', { slotId: parsedInput.slotId })
      throw new AppError('BOOKING_FAILED', '操作失敗，請稍後再試')
    }
    const booking = { id: result.booking_id }
    if (result.auto_confirmed) {
      void notifyGroupAutoConfirm(parsedInput.slotId)
    }
    void notifyBookingChange(booking.id, 'created', session.userId)
    revalidatePath('/my-bookings', 'layout')
    if (tenantId) revalidateTag(publicSlotsTag(tenantId))
    redirect(`/my-bookings?booked=${booking.id}`)
  })

const CancelMyBookingSchema = z.object({
  bookingId: z.string().uuid(),
  reason: z.string().trim().min(1, '請填寫原因').max(500, '原因請不要超過 500 字'),
})

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

    const { data, error } = await supabase.rpc('cancel_booking', {
      p_booking_id: parsedInput.bookingId,
      p_reason: parsedInput.reason,
    })
    if (error) throw toBookingAppError(error)
    void notifyBookingChange(parsedInput.bookingId, 'cancelled', session.userId)
    revalidatePath('/my-bookings', 'layout')
    if (tenantId) revalidateTag(publicSlotsTag(tenantId))
    // 以資料庫實際寫入的堂數處理為準，畫面上的提示可能因停留太久而過期
    return { ok: true, classDisposition: data?.class_disposition ?? null }
  })

const CheckinBookingSchema = z.object({ bookingId: z.string().uuid() })

export const checkinBookingAction = actionClient
  .inputSchema(CheckinBookingSchema)
  .action(async ({ parsedInput }) => {
    await requireSession()
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase.rpc('checkin_booking', { p_booking_id: parsedInput.bookingId })
    if (error) throw toBookingAppError(error)
    void notifyCheckinDone(parsedInput.bookingId)
    revalidatePath('/my-bookings', 'layout')
    return { ok: true }
  })
