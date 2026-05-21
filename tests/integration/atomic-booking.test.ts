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

const ctx: {
  coachUserId?: string
  customer1Id?: string
  customer2Id?: string
  tenantId?: string
  memberId?: string
  serviceId?: string
  slotId?: string
} = {}

describe('book_slot_atomic RPC', () => {
  beforeAll(async () => {
    const ts = Date.now()
    const { data: coach } = await admin.auth.admin.createUser({
      email: `coach-${ts}@example.com`,
      password: 'TestPass123!',
      email_confirm: true,
    })
    ctx.coachUserId = coach!.user!.id
    const { data: c1 } = await admin.auth.admin.createUser({
      email: `c1-${ts}@example.com`,
      password: 'TestPass123!',
      email_confirm: true,
    })
    ctx.customer1Id = c1!.user!.id
    const { data: c2 } = await admin.auth.admin.createUser({
      email: `c2-${ts}@example.com`,
      password: 'TestPass123!',
      email_confirm: true,
    })
    ctx.customer2Id = c2!.user!.id

    const { data: tenant } = await admin
      .from('tenants')
      .insert({ slug: `book-${ts}`, name: 'Atomic booking test' })
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
      .insert({ tenant_id: tenant!.id, name: 'svc', duration_minutes: 60 })
      .select()
      .single()
    ctx.serviceId = svc!.id
    // Create both customer profiles
    await admin.from('customers').upsert([
      { id: c1!.user!.id, display_name: 'C1' },
      { id: c2!.user!.id, display_name: 'C2' },
    ])

    const { data: slot } = await admin
      .from('availability_slots')
      .insert({
        tenant_id: tenant!.id,
        member_id: member!.id,
        service_id: svc!.id,
        start_at: '2026-10-01T10:00:00Z',
        end_at: '2026-10-01T11:00:00Z',
      })
      .select()
      .single()
    ctx.slotId = slot!.id
  }, 30_000)

  afterAll(async () => {
    if (ctx.tenantId) await admin.from('tenants').delete().eq('id', ctx.tenantId)
    if (ctx.coachUserId) await admin.auth.admin.deleteUser(ctx.coachUserId)
    if (ctx.customer1Id) await admin.auth.admin.deleteUser(ctx.customer1Id)
    if (ctx.customer2Id) await admin.auth.admin.deleteUser(ctx.customer2Id)
  }, 30_000)

  it('first customer books successfully; second sees SLOT_UNAVAILABLE', async () => {
    const { data: r1, error: e1 } = await admin.rpc('book_slot_atomic', {
      p_slot_id: ctx.slotId!,
      p_customer_id: ctx.customer1Id!,
    })
    expect(e1).toBeNull()
    expect(r1).not.toBeNull()

    // Slot should now be 'pending'
    const { data: slotRow } = await admin
      .from('availability_slots')
      .select('status')
      .eq('id', ctx.slotId!)
      .single()
    expect(slotRow?.status).toBe('pending')

    // Second customer's attempt should fail
    const { error: e2 } = await admin.rpc('book_slot_atomic', {
      p_slot_id: ctx.slotId!,
      p_customer_id: ctx.customer2Id!,
    })
    expect(e2).not.toBeNull()
    expect(e2?.message).toContain('SLOT_UNAVAILABLE')
  })

  it('cancel_booking releases the slot back to available', async () => {
    // Find the pending booking
    const { data: booking } = await admin
      .from('bookings')
      .select('id')
      .eq('slot_id', ctx.slotId!)
      .single()
    expect(booking).not.toBeNull()

    // Customer cancels
    await admin.rpc('cancel_booking', { p_booking_id: booking!.id })

    const { data: slotRow } = await admin
      .from('availability_slots')
      .select('status')
      .eq('id', ctx.slotId!)
      .single()
    expect(slotRow?.status).toBe('available')
  })

  it('rebooking after cancel works (second customer can now book)', async () => {
    const { error } = await admin.rpc('book_slot_atomic', {
      p_slot_id: ctx.slotId!,
      p_customer_id: ctx.customer2Id!,
    })
    expect(error).toBeNull()
  })
})
