// @vitest-environment node
import WebSocket from 'ws'
if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket
}

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

// Covers migration 20261125100000_booking_guard_fixes.sql:
//   1. book_with_purchase rejects customers blocked by the tenant (CUSTOMER_BLOCKED)
//   2. confirm_booking no longer marks a group slot 'booked' before it is full

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const admin = createClient<Database>(URL, SERVICE)
const ts = Date.now()
const PW = 'TestPass123!'

const ctx: {
  tenantId?: string
  coachId?: string
  memberId?: string
  groupServiceId?: string
  soloServiceId?: string
  coachClient?: SupabaseClient<Database>
  customerIds: string[]
} = { customerIds: [] }

async function signedInClient(email: string) {
  const c = createClient<Database>(URL, ANON)
  const { error } = await c.auth.signInWithPassword({ email, password: PW })
  if (error) throw new Error(`signIn ${email}: ${error.message}`)
  return c
}

async function makeCustomer(label: string, serviceId: string) {
  const { data: u, error } = await admin.auth.admin.createUser({
    email: `${label}-bgf-${ts}@example.com`,
    password: PW,
    email_confirm: true,
  })
  if (error) throw new Error(`createUser ${label}: ${error.message}`)
  const id = u.user!.id
  ctx.customerIds.push(id)
  await admin.from('customers').insert({ id, display_name: label.toUpperCase() })
  const { error: pe } = await admin.from('customer_purchases').insert({
    tenant_id: ctx.tenantId!,
    customer_id: id,
    service_id: serviceId,
    classes_total: 5,
    classes_used: 0,
    approval_status: 'confirmed',
    approved_at: new Date().toISOString(),
    payment_self_reported: 'claimed_paid',
  })
  if (pe) throw new Error(`purchase ${label}: ${pe.message}`)
  return id
}

let slotSeq = 0
async function makeSlot(serviceId: string) {
  // Non-overlapping windows for the single member (EXCLUDE constraint)
  const start = Date.now() + 1000 * 60 * 60 * 24 * 30 + slotSeq++ * 2 * 3600_000
  const { data, error } = await admin
    .from('availability_slots')
    .insert({
      tenant_id: ctx.tenantId!,
      member_id: ctx.memberId!,
      service_id: serviceId,
      start_at: new Date(start).toISOString(),
      end_at: new Date(start + 3600_000).toISOString(),
    })
    .select()
    .single()
  if (error) throw new Error(`makeSlot: ${error.message}`)
  return data.id
}

async function slotStatus(id: string) {
  const { data } = await admin.from('availability_slots').select('status').eq('id', id).single()
  return data?.status
}

async function usedClasses(customerId: string) {
  const { data } = await admin
    .from('customer_purchases')
    .select('classes_used')
    .eq('customer_id', customerId)
    .single()
  return data?.classes_used
}

describe('booking guard fixes (2026-11-25)', () => {
  beforeAll(async () => {
    const { data: t } = await admin
      .from('tenants')
      .insert({ slug: `bgf-${ts}`, name: 'Booking guard fixes' })
      .select()
      .single()
    ctx.tenantId = t!.id

    const coachEmail = `coach-bgf-${ts}@example.com`
    const { data: coach } = await admin.auth.admin.createUser({
      email: coachEmail,
      password: PW,
      email_confirm: true,
    })
    ctx.coachId = coach!.user!.id
    const { data: m } = await admin
      .from('tenant_members')
      .insert({ tenant_id: ctx.tenantId, user_id: ctx.coachId, role: 'owner', status: 'active' })
      .select()
      .single()
    ctx.memberId = m!.id

    const { data: group } = await admin
      .from('services')
      .insert({
        tenant_id: ctx.tenantId,
        name: 'Group 3/3',
        duration_minutes: 60,
        max_capacity: 3,
        min_attendance: 3,
      })
      .select()
      .single()
    ctx.groupServiceId = group!.id

    const { data: solo } = await admin
      .from('services')
      .insert({ tenant_id: ctx.tenantId, name: 'Solo', duration_minutes: 60 })
      .select()
      .single()
    ctx.soloServiceId = solo!.id

    ctx.coachClient = await signedInClient(coachEmail)
  }, 60_000)

  afterAll(async () => {
    if (ctx.tenantId) await admin.from('tenants').delete().eq('id', ctx.tenantId)
    if (ctx.coachId) await admin.auth.admin.deleteUser(ctx.coachId)
    for (const id of ctx.customerIds) await admin.auth.admin.deleteUser(id)
  }, 60_000)

  describe('book_with_purchase blocks banned customers', () => {
    it('blocked customer gets CUSTOMER_BLOCKED and no class is deducted', async () => {
      const customerId = await makeCustomer('blocked', ctx.soloServiceId!)
      const slotId = await makeSlot(ctx.soloServiceId!)
      await admin
        .from('tenant_customers')
        .insert({ tenant_id: ctx.tenantId!, customer_id: customerId, is_blocked: true })

      const { error } = await admin.rpc('book_with_purchase', {
        p_slot_id: slotId,
        p_customer_id: customerId,
      })
      expect(error?.message).toContain('CUSTOMER_BLOCKED')

      expect(await usedClasses(customerId)).toBe(0)
      expect(await slotStatus(slotId)).toBe('available')
      const { count } = await admin
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('slot_id', slotId)
      expect(count).toBe(0)
    })

    it('unblocking lets the same customer book again', async () => {
      const customerId = ctx.customerIds[0]!
      const slotId = await makeSlot(ctx.soloServiceId!)
      await admin
        .from('tenant_customers')
        .update({ is_blocked: false })
        .eq('tenant_id', ctx.tenantId!)
        .eq('customer_id', customerId)

      const { error } = await admin.rpc('book_with_purchase', {
        p_slot_id: slotId,
        p_customer_id: customerId,
      })
      expect(error).toBeNull()
      expect(await usedClasses(customerId)).toBe(1)
    })

    it('a customer with no tenant_customers row yet can still book', async () => {
      const customerId = await makeCustomer('fresh', ctx.soloServiceId!)
      const slotId = await makeSlot(ctx.soloServiceId!)
      const { error } = await admin.rpc('book_with_purchase', {
        p_slot_id: slotId,
        p_customer_id: customerId,
      })
      expect(error).toBeNull()
    })
  })

  describe('confirm_booking keeps a partially filled group slot open', () => {
    let slotId: string
    const bookingIds: string[] = []
    const groupCustomers: string[] = []

    it('manual confirm of 1/3 leaves the slot pending, not booked', async () => {
      slotId = await makeSlot(ctx.groupServiceId!)
      for (const label of ['g1', 'g2', 'g3']) {
        groupCustomers.push(await makeCustomer(label, ctx.groupServiceId!))
      }

      const { data, error } = await admin.rpc('book_with_purchase', {
        p_slot_id: slotId,
        p_customer_id: groupCustomers[0]!,
      })
      expect(error).toBeNull()
      const row = (data as Array<{ booking_id: string; auto_confirmed: boolean }>)[0]!
      expect(row.auto_confirmed).toBe(false)
      bookingIds.push(row.booking_id)

      const { error: confirmErr } = await ctx.coachClient!.rpc('confirm_booking', {
        p_booking_id: row.booking_id,
      })
      expect(confirmErr).toBeNull()

      const { data: b } = await admin
        .from('bookings')
        .select('status')
        .eq('id', row.booking_id)
        .single()
      expect(b?.status).toBe('confirmed')
      expect(await slotStatus(slotId)).toBe('pending')
    })

    it('a second student can still join after the manual confirm', async () => {
      const { data, error } = await admin.rpc('book_with_purchase', {
        p_slot_id: slotId,
        p_customer_id: groupCustomers[1]!,
      })
      expect(error).toBeNull()
      bookingIds.push((data as Array<{ booking_id: string }>)[0]!.booking_id)
      expect(await slotStatus(slotId)).toBe('pending')
    })

    it('manual confirm of 2/3 still leaves the slot pending', async () => {
      const { error } = await ctx.coachClient!.rpc('confirm_booking', {
        p_booking_id: bookingIds[1]!,
      })
      expect(error).toBeNull()
      expect(await slotStatus(slotId)).toBe('pending')
    })

    it('the slot becomes booked only when the 3rd seat is taken', async () => {
      const { error } = await admin.rpc('book_with_purchase', {
        p_slot_id: slotId,
        p_customer_id: groupCustomers[2]!,
      })
      expect(error).toBeNull()
      expect(await slotStatus(slotId)).toBe('booked')
    })
  })
})
