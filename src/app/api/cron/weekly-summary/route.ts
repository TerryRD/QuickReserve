import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { pushToUser } from '@/lib/push'

/**
 * Vercel Cron: Sunday 20:00 UTC+8 (Sunday 12:00 UTC)
 * Sends next-week preview to anyone with bookings or upcoming slots.
 */
export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }
  const admin = createSupabaseAdminClient()

  // Compute next week window (Mon 00:00 UTC+8 .. next Mon)
  const now = new Date()
  const nowTpe = new Date(now.getTime() + 8 * 3600 * 1000)
  const dow = nowTpe.getUTCDay() // 0=Sun
  const daysUntilMonday = (8 - dow) % 7 || 7 // days from now until next Monday
  const nextMonday = new Date(
    Date.UTC(nowTpe.getUTCFullYear(), nowTpe.getUTCMonth(), nowTpe.getUTCDate() + daysUntilMonday),
  )
  // Convert back to UTC for query
  const weekStartUtc = new Date(nextMonday.getTime() - 8 * 3600 * 1000)
  const weekEndUtc = new Date(weekStartUtc.getTime() + 7 * 24 * 3600 * 1000)

  // Find users with any confirmed/pending bookings in the window
  const { data: customerBookings } = await admin
    .from('bookings')
    .select('customer_id, availability_slots(start_at)')
    .in('status', ['pending', 'confirmed'])
    .gte('availability_slots.start_at', weekStartUtc.toISOString())
    .lt('availability_slots.start_at', weekEndUtc.toISOString())

  // Group by customer
  const counts: Record<string, number> = {}
  for (const b of customerBookings ?? []) {
    counts[b.customer_id] = (counts[b.customer_id] ?? 0) + 1
  }

  // Find tenant members with slots in the window
  const { data: memberSlots } = await admin
    .from('availability_slots')
    .select('tenant_members(user_id)')
    .gte('start_at', weekStartUtc.toISOString())
    .lt('start_at', weekEndUtc.toISOString())
    .neq('status', 'cancelled')

  const memberCounts: Record<string, number> = {}
  for (const s of memberSlots ?? []) {
    const uid = (s.tenant_members as { user_id: string | null } | null)?.user_id
    if (uid) memberCounts[uid] = (memberCounts[uid] ?? 0) + 1
  }

  let sent = 0
  for (const [userId, count] of Object.entries(counts)) {
    const res = await pushToUser(admin, {
      userId,
      type: 'weekly_summary',
      payload: {
        title: '下週預約預覽',
        body: `下週您有 ${count} 個預約`,
        url: '/my-bookings',
        tag: 'weekly-summary',
      },
      scheduledFor: weekStartUtc.toISOString(),
    })
    sent += res.sent
  }
  for (const [userId, count] of Object.entries(memberCounts)) {
    if (userId in counts) continue // already notified as customer
    const res = await pushToUser(admin, {
      userId,
      type: 'weekly_summary',
      payload: {
        title: '下週行程預覽',
        body: `下週您有 ${count} 個時段`,
        url: '/calendar',
        tag: 'weekly-summary',
      },
      scheduledFor: weekStartUtc.toISOString(),
    })
    sent += res.sent
  }

  return NextResponse.json({ sent, weekStart: weekStartUtc.toISOString() })
}
