// src/lib/notify-checkin.ts
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { pushToUser } from '@/lib/push'

const tzLabel = (iso: string) =>
  new Date(new Date(iso).getTime() + 8 * 3600 * 1000).toLocaleString('zh-TW')

/** Flow 1: student checked in -> notify the slot's coach. Called from the check-in action. */
export async function notifyCheckinDone(bookingId: string): Promise<void> {
  try {
    const admin = createSupabaseAdminClient()
    const { data: b } = await admin
      .from('bookings')
      .select('id, customers(display_name), services(name), availability_slots(start_at, tenant_members(user_id))')
      .eq('id', bookingId)
      .maybeSingle()
    if (!b) return
    const customer = b.customers as { display_name: string | null } | null
    const service = b.services as { name: string } | null
    const slot = b.availability_slots as { start_at: string; tenant_members: { user_id: string | null } | null } | null
    const coachUserId = slot?.tenant_members?.user_id ?? null
    if (!coachUserId) return
    await pushToUser(admin, {
      userId: coachUserId,
      type: 'checkin_done',
      payload: {
        title: '學員已簽到',
        body: `${customer?.display_name ?? '學員'} 已簽到（${service?.name ?? '課程'} ${slot ? tzLabel(slot.start_at) : ''}）`,
        url: '/calendar',
        tag: `checkin-${bookingId}`,
      },
      relatedId: bookingId,
    })
  } catch (err) {
    console.error('[notify-checkin-done]', err)
  }
}

/** Flow 2: pre-class reminder to the student. scheduledFor = slot start_at for once-per-booking dedup. */
export async function notifyCheckinReminder(
  studentUserId: string,
  serviceName: string,
  slotStartAt: string,
  relatedId: string,
): Promise<void> {
  try {
    const admin = createSupabaseAdminClient()
    await pushToUser(admin, {
      userId: studentUserId,
      type: 'checkin_reminder',
      payload: {
        title: '記得簽到',
        body: `${serviceName}（${tzLabel(slotStartAt)} 開始）記得到場後簽到`,
        url: '/my-bookings',
        tag: `checkin-reminder-${relatedId}`,
      },
      relatedId,
      scheduledFor: slotStartAt,
    })
  } catch (err) {
    console.error('[notify-checkin-reminder]', err)
  }
}

/** Flow 3a: not-checked-in escalation to the student. */
export async function notifyCheckinMissingStudent(
  studentUserId: string,
  serviceName: string,
  slotStartAt: string,
  bookingId: string,
): Promise<void> {
  try {
    const admin = createSupabaseAdminClient()
    await pushToUser(admin, {
      userId: studentUserId,
      type: 'checkin_missing',
      payload: {
        title: '您尚未簽到',
        body: `${serviceName}（${tzLabel(slotStartAt)}）已開始，請儘快簽到`,
        url: '/my-bookings',
        tag: `checkin-missing-${bookingId}`,
      },
      relatedId: bookingId,
      scheduledFor: slotStartAt,
    })
  } catch (err) {
    console.error('[notify-checkin-missing-student]', err)
  }
}

/** Flow 3b: not-checked-in escalation to one coach/owner, batched per slot. names = un-checked-in student names. */
export async function notifyCheckinMissingCoach(
  coachUserId: string,
  serviceName: string,
  slotStartAt: string,
  slotId: string,
  names: string[],
): Promise<void> {
  if (names.length === 0) return
  try {
    const admin = createSupabaseAdminClient()
    await pushToUser(admin, {
      userId: coachUserId,
      type: 'checkin_missing',
      payload: {
        title: `${names.length} 位學員尚未簽到`,
        body: `${serviceName}（${tzLabel(slotStartAt)}）：${names.join('、')}`,
        url: '/calendar',
        tag: `checkin-missing-slot-${slotId}`,
      },
      relatedId: slotId,
      scheduledFor: slotStartAt,
    })
  } catch (err) {
    console.error('[notify-checkin-missing-coach]', err)
  }
}
