// @vitest-environment node
import WebSocket from 'ws'
if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket
}
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const admin = createClient<Database>(
  SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)
const ts = Date.now()
// Each test gets its own member_id so the availability_slots EXCLUDE
// constraint (per member_id, overlapping tstzrange) never fires.
const ctx: {
  tenantId?: string
  memberIds: string[]
  serviceId?: string
  customerId?: string
  customer2Id?: string
  customer2Email: string
  customer2Password: string
} = { memberIds: [], customer2Email: `cust2-ci-${Date.now()}@example.com`, customer2Password: 'TestPass123!' }

let slotIndex = 0
async function makeSlot(startOffsetMin: number, durationMin: number) {
  const memberId = ctx.memberIds[slotIndex++]
  const start = new Date(Date.now() + startOffsetMin * 60_000)
  const end = new Date(start.getTime() + durationMin * 60_000)
  const { data, error } = await admin
    .from('availability_slots')
    .insert({
      tenant_id: ctx.tenantId!, member_id: memberId, service_id: ctx.serviceId!,
      start_at: start.toISOString(), end_at: end.toISOString(), status: 'booked',
    })
    .select().single()
  if (error) throw new Error(`makeSlot failed: ${error.message}`)
  return data!.id as string
}
async function makeBooking(slotId: string, status: string) {
  const { data: p, error: pe } = await admin.from('customer_purchases').insert({
    tenant_id: ctx.tenantId!, customer_id: ctx.customerId!, service_id: ctx.serviceId!,
    classes_total: 5, classes_used: 1, approval_status: 'confirmed',
    approved_at: new Date().toISOString(), payment_self_reported: 'claimed_paid',
  }).select().single()
  if (pe) throw new Error(`makeBooking purchase failed: ${pe.message}`)
  const { data, error: be } = await admin.from('bookings').insert({
    tenant_id: ctx.tenantId!, slot_id: slotId, customer_id: ctx.customerId!,
    service_id: ctx.serviceId!, status, purchase_id: p!.id,
  }).select().single()
  if (be) throw new Error(`makeBooking booking failed: ${be.message}`)
  return data!.id as string
}

describe('checkin_booking RPC', () => {
  beforeAll(async () => {
    const { data: t } = await admin.from('tenants').insert({ slug: `ci-${ts}`, name: 'CI Tenant' }).select().single()
    ctx.tenantId = t!.id

    // Create 6 coach users + members (one per test slot) to avoid EXCLUDE collisions.
    for (let i = 0; i < 6; i++) {
      const { data: u } = await admin.auth.admin.createUser({
        email: `coach-ci-${ts}-${i}@example.com`, password: 'TestPass123!', email_confirm: true,
      })
      const { data: m } = await admin.from('tenant_members').insert({
        tenant_id: ctx.tenantId!, user_id: u!.user!.id, role: 'owner', status: 'active',
      }).select().single()
      ctx.memberIds.push(m!.id)
    }

    const { data: s } = await admin.from('services').insert({
      tenant_id: ctx.tenantId!, name: 'CI Service', duration_minutes: 60,
    }).select().single()
    ctx.serviceId = s!.id

    const { data: cu } = await admin.auth.admin.createUser({
      email: `cust-ci-${ts}@example.com`, password: 'TestPass123!', email_confirm: true,
    })
    ctx.customerId = cu!.user!.id
    await admin.from('customers').insert({ id: ctx.customerId, display_name: 'CI Cust' })

    const { data: cu2 } = await admin.auth.admin.createUser({
      email: ctx.customer2Email, password: ctx.customer2Password, email_confirm: true,
    })
    ctx.customer2Id = cu2!.user!.id
    await admin.from('customers').insert({ id: ctx.customer2Id, display_name: 'CI Cust2' })
  })

  afterAll(async () => {
    if (ctx.tenantId) await admin.from('tenants').delete().eq('id', ctx.tenantId)
  })

  it('checks in a confirmed booking inside the window -> completed', async () => {
    const slot = await makeSlot(-5, 60) // started 5 min ago, ongoing
    const booking = await makeBooking(slot, 'confirmed')
    const { data, error } = await admin.rpc('checkin_booking', { p_booking_id: booking })
    expect(error).toBeNull()
    expect((data as Array<{ booking_id: string }>)[0].booking_id).toBe(booking)
    const { data: b } = await admin.from('bookings').select('status, checked_in_at').eq('id', booking).single()
    expect(b!.status).toBe('completed')
    expect(b!.checked_in_at).not.toBeNull()
  })

  it('rejects a second check-in (ALREADY_CHECKED_IN)', async () => {
    const slot = await makeSlot(-5, 60)
    const booking = await makeBooking(slot, 'confirmed')
    await admin.rpc('checkin_booking', { p_booking_id: booking })
    const { error } = await admin.rpc('checkin_booking', { p_booking_id: booking })
    expect(error?.message).toContain('ALREADY_CHECKED_IN')
  })

  it('rejects a pending booking (NOT_CONFIRMED)', async () => {
    const slot = await makeSlot(-5, 60)
    const booking = await makeBooking(slot, 'pending')
    const { error } = await admin.rpc('checkin_booking', { p_booking_id: booking })
    expect(error?.message).toContain('NOT_CONFIRMED')
  })

  it('rejects too early (CHECKIN_TOO_EARLY)', async () => {
    const slot = await makeSlot(60, 60) // starts in 60 min, window opens at 30 min
    const booking = await makeBooking(slot, 'confirmed')
    const { error } = await admin.rpc('checkin_booking', { p_booking_id: booking })
    expect(error?.message).toContain('CHECKIN_TOO_EARLY')
  })

  it('rejects after class ended (CHECKIN_CLOSED)', async () => {
    const slot = await makeSlot(-120, 60) // ended 60 min ago
    const booking = await makeBooking(slot, 'confirmed')
    const { error } = await admin.rpc('checkin_booking', { p_booking_id: booking })
    expect(error?.message).toContain('CHECKIN_CLOSED')
  })

  it('rejects a different customer trying to check in (FORBIDDEN)', async () => {
    // Booking owned by ctx.customerId; caller is ctx.customer2Id (a different user).
    const slot = await makeSlot(-5, 60) // started 5 min ago, ongoing
    const booking = await makeBooking(slot, 'confirmed')

    const otherClient = createClient<Database>(SUPABASE_URL, ANON_KEY)
    const { error: signInErr } = await otherClient.auth.signInWithPassword({
      email: ctx.customer2Email,
      password: ctx.customer2Password,
    })
    expect(signInErr).toBeNull()

    const { error } = await otherClient.rpc('checkin_booking', { p_booking_id: booking })
    expect(error?.message).toContain('FORBIDDEN')
  })
})
