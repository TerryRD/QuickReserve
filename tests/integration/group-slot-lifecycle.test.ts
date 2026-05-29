// @vitest-environment node
import WebSocket from 'ws'
if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket
}

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const admin = createClient<Database>(SUPABASE_URL, SERVICE_KEY)

// A-6 group lifecycle test — service has max_capacity=4, min_attendance=2.
// Asserts the corrected lifecycle:
//   available → pending (1st booking)
//   pending stays pending up to count = max_capacity - 1
//   booked at count = max_capacity
//   cancel rebuilds status from remaining count (pending if any, available if 0)
//   reschedule into a partial group is allowed

const ts = Date.now()
const ctx: {
  coachId?: string
  tenantId?: string
  memberId?: string
  serviceId?: string
  groupSlotId?: string
  spareSlotId?: string
  spareDestSlotId?: string
  customers: Array<{ id: string; purchaseId: string; bookingId?: string }>
} = { customers: [] }

async function createCustomerWithPurchase(label: string, tenantId: string, serviceId: string) {
  const { data: u } = await admin.auth.admin.createUser({
    email: `${label}-grp-${ts}@example.com`,
    password: 'TestPass123!',
    email_confirm: true,
  })
  const userId = u!.user!.id
  await admin.from('customers').insert({ id: userId, display_name: label.toUpperCase() })
  const { data: p } = await admin
    .from('customer_purchases')
    .insert({
      tenant_id: tenantId,
      customer_id: userId,
      service_id: serviceId,
      classes_total: 5,
      classes_used: 0,
      approval_status: 'confirmed',
      approved_at: new Date().toISOString(),
      payment_self_reported: 'claimed_paid',
    })
    .select()
    .single()
  return { id: userId, purchaseId: p!.id }
}

async function slotStatus(id: string) {
  const { data } = await admin.from('availability_slots').select('status').eq('id', id).single()
  return data?.status
}

async function bookingStatuses(slotId: string) {
  const { data } = await admin
    .from('bookings')
    .select('status')
    .eq('slot_id', slotId)
    .order('created_at')
  return (data ?? []).map((b) => b.status)
}

describe('Group slot lifecycle (max_capacity=4, min_attendance=2)', () => {
  beforeAll(async () => {
    const { data: coach } = await admin.auth.admin.createUser({
      email: `coach-grp-${ts}@example.com`,
      password: 'TestPass123!',
      email_confirm: true,
    })
    ctx.coachId = coach!.user!.id

    const { data: tenant } = await admin
      .from('tenants')
      .insert({ slug: `grp-${ts}`, name: 'Group lifecycle test' })
      .select()
      .single()
    ctx.tenantId = tenant!.id

    const { data: member } = await admin
      .from('tenant_members')
      .insert({ tenant_id: tenant!.id, user_id: coach!.user!.id, role: 'owner', status: 'active' })
      .select()
      .single()
    ctx.memberId = member!.id

    const { data: svc } = await admin
      .from('services')
      .insert({
        tenant_id: tenant!.id,
        name: 'Group',
        duration_minutes: 60,
        max_capacity: 4,
        min_attendance: 2,
      })
      .select()
      .single()
    ctx.serviceId = svc!.id

    // 5 customers (A B C D for filling, plus E for the rejected 5th attempt)
    for (const label of ['a', 'b', 'c', 'd', 'e']) {
      ctx.customers.push(await createCustomerWithPurchase(label, tenant!.id, svc!.id))
    }

    // Three slots: the group under test, plus two spares for the reschedule scenario
    const base = Date.now() + 1000 * 60 * 60 * 24 * 30
    const { data: slots } = await admin
      .from('availability_slots')
      .insert([
        {
          tenant_id: tenant!.id,
          member_id: member!.id,
          service_id: svc!.id,
          start_at: new Date(base).toISOString(),
          end_at: new Date(base + 3600_000).toISOString(),
        },
        {
          tenant_id: tenant!.id,
          member_id: member!.id,
          service_id: svc!.id,
          start_at: new Date(base + 3600_000 * 2).toISOString(),
          end_at: new Date(base + 3600_000 * 3).toISOString(),
        },
        {
          tenant_id: tenant!.id,
          member_id: member!.id,
          service_id: svc!.id,
          start_at: new Date(base + 3600_000 * 4).toISOString(),
          end_at: new Date(base + 3600_000 * 5).toISOString(),
        },
      ])
      .select()
    const [s0, s1, s2] = slots ?? []
    if (!s0 || !s1 || !s2) throw new Error('failed to create slots')
    ctx.groupSlotId = s0.id
    ctx.spareSlotId = s1.id
    ctx.spareDestSlotId = s2.id
  }, 60_000)

  afterAll(async () => {
    if (ctx.tenantId) await admin.from('tenants').delete().eq('id', ctx.tenantId)
    if (ctx.coachId) await admin.auth.admin.deleteUser(ctx.coachId)
    for (const c of ctx.customers) await admin.auth.admin.deleteUser(c.id)
  }, 60_000)

  it('1st booking: slot=pending, booking=pending, auto_confirmed=false', async () => {
    const c = ctx.customers[0]!
    const { data, error } = await admin.rpc('book_with_purchase', {
      p_slot_id: ctx.groupSlotId!,
      p_customer_id: c.id,
    })
    expect(error).toBeNull()
    const row = (data as Array<{ booking_id: string; auto_confirmed: boolean }>)[0]
    expect(row?.auto_confirmed).toBe(false)
    c.bookingId = row!.booking_id

    expect(await slotStatus(ctx.groupSlotId!)).toBe('pending')
    expect(await bookingStatuses(ctx.groupSlotId!)).toEqual(['pending'])
  })

  it('2nd booking: slot stays pending, all bookings confirmed, auto_confirmed=true', async () => {
    const c = ctx.customers[1]!
    const { data, error } = await admin.rpc('book_with_purchase', {
      p_slot_id: ctx.groupSlotId!,
      p_customer_id: c.id,
    })
    expect(error).toBeNull()
    const row = (data as Array<{ booking_id: string; auto_confirmed: boolean }>)[0]
    expect(row?.auto_confirmed).toBe(true)
    c.bookingId = row!.booking_id

    expect(await slotStatus(ctx.groupSlotId!)).toBe('pending')
    expect(await bookingStatuses(ctx.groupSlotId!)).toEqual(['confirmed', 'confirmed'])
  })

  it('3rd booking: slot still pending (count=3 < max=4)', async () => {
    const c = ctx.customers[2]!
    const { data, error } = await admin.rpc('book_with_purchase', {
      p_slot_id: ctx.groupSlotId!,
      p_customer_id: c.id,
    })
    expect(error).toBeNull()
    const row = (data as Array<{ booking_id: string; auto_confirmed: boolean }>)[0]
    c.bookingId = row!.booking_id
    expect(await slotStatus(ctx.groupSlotId!)).toBe('pending')
    expect(await bookingStatuses(ctx.groupSlotId!)).toEqual(['confirmed', 'confirmed', 'confirmed'])
  })

  it('4th booking: slot=booked (count = max_capacity)', async () => {
    const c = ctx.customers[3]!
    const { data, error } = await admin.rpc('book_with_purchase', {
      p_slot_id: ctx.groupSlotId!,
      p_customer_id: c.id,
    })
    expect(error).toBeNull()
    const row = (data as Array<{ booking_id: string; auto_confirmed: boolean }>)[0]
    c.bookingId = row!.booking_id
    expect(await slotStatus(ctx.groupSlotId!)).toBe('booked')
  })

  it('5th booking attempt: SLOT_UNAVAILABLE (status guard fires first)', async () => {
    const c = ctx.customers[4]!
    const { error } = await admin.rpc('book_with_purchase', {
      p_slot_id: ctx.groupSlotId!,
      p_customer_id: c.id,
    })
    expect(error).not.toBeNull()
    expect(error?.message).toContain('SLOT_UNAVAILABLE')
  })

  it('cancel one of 4: slot drops back to pending, remaining bookings unaffected', async () => {
    const c = ctx.customers[3]!
    const { error } = await admin.rpc('cancel_booking', { p_booking_id: c.bookingId! })
    expect(error).toBeNull()

    expect(await slotStatus(ctx.groupSlotId!)).toBe('pending')

    // Refund: D's purchase classes_used should be back to 0
    const { data: pRow } = await admin
      .from('customer_purchases')
      .select('classes_used')
      .eq('id', c.purchaseId)
      .single()
    expect(pRow?.classes_used).toBe(0)

    // The other three bookings are still confirmed (cancelled one excluded)
    const { data: stillActive } = await admin
      .from('bookings')
      .select('status')
      .eq('slot_id', ctx.groupSlotId!)
      .neq('status', 'cancelled')
    expect((stillActive ?? []).every((b) => b.status === 'confirmed')).toBe(true)
    expect(stillActive).toHaveLength(3)
  })

  it('cancel all remaining: slot back to available', async () => {
    for (const c of ctx.customers.slice(0, 3)) {
      const { error } = await admin.rpc('cancel_booking', { p_booking_id: c.bookingId! })
      expect(error).toBeNull()
    }
    expect(await slotStatus(ctx.groupSlotId!)).toBe('available')
  })

  it('reschedule into a partially-filled group: accepts pending destination', async () => {
    // Set up: customer A books on spareSlot (1 of 4 → pending)
    const a = ctx.customers[0]!
    const { data: bookA } = await admin.rpc('book_with_purchase', {
      p_slot_id: ctx.spareSlotId!,
      p_customer_id: a.id,
    })
    const aBookingId = (bookA as Array<{ booking_id: string }>)[0]!.booking_id
    expect(await slotStatus(ctx.spareSlotId!)).toBe('pending')

    // Customer B books on spareDestSlot (1 of 4 → pending) — the reschedule target
    const b = ctx.customers[1]!
    await admin.rpc('book_with_purchase', {
      p_slot_id: ctx.spareDestSlotId!,
      p_customer_id: b.id,
    })
    expect(await slotStatus(ctx.spareDestSlotId!)).toBe('pending')

    // A reschedules from spareSlot → spareDestSlot (which already has B)
    const { error } = await admin.rpc('reschedule_booking', {
      p_old_booking_id: aBookingId,
      p_new_slot_id: ctx.spareDestSlotId!,
    })
    expect(error).toBeNull()

    // Old slot (A left): no bookings remain → available
    expect(await slotStatus(ctx.spareSlotId!)).toBe('available')
    // New slot: 2 bookings → still pending (min_attendance=2 → both confirmed,
    // but capacity 2 < max 4 so not booked yet)
    expect(await slotStatus(ctx.spareDestSlotId!)).toBe('pending')

    const { data: destBookings } = await admin
      .from('bookings')
      .select('status')
      .eq('slot_id', ctx.spareDestSlotId!)
      .neq('status', 'cancelled')
    expect(destBookings).toHaveLength(2)
    expect((destBookings ?? []).every((bk) => bk.status === 'confirmed')).toBe(true)
  })
})
