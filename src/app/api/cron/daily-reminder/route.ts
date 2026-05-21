import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { pushToUser } from '@/lib/push'

/**
 * Vercel Cron: every hour from 06:00-12:00 UTC+8 (22:00-04:00 UTC).
 * Each invocation filters users whose daily_reminder_hour matches the current hour
 * AND have bookings/slots today.
 */
export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }
  const admin = createSupabaseAdminClient()

  // Current hour in Asia/Taipei
  const now = new Date()
  const tpeNow = new Date(now.getTime() + 8 * 3600 * 1000)
  const currentHour = tpeNow.getUTCHours()

  // Today's UTC window (Asia/Taipei day → UTC range)
  const dayStartTpe = new Date(
    Date.UTC(tpeNow.getUTCFullYear(), tpeNow.getUTCMonth(), tpeNow.getUTCDate()),
  )
  const dayStartUtc = new Date(dayStartTpe.getTime() - 8 * 3600 * 1000)
  const dayEndUtc = new Date(dayStartUtc.getTime() + 24 * 3600 * 1000)

  // Users whose daily_reminder_hour == currentHour
  const { data: prefs } = await admin
    .from('notification_preferences')
    .select('user_id, daily_reminder_hour')
    .eq('daily_reminder_enabled', true)
    .eq('daily_reminder_hour', currentHour)
  const candidateIds = (prefs ?? []).map((p) => p.user_id)
  if (candidateIds.length === 0) return NextResponse.json({ sent: 0, hour: currentHour })

  let sent = 0

  // Customer bookings today
  const { data: customerBookings } = await admin
    .from('bookings')
    .select('customer_id, availability_slots(start_at)')
    .in('customer_id', candidateIds)
    .in('status', ['pending', 'confirmed'])
    .gte('availability_slots.start_at', dayStartUtc.toISOString())
    .lt('availability_slots.start_at', dayEndUtc.toISOString())
  const customerCounts: Record<string, number> = {}
  for (const b of customerBookings ?? []) {
    customerCounts[b.customer_id] = (customerCounts[b.customer_id] ?? 0) + 1
  }

  // Member slots today
  const { data: memberSlots } = await admin
    .from('availability_slots')
    .select('tenant_members(user_id)')
    .gte('start_at', dayStartUtc.toISOString())
    .lt('start_at', dayEndUtc.toISOString())
    .neq('status', 'cancelled')
  const memberCounts: Record<string, number> = {}
  for (const s of memberSlots ?? []) {
    const uid = (s.tenant_members as { user_id: string | null } | null)?.user_id
    if (uid && candidateIds.includes(uid)) memberCounts[uid] = (memberCounts[uid] ?? 0) + 1
  }

  for (const userId of candidateIds) {
    const cCount = customerCounts[userId] ?? 0
    const mCount = memberCounts[userId] ?? 0
    const total = cCount + mCount
    if (total === 0) continue
    const res = await pushToUser(admin, {
      userId,
      type: 'daily_reminder',
      payload: {
        title: '今日行程提醒',
        body: `您今天有 ${total} 個預約 / 時段`,
        url: cCount > 0 ? '/my-bookings' : '/calendar',
        tag: 'daily-reminder',
      },
      scheduledFor: dayStartUtc.toISOString(),
    })
    sent += res.sent
  }

  return NextResponse.json({ sent, hour: currentHour, candidates: candidateIds.length })
}
