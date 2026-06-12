// @vitest-environment node
import WebSocket from 'ws'
if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket
}
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const admin = createClient<Database>(URL, SERVICE)
const ts = Date.now()
const PW = 'TestPass123!'
const ctx: any = { memberIds: [] as string[] }

async function signedInClient(email: string) {
  const c = createClient<Database>(URL, ANON)
  const { error } = await c.auth.signInWithPassword({ email, password: PW })
  if (error) throw new Error(`signIn ${email}: ${error.message}`)
  return c
}

let slotIndex = 0
async function makeSlot(startOffsetMin: number) {
  // Each slot uses its own member to avoid the EXCLUDE overlap constraint
  const memberId = ctx.memberIds[slotIndex++]
  const start = new Date(Date.now() + startOffsetMin * 60_000)
  const { data, error } = await admin.from('availability_slots').insert({
    tenant_id: ctx.tenantId, member_id: memberId, service_id: ctx.serviceId,
    start_at: start.toISOString(), end_at: new Date(start.getTime() + 60 * 60_000).toISOString(), status: 'booked',
  }).select().single()
  if (error) throw new Error(`makeSlot failed: ${error.message}`)
  return data!.id as string
}
async function makeBookingWithPurchase(slotId: string) {
  const { data: p, error: pe } = await admin.from('customer_purchases').insert({
    tenant_id: ctx.tenantId, customer_id: ctx.custId, service_id: ctx.serviceId,
    classes_total: 5, classes_used: 1, approval_status: 'confirmed',
    approved_at: new Date().toISOString(), payment_self_reported: 'claimed_paid',
  }).select().single()
  if (pe) throw new Error(`makeBookingWithPurchase purchase failed: ${pe.message}`)
  const { data: b, error: be } = await admin.from('bookings').insert({
    tenant_id: ctx.tenantId, slot_id: slotId, customer_id: ctx.custId,
    service_id: ctx.serviceId, purchase_id: p!.id, status: 'confirmed',
  }).select().single()
  if (be) throw new Error(`makeBookingWithPurchase booking failed: ${be.message}`)
  return { bookingId: b!.id as string, purchaseId: p!.id as string }
}
async function usedCount(purchaseId: string) {
  const { data } = await admin.from('customer_purchases').select('classes_used').eq('id', purchaseId).single()
  return data!.classes_used as number
}

describe('cancel_booking deadline-aware refund', () => {
  beforeAll(async () => {
    const { data: t } = await admin.from('tenants').insert({ slug: `cd-${ts}`, name: 'CD Tenant' }).select().single()
    ctx.tenantId = t!.id

    // Create 3 coach users + members (one per test slot) to avoid EXCLUDE collisions
    for (let i = 0; i < 3; i++) {
      const { data: u } = await admin.auth.admin.createUser({
        email: `coach-cd-${ts}-${i}@example.com`, password: PW, email_confirm: true,
      })
      const { data: m } = await admin.from('tenant_members').insert({
        tenant_id: ctx.tenantId, user_id: u!.user!.id, role: 'owner', status: 'active',
      }).select().single()
      ctx.memberIds.push(m!.id)
    }

    const { data: s } = await admin.from('services').insert({ tenant_id: ctx.tenantId, name: 'CD Svc', duration_minutes: 60, cancel_deadline_hours: 24 }).select().single()
    ctx.serviceId = s!.id

    const { data: cu } = await admin.auth.admin.createUser({ email: `cust-cd-${ts}@example.com`, password: PW, email_confirm: true })
    ctx.custId = cu!.user!.id
    await admin.from('customers').insert({ id: ctx.custId, display_name: 'CD Cust' })

    ctx.custClient = await signedInClient(`cust-cd-${ts}@example.com`)
    // The coach client uses the first coach (index 0) who is also a tenant member
    ctx.coachClient = await signedInClient(`coach-cd-${ts}-0@example.com`)
  })
  afterAll(async () => { if (ctx.tenantId) await admin.from('tenants').delete().eq('id', ctx.tenantId) })

  it('customer cancel WITHIN deadline refunds', async () => {
    const slot = await makeSlot(48 * 60)
    const { bookingId, purchaseId } = await makeBookingWithPurchase(slot)
    const { error } = await ctx.custClient.rpc('cancel_booking', { p_booking_id: bookingId })
    expect(error).toBeNull()
    expect(await usedCount(purchaseId)).toBe(0)
  })

  it('customer cancel PAST deadline does NOT refund but still cancels', async () => {
    const slot = await makeSlot(12 * 60)
    const { bookingId, purchaseId } = await makeBookingWithPurchase(slot)
    const { error } = await ctx.custClient.rpc('cancel_booking', { p_booking_id: bookingId })
    expect(error).toBeNull()
    expect(await usedCount(purchaseId)).toBe(1)
    const { data: b } = await admin.from('bookings').select('status').eq('id', bookingId).single()
    expect(b!.status).toBe('cancelled')
  })

  it('coach cancel PAST deadline still refunds', async () => {
    const slot = await makeSlot(12 * 60)
    const { bookingId, purchaseId } = await makeBookingWithPurchase(slot)
    const { error } = await ctx.coachClient.rpc('cancel_booking', { p_booking_id: bookingId })
    expect(error).toBeNull()
    expect(await usedCount(purchaseId)).toBe(0)
  })
})
