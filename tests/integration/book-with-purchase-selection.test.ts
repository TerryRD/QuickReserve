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

const ts = Date.now()
const ctx: {
  coachId?: string
  aliceId?: string
  bobId?: string
  tenantId?: string
  memberId?: string
  serviceId?: string
  slotAId?: string
  slotBId?: string
  alicePurchaseEarlierId?: string
  alicePurchaseLaterId?: string
  alicePurchaseUsedUpId?: string
  bobPurchaseId?: string
} = {}

describe('book_with_purchase: explicit p_purchase_id selection', () => {
  beforeAll(async () => {
    const { data: coach } = await admin.auth.admin.createUser({
      email: `coach-sel-${ts}@example.com`,
      password: 'TestPass123!',
      email_confirm: true,
    })
    ctx.coachId = coach!.user!.id
    const { data: alice } = await admin.auth.admin.createUser({
      email: `alice-sel-${ts}@example.com`,
      password: 'TestPass123!',
      email_confirm: true,
    })
    ctx.aliceId = alice!.user!.id
    const { data: bob } = await admin.auth.admin.createUser({
      email: `bob-sel-${ts}@example.com`,
      password: 'TestPass123!',
      email_confirm: true,
    })
    ctx.bobId = bob!.user!.id

    const { data: tenant } = await admin
      .from('tenants')
      .insert({ slug: `sel-${ts}`, name: 'Selection test' })
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
        name: '1-on-1 sel',
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

    // Alice gets THREE purchases:
    //   • earlier-expiring (would be the oldest-expiring auto-pick)
    //   • later-expiring (what we want the test to consume explicitly)
    //   • used-up (classes_used == classes_total, must reject)
    const now = new Date()
    const oneMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
    const twoMonths = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString()
    const { data: alicePurchases } = await admin
      .from('customer_purchases')
      .insert([
        {
          tenant_id: tenant!.id,
          customer_id: alice!.user!.id,
          service_id: svc!.id,
          classes_total: 5,
          classes_used: 0,
          approval_status: 'confirmed',
          approved_at: now.toISOString(),
          payment_self_reported: 'claimed_paid',
          expires_at: oneMonth,
        },
        {
          tenant_id: tenant!.id,
          customer_id: alice!.user!.id,
          service_id: svc!.id,
          classes_total: 5,
          classes_used: 0,
          approval_status: 'confirmed',
          approved_at: now.toISOString(),
          payment_self_reported: 'claimed_paid',
          expires_at: twoMonths,
        },
        {
          tenant_id: tenant!.id,
          customer_id: alice!.user!.id,
          service_id: svc!.id,
          classes_total: 1,
          classes_used: 1,
          approval_status: 'confirmed',
          approved_at: now.toISOString(),
          payment_self_reported: 'claimed_paid',
        },
      ])
      .select()
    const [earlier, later, usedUp] = alicePurchases ?? []
    if (!earlier || !later || !usedUp) throw new Error('failed to create alice purchases')
    ctx.alicePurchaseEarlierId = earlier.id
    ctx.alicePurchaseLaterId = later.id
    ctx.alicePurchaseUsedUpId = usedUp.id

    // Bob gets one purchase — used in the cross-customer rejection test
    const { data: bobPurchase } = await admin
      .from('customer_purchases')
      .insert({
        tenant_id: tenant!.id,
        customer_id: bob!.user!.id,
        service_id: svc!.id,
        classes_total: 5,
        classes_used: 0,
        approval_status: 'confirmed',
        approved_at: now.toISOString(),
        payment_self_reported: 'claimed_paid',
      })
      .select()
      .single()
    ctx.bobPurchaseId = bobPurchase!.id

    // Two slots so each mutating test has its own
    const baseHour = (offset: number) =>
      new Date(Date.now() + 1000 * 60 * 60 * 24 * 21 + offset * 1000 * 60 * 60).toISOString()
    const { data: slots } = await admin
      .from('availability_slots')
      .insert([
        {
          tenant_id: tenant!.id,
          member_id: member!.id,
          service_id: svc!.id,
          start_at: baseHour(0),
          end_at: baseHour(1),
        },
        {
          tenant_id: tenant!.id,
          member_id: member!.id,
          service_id: svc!.id,
          start_at: baseHour(2),
          end_at: baseHour(3),
        },
      ])
      .select()
    const [s0, s1] = slots ?? []
    if (!s0 || !s1) throw new Error('failed to create slots')
    ctx.slotAId = s0.id
    ctx.slotBId = s1.id
  }, 30_000)

  afterAll(async () => {
    if (ctx.tenantId) await admin.from('tenants').delete().eq('id', ctx.tenantId)
    if (ctx.coachId) await admin.auth.admin.deleteUser(ctx.coachId)
    if (ctx.aliceId) await admin.auth.admin.deleteUser(ctx.aliceId)
    if (ctx.bobId) await admin.auth.admin.deleteUser(ctx.bobId)
  }, 30_000)

  it('explicit p_purchase_id consumes the chosen purchase, not the oldest-expiring', async () => {
    const { data, error } = await admin.rpc('book_with_purchase', {
      p_slot_id: ctx.slotAId!,
      p_customer_id: ctx.aliceId!,
      p_purchase_id: ctx.alicePurchaseLaterId!,
    })
    expect(error).toBeNull()
    const row = (data as Array<{ booking_id: string; auto_confirmed: boolean }>)[0]
    expect(row?.booking_id).toBeDefined()

    // The chosen (later-expiring) purchase went from 0 → 1
    const { data: laterRow } = await admin
      .from('customer_purchases')
      .select('classes_used')
      .eq('id', ctx.alicePurchaseLaterId!)
      .single()
    expect(laterRow?.classes_used).toBe(1)

    // The earlier-expiring one — the oldest-expiring auto-pick — stayed at 0
    const { data: earlierRow } = await admin
      .from('customer_purchases')
      .select('classes_used')
      .eq('id', ctx.alicePurchaseEarlierId!)
      .single()
    expect(earlierRow?.classes_used).toBe(0)
  })

  it('passing a used-up purchase raises PURCHASE_INVALID', async () => {
    const { error } = await admin.rpc('book_with_purchase', {
      p_slot_id: ctx.slotBId!,
      p_customer_id: ctx.aliceId!,
      p_purchase_id: ctx.alicePurchaseUsedUpId!,
    })
    expect(error).not.toBeNull()
    expect(error?.message).toContain('PURCHASE_INVALID')

    // Slot B was untouched
    const { data: slot } = await admin
      .from('availability_slots')
      .select('status')
      .eq('id', ctx.slotBId!)
      .single()
    expect(slot?.status).toBe('available')
  })

  it("passing another customer's purchase raises PURCHASE_INVALID", async () => {
    const { error } = await admin.rpc('book_with_purchase', {
      p_slot_id: ctx.slotBId!,
      p_customer_id: ctx.aliceId!,
      p_purchase_id: ctx.bobPurchaseId!,
    })
    expect(error).not.toBeNull()
    expect(error?.message).toContain('PURCHASE_INVALID')

    // Bob's purchase classes_used stayed at 0 (no consumption)
    const { data: bobRow } = await admin
      .from('customer_purchases')
      .select('classes_used')
      .eq('id', ctx.bobPurchaseId!)
      .single()
    expect(bobRow?.classes_used).toBe(0)
  })
})
