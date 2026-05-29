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
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const admin = createClient<Database>(SUPABASE_URL, SERVICE_KEY)

const ts = Date.now()
const ctx: {
  aliceId?: string
  bobId?: string
  coachId?: string
  tenantId?: string
  memberId?: string
  serviceId?: string
  slotAId?: string
  slotBId?: string
  slotCId?: string
  bobPurchaseId?: string
  aliceEmail: string
  alicePassword: string
  bobEmail: string
  bobPassword: string
} = {
  aliceEmail: `alice-rpc-${ts}@example.com`,
  alicePassword: 'TestPass123!',
  bobEmail: `bob-rpc-${ts}@example.com`,
  bobPassword: 'TestPass123!',
}

describe('Booking RPC cross-customer guard (P0 fix 2026-05-29)', () => {
  beforeAll(async () => {
    const { data: alice } = await admin.auth.admin.createUser({
      email: ctx.aliceEmail,
      password: ctx.alicePassword,
      email_confirm: true,
    })
    ctx.aliceId = alice!.user!.id
    const { data: bob } = await admin.auth.admin.createUser({
      email: ctx.bobEmail,
      password: ctx.bobPassword,
      email_confirm: true,
    })
    ctx.bobId = bob!.user!.id
    const { data: coach } = await admin.auth.admin.createUser({
      email: `coach-rpc-${ts}@example.com`,
      password: 'TestPass123!',
      email_confirm: true,
    })
    ctx.coachId = coach!.user!.id

    const { data: tenant } = await admin
      .from('tenants')
      .insert({ slug: `rpc-guard-${ts}`, name: 'RPC guard test' })
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
        name: 'svc',
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

    // Three distinct slots so each test can use its own
    const baseHour = (offset: number) =>
      new Date(Date.now() + 1000 * 60 * 60 * 24 * 30 + offset * 1000 * 60 * 60).toISOString()
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
        {
          tenant_id: tenant!.id,
          member_id: member!.id,
          service_id: svc!.id,
          start_at: baseHour(4),
          end_at: baseHour(5),
        },
      ])
      .select()
    const [s0, s1, s2] = slots ?? []
    if (!s0 || !s1 || !s2) throw new Error('failed to create 3 slots')
    ctx.slotAId = s0.id
    ctx.slotBId = s1.id
    ctx.slotCId = s2.id

    // Bob has a valid purchase; Alice has none.
    const { data: purchase } = await admin
      .from('customer_purchases')
      .insert({
        tenant_id: tenant!.id,
        customer_id: bob!.user!.id,
        service_id: svc!.id,
        classes_total: 10,
        classes_used: 0,
        approval_status: 'confirmed',
        approved_at: new Date().toISOString(),
        payment_self_reported: 'claimed_paid',
      })
      .select()
      .single()
    ctx.bobPurchaseId = purchase!.id
  }, 30_000)

  afterAll(async () => {
    if (ctx.tenantId) await admin.from('tenants').delete().eq('id', ctx.tenantId)
    if (ctx.aliceId) await admin.auth.admin.deleteUser(ctx.aliceId)
    if (ctx.bobId) await admin.auth.admin.deleteUser(ctx.bobId)
    if (ctx.coachId) await admin.auth.admin.deleteUser(ctx.coachId)
  }, 30_000)

  it('book_with_purchase: Alice (signed in) cannot book using Bob as p_customer_id', async () => {
    const aliceClient = createClient<Database>(SUPABASE_URL, ANON_KEY)
    const { error: signInErr } = await aliceClient.auth.signInWithPassword({
      email: ctx.aliceEmail,
      password: ctx.alicePassword,
    })
    expect(signInErr).toBeNull()

    const { error } = await aliceClient.rpc('book_with_purchase', {
      p_slot_id: ctx.slotAId!,
      p_customer_id: ctx.bobId!,
    })
    expect(error).not.toBeNull()
    expect(error?.code).toBe('42501')

    // Verify Bob's purchase was NOT consumed
    const { data: purchase } = await admin
      .from('customer_purchases')
      .select('classes_used')
      .eq('id', ctx.bobPurchaseId!)
      .single()
    expect(purchase?.classes_used).toBe(0)

    // Slot must still be available
    const { data: slot } = await admin
      .from('availability_slots')
      .select('status')
      .eq('id', ctx.slotAId!)
      .single()
    expect(slot?.status).toBe('available')
  })

  it('book_slot_atomic: Alice (signed in) cannot book using Bob as p_customer_id', async () => {
    const aliceClient = createClient<Database>(SUPABASE_URL, ANON_KEY)
    await aliceClient.auth.signInWithPassword({
      email: ctx.aliceEmail,
      password: ctx.alicePassword,
    })

    const { error } = await aliceClient.rpc('book_slot_atomic', {
      p_slot_id: ctx.slotBId!,
      p_customer_id: ctx.bobId!,
    })
    expect(error).not.toBeNull()
    expect(error?.code).toBe('42501')

    const { data: slot } = await admin
      .from('availability_slots')
      .select('status')
      .eq('id', ctx.slotBId!)
      .single()
    expect(slot?.status).toBe('available')
  })

  it('book_with_purchase: Bob (signed in) CAN book for himself with own purchase', async () => {
    const bobClient = createClient<Database>(SUPABASE_URL, ANON_KEY)
    const { error: signInErr } = await bobClient.auth.signInWithPassword({
      email: ctx.bobEmail,
      password: ctx.bobPassword,
    })
    expect(signInErr).toBeNull()

    const { data, error } = await bobClient.rpc('book_with_purchase', {
      p_slot_id: ctx.slotCId!,
      p_customer_id: ctx.bobId!,
    })
    expect(error).toBeNull()
    expect(data).toBeDefined()

    const { data: purchase } = await admin
      .from('customer_purchases')
      .select('classes_used')
      .eq('id', ctx.bobPurchaseId!)
      .single()
    expect(purchase?.classes_used).toBe(1)
  })
})
