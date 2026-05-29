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

// Booking lifecycle integration: book_with_purchase (S4 replacement for
// book_slot_atomic) + cancel_booking with refund. Tests the atomic-locking
// + capacity + cancel-refund + rebook cycle for a private 1-on-1 service
// (max_capacity=1, min_attendance=1 — first booking auto-confirms).
//
// Caller is `admin` (service_role) so the auth.uid()-vs-p_customer_id guard
// added in 20260529100000 is bypassed — that guard is exercised separately
// in rpc-cross-customer-guard.test.ts.

const ctx: {
  coachId?: string
  aliceId?: string
  bobId?: string
  tenantId?: string
  memberId?: string
  serviceId?: string
  slotId?: string
  alicePurchaseId?: string
  bobPurchaseId?: string
  aliceBookingId?: string
} = {}

describe('Booking lifecycle (book_with_purchase + cancel_booking)', () => {
  beforeAll(async () => {
    const ts = Date.now()
    const { data: coach } = await admin.auth.admin.createUser({
      email: `coach-life-${ts}@example.com`,
      password: 'TestPass123!',
      email_confirm: true,
    })
    ctx.coachId = coach!.user!.id
    const { data: alice } = await admin.auth.admin.createUser({
      email: `alice-life-${ts}@example.com`,
      password: 'TestPass123!',
      email_confirm: true,
    })
    ctx.aliceId = alice!.user!.id
    const { data: bob } = await admin.auth.admin.createUser({
      email: `bob-life-${ts}@example.com`,
      password: 'TestPass123!',
      email_confirm: true,
    })
    ctx.bobId = bob!.user!.id

    const { data: tenant } = await admin
      .from('tenants')
      .insert({ slug: `life-${ts}`, name: 'Lifecycle test' })
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
        name: '1-on-1 svc',
        duration_minutes: 60,
        max_capacity: 1,
        min_attendance: 1,
      })
      .select()
      .single()
    ctx.serviceId = svc!.id

    await admin.from('customers').upsert([
      { id: alice!.user!.id, display_name: 'Alice' },
      { id: bob!.user!.id, display_name: 'Bob' },
    ])

    // Each customer has a confirmed purchase to spend on this service
    const { data: purchases } = await admin
      .from('customer_purchases')
      .insert([
        {
          tenant_id: tenant!.id,
          customer_id: alice!.user!.id,
          service_id: svc!.id,
          classes_total: 5,
          classes_used: 0,
          approval_status: 'confirmed',
          approved_at: new Date().toISOString(),
          payment_self_reported: 'claimed_paid',
        },
        {
          tenant_id: tenant!.id,
          customer_id: bob!.user!.id,
          service_id: svc!.id,
          classes_total: 5,
          classes_used: 0,
          approval_status: 'confirmed',
          approved_at: new Date().toISOString(),
          payment_self_reported: 'claimed_paid',
        },
      ])
      .select()
    const [p0, p1] = purchases ?? []
    if (!p0 || !p1) throw new Error('failed to create purchases')
    ctx.alicePurchaseId = p0.id
    ctx.bobPurchaseId = p1.id

    const startAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString()
    const endAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14 + 60 * 60 * 1000).toISOString()
    const { data: slot } = await admin
      .from('availability_slots')
      .insert({
        tenant_id: tenant!.id,
        member_id: member!.id,
        service_id: svc!.id,
        start_at: startAt,
        end_at: endAt,
      })
      .select()
      .single()
    ctx.slotId = slot!.id
  }, 30_000)

  afterAll(async () => {
    if (ctx.tenantId) await admin.from('tenants').delete().eq('id', ctx.tenantId)
    if (ctx.coachId) await admin.auth.admin.deleteUser(ctx.coachId)
    if (ctx.aliceId) await admin.auth.admin.deleteUser(ctx.aliceId)
    if (ctx.bobId) await admin.auth.admin.deleteUser(ctx.bobId)
  }, 30_000)

  it('first booking auto-confirms (min_attendance=1) and consumes a class', async () => {
    const { data, error } = await admin.rpc('book_with_purchase', {
      p_slot_id: ctx.slotId!,
      p_customer_id: ctx.aliceId!,
    })
    expect(error).toBeNull()
    expect(data).toBeDefined()
    const row = (data as Array<{ booking_id: string; auto_confirmed: boolean }>)[0]
    expect(row?.auto_confirmed).toBe(true)
    ctx.aliceBookingId = row!.booking_id

    const { data: slot } = await admin
      .from('availability_slots')
      .select('status')
      .eq('id', ctx.slotId!)
      .single()
    expect(slot?.status).toBe('booked')

    const { data: purchase } = await admin
      .from('customer_purchases')
      .select('classes_used')
      .eq('id', ctx.alicePurchaseId!)
      .single()
    expect(purchase?.classes_used).toBe(1)
  })

  it('second booking attempt sees SLOT_UNAVAILABLE (slot already booked)', async () => {
    const { error } = await admin.rpc('book_with_purchase', {
      p_slot_id: ctx.slotId!,
      p_customer_id: ctx.bobId!,
    })
    expect(error).not.toBeNull()
    expect(error?.message).toContain('SLOT_UNAVAILABLE')

    // Bob's purchase is untouched
    const { data: purchase } = await admin
      .from('customer_purchases')
      .select('classes_used')
      .eq('id', ctx.bobPurchaseId!)
      .single()
    expect(purchase?.classes_used).toBe(0)
  })

  it('cancel_booking refunds the class and releases the slot', async () => {
    expect(ctx.aliceBookingId).toBeDefined()
    const { error } = await admin.rpc('cancel_booking', { p_booking_id: ctx.aliceBookingId! })
    expect(error).toBeNull()

    const { data: slot } = await admin
      .from('availability_slots')
      .select('status')
      .eq('id', ctx.slotId!)
      .single()
    expect(slot?.status).toBe('available')

    const { data: purchase } = await admin
      .from('customer_purchases')
      .select('classes_used')
      .eq('id', ctx.alicePurchaseId!)
      .single()
    expect(purchase?.classes_used).toBe(0)
  })

  it('rebooking after cancel works (Bob takes the freed slot)', async () => {
    const { data, error } = await admin.rpc('book_with_purchase', {
      p_slot_id: ctx.slotId!,
      p_customer_id: ctx.bobId!,
    })
    expect(error).toBeNull()
    const row = (data as Array<{ booking_id: string; auto_confirmed: boolean }>)[0]
    expect(row?.auto_confirmed).toBe(true)

    const { data: purchase } = await admin
      .from('customer_purchases')
      .select('classes_used')
      .eq('id', ctx.bobPurchaseId!)
      .single()
    expect(purchase?.classes_used).toBe(1)
  })
})
