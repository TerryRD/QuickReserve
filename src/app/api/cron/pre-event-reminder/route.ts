import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { pushToUser } from '@/lib/push'
import { preEventScheduledFor } from '@/lib/pre-event-reminder'

/**
 * Vercel Cron: every minute.
 * Scans bookings starting within the next 60 minutes; for each, checks if
 * the customer has any pre_event_minutes value such that
 * (slot.start_at - now) matches that value (within a 1-minute tolerance).
 */
export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }
  const admin = createSupabaseAdminClient()

  const now = new Date()
  // Look at slots starting in the next 65 minutes (covers max pre_event_minutes for MVP)
  const horizonEnd = new Date(now.getTime() + 65 * 60 * 1000)

  const { data: bookings } = await admin
    .from('bookings')
    .select('id, customer_id, services(name), availability_slots(start_at)')
    .in('status', ['pending', 'confirmed'])
    .gte('availability_slots.start_at', now.toISOString())
    .lt('availability_slots.start_at', horizonEnd.toISOString())
  if (!bookings || bookings.length === 0) return NextResponse.json({ sent: 0 })

  // Load prefs for all involved customers
  const customerIds = Array.from(new Set(bookings.map((b) => b.customer_id)))
  const { data: prefs } = await admin
    .from('notification_preferences')
    .select('user_id, pre_event_minutes, pre_event_enabled')
    .in('user_id', customerIds)
    .eq('pre_event_enabled', true)
  const prefsMap = new Map((prefs ?? []).map((p) => [p.user_id, p.pre_event_minutes]))

  let sent = 0
  for (const b of bookings) {
    const slot = b.availability_slots as { start_at: string } | null
    if (!slot) continue
    const userMinutes = prefsMap.get(b.customer_id)
    if (!userMinutes || userMinutes.length === 0) continue

    const startMs = new Date(slot.start_at).getTime()
    const diffMin = Math.round((startMs - now.getTime()) / 60000)

    // Trigger if any value in pre_event_minutes matches diffMin (within ±1 min)
    const matched = userMinutes.find((m) => Math.abs(m - diffMin) <= 1)
    if (matched === undefined) continue

    let scheduledFor: string
    try {
      scheduledFor = preEventScheduledFor(slot.start_at, matched)
    } catch (err) {
      // 開課時間異常：略過這筆，不讓整支排程中斷
      console.error('[pre-event-reminder] skip booking with invalid start_at', b.id, err)
      continue
    }

    const svc = b.services as { name: string } | null
    const res = await pushToUser(admin, {
      userId: b.customer_id,
      type: 'pre_event',
      payload: {
        title: '預約即將開始',
        body: `${matched} 分鐘後：${svc?.name ?? '預約'}`,
        url: '/my-bookings',
        tag: `pre-event-${b.id}-${matched}`,
      },
      relatedId: b.id,
      scheduledFor, // dedup key per (booking, advance interval)：開課時間往前推提前量的 ISO 時間
    })
    sent += res.sent
  }

  return NextResponse.json({ sent, scanned: bookings.length })
}
