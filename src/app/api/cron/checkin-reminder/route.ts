// src/app/api/cron/checkin-reminder/route.ts
import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { planCheckinReminders, type ReminderBooking } from '@/lib/checkin-reminder-plan'
import {
  notifyCheckinReminder,
  notifyCheckinMissingStudent,
  notifyCheckinMissingCoach,
} from '@/lib/notify-checkin'

type Row = {
  id: string
  slot_id: string
  customer_id: string
  tenant_id: string
  status: string
  checked_in_at: string | null
  customers: { display_name: string | null } | null
  services: { name: string } | null
  tenants: { checkin_reminder_minutes: number | null } | null
  availability_slots: { start_at: string; tenant_members: { user_id: string | null } | null } | null
}

export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }
  const admin = createSupabaseAdminClient()
  const now = new Date()
  const pending: Promise<void>[] = []
  const from = new Date(now.getTime() - 2 * 3600 * 1000).toISOString()
  const to = new Date(now.getTime() + 3 * 3600 * 1000).toISOString() // +3h must cover the max reminder lead (tenants.checkin_reminder_minutes is DB-capped at 180)

  const { data, error } = await admin
    .from('bookings')
    .select(
      'id, slot_id, customer_id, tenant_id, status, checked_in_at, customers(display_name), services(name), tenants(checkin_reminder_minutes), availability_slots!inner(start_at, tenant_members(user_id))',
    )
    .eq('status', 'confirmed')
    .is('checked_in_at', null)
    .gte('availability_slots.start_at', from)
    .lte('availability_slots.start_at', to)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (data ?? []) as unknown as Row[]
  const byId = new Map(rows.map((r) => [r.id, r]))

  const planned = planCheckinReminders(
    now,
    rows.map<ReminderBooking>((r) => ({
      bookingId: r.id,
      slotId: r.slot_id,
      startAt: r.availability_slots!.start_at,
      checkedInAt: r.checked_in_at,
      status: r.status,
      reminderLeadMin: r.tenants?.checkin_reminder_minutes ?? null,
    })),
  )

  let reminders = 0
  const missingBySlot = new Map<string, Row[]>()

  for (const action of planned) {
    const r = byId.get(action.bookingId)
    if (!r || !r.availability_slots) continue
    const svcName = r.services?.name ?? '課程'
    const startAt = r.availability_slots.start_at
    // checkin_reminder / checkin_missing are intentionally not gated by notification_preferences in v1 (always sent)
    if (action.kind === 'reminder') {
      pending.push(notifyCheckinReminder(r.customer_id, svcName, startAt, r.id))
      reminders++
    } else {
      // student gets an individual nudge; coach notification is batched per slot below
      pending.push(notifyCheckinMissingStudent(r.customer_id, svcName, startAt, r.id))
      const arr = missingBySlot.get(r.slot_id) ?? []
      arr.push(r)
      missingBySlot.set(r.slot_id, arr)
    }
  }

  // Resolve tenant owner(s) for all slots with missing check-ins in one batched query.
  // Each slot then notifies the slot's coach + tenant owner(s), deduped (coach==owner sends only once).
  const tenantIds = [...new Set([...missingBySlot.values()].map((rows) => rows[0]!.tenant_id))]
  const ownersByTenant = new Map<string, string[]>()
  if (tenantIds.length > 0) {
    const { data: ownerRows } = await admin
      .from('tenant_members')
      .select('tenant_id, user_id')
      .eq('role', 'owner')
      .eq('status', 'active')
      .in('tenant_id', tenantIds)
    for (const row of ownerRows ?? []) {
      if (!row.user_id) continue
      const list = ownersByTenant.get(row.tenant_id) ?? []
      list.push(row.user_id)
      ownersByTenant.set(row.tenant_id, list)
    }
  }

  let coachAlerts = 0
  for (const [slotId, slotRows] of missingBySlot) {
    const first = slotRows[0]!
    const coachUserId = first.availability_slots?.tenant_members?.user_id ?? null
    const ownerUserIds = ownersByTenant.get(first.tenant_id) ?? []

    // Build a deduped set of target user ids: coach + all active owners for the tenant.
    const targets = new Set<string>()
    if (coachUserId) targets.add(coachUserId)
    for (const uid of ownerUserIds) targets.add(uid)
    if (targets.size === 0) continue

    const names = slotRows.map((r) => r.customers?.display_name ?? '學員')
    const svcName = first.services?.name ?? '課程'
    const startAt = first.availability_slots!.start_at
    for (const targetUserId of targets) {
      pending.push(notifyCheckinMissingCoach(targetUserId, svcName, startAt, slotId, names))
    }
    coachAlerts++
  }

  await Promise.all(pending)

  // No-show sweep: confirmed + not-checked-in + slot already ended -> mark no_show.
  // Label only: the class was deducted at booking and is forfeited by not being
  // refunded (no classes_used change here). 30-day floor avoids scanning ancient rows
  // on first run; once marked, rows leave the 'confirmed' set and aren't rescanned.
  const noShowFloor = new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString()
  const { data: endedRows } = await admin
    .from('bookings')
    .select('id, availability_slots!inner(end_at)')
    .eq('status', 'confirmed')
    .is('checked_in_at', null)
    .lt('availability_slots.end_at', now.toISOString())
    .gte('availability_slots.end_at', noShowFloor)
  const noShowIds = (endedRows ?? []).map((r) => r.id)
  let noShowMarked = 0
  if (noShowIds.length > 0) {
    const { error: nsErr } = await admin.from('bookings').update({ status: 'no_show' }).in('id', noShowIds)
    if (!nsErr) noShowMarked = noShowIds.length
  }

  return NextResponse.json({
    scanned: rows.length,
    reminders,
    missingStudents: planned.filter((p) => p.kind === 'missing').length,
    coachAlerts,
    noShowMarked,
    timestamp: now.toISOString(),
  })
}
