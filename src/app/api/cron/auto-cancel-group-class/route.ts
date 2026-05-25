import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { notifyGroupAutoCancel } from '@/lib/notify-booking'

export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const admin = createSupabaseAdminClient()
  const now = new Date()
  // Look ahead 48h max; we'll filter per-slot using each service's deadline
  const horizonEnd = new Date(now.getTime() + 48 * 3600 * 1000)

  const { data: slots, error } = await admin
    .from('availability_slots')
    .select(
      'id, service_id, start_at, status, services(min_attendance, cancel_deadline_hours)',
    )
    .gte('start_at', now.toISOString())
    .lt('start_at', horizonEnd.toISOString())
    .neq('status', 'cancelled')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let cancelled = 0
  let evaluated = 0
  for (const slot of slots ?? []) {
    const svc = slot.services as { min_attendance: number; cancel_deadline_hours: number } | null
    if (!svc) continue
    if (svc.min_attendance <= 1) continue // 1-on-1, no auto-cancel logic
    evaluated++

    const hoursToStart =
      (new Date(slot.start_at).getTime() - now.getTime()) / 3600000
    if (hoursToStart > svc.cancel_deadline_hours) continue

    const { count } = await admin
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('slot_id', slot.id)
      .neq('status', 'cancelled')

    if ((count ?? 0) >= svc.min_attendance) continue

    // Cancel via RPC
    const { data: affected, error: cancelErr } = await admin.rpc('auto_cancel_group_slot', {
      p_slot_id: slot.id,
    })
    if (cancelErr) {
      console.error('[auto-cancel]', cancelErr.message, { slotId: slot.id })
      continue
    }
    cancelled++

    // Notify all returned customer IDs + member
    for (const row of (affected ?? []) as Array<{
      affected_customer_id: string
      affected_member_user_id: string | null
      service_name: string
      slot_start_at: string
    }>) {
      void notifyGroupAutoCancel(
        row.affected_customer_id,
        row.affected_member_user_id,
        row.service_name,
        row.slot_start_at,
      )
    }
  }

  return NextResponse.json({
    evaluated,
    cancelled,
    timestamp: now.toISOString(),
  })
}
