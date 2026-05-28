// @vitest-environment node
import WebSocket from 'ws'
if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket
}

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const admin = createClient<Database>(SUPABASE_URL, SERVICE_KEY)

const STAMP = Date.now()
const PASSWORD = 'RlsTest123!'

const f: {
  tenantId?: string
  suspendedTenantId?: string
  ownerUserId?: string
  ownerMemberId?: string
  staffUserId?: string
  staffMemberId?: string
  customerUserId?: string
  otherCustomerUserId?: string
  serviceId?: string
  activePackageId?: string
  inactivePackageId?: string
  suspendedTenantPackageId?: string
  purchaseId?: string
  templateId?: string
  templateWindowId?: string
  templateAssignmentId?: string
  unavailableEventId?: string
  tenantPhotoId?: string
  suspendedTenantPhotoId?: string
  ownerEmail: string
  staffEmail: string
  customerEmail: string
  otherCustomerEmail: string
} = {
  ownerEmail: `rls-rewrite-owner-${STAMP}@example.com`,
  staffEmail: `rls-rewrite-staff-${STAMP}@example.com`,
  customerEmail: `rls-rewrite-customer-${STAMP}@example.com`,
  otherCustomerEmail: `rls-rewrite-other-${STAMP}@example.com`,
}

async function signIn(email: string): Promise<SupabaseClient<Database>> {
  const client = createClient<Database>(SUPABASE_URL, ANON_KEY)
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD })
  if (error) throw new Error(`sign-in failed for ${email}: ${error.message}`)
  return client
}

let ownerClient: SupabaseClient<Database>
let staffClient: SupabaseClient<Database>
let customerClient: SupabaseClient<Database>
const anonClient = createClient<Database>(SUPABASE_URL, ANON_KEY)

beforeAll(async () => {
  // -------- Users --------
  const { data: owner } = await admin.auth.admin.createUser({
    email: f.ownerEmail, password: PASSWORD, email_confirm: true,
  })
  f.ownerUserId = owner!.user!.id

  const { data: staff } = await admin.auth.admin.createUser({
    email: f.staffEmail, password: PASSWORD, email_confirm: true,
  })
  f.staffUserId = staff!.user!.id

  const { data: cust } = await admin.auth.admin.createUser({
    email: f.customerEmail, password: PASSWORD, email_confirm: true,
  })
  f.customerUserId = cust!.user!.id

  const { data: otherCust } = await admin.auth.admin.createUser({
    email: f.otherCustomerEmail, password: PASSWORD, email_confirm: true,
  })
  f.otherCustomerUserId = otherCust!.user!.id

  // -------- Tenants --------
  const { data: tenant } = await admin.from('tenants').insert({
    slug: `rls-rewrite-tenant-${STAMP}`,
    name: 'RLS Rewrite Tenant',
    status: 'active',
  }).select('id').single()
  f.tenantId = tenant!.id

  const { data: suspended } = await admin.from('tenants').insert({
    slug: `rls-rewrite-suspended-${STAMP}`,
    name: 'RLS Rewrite Suspended Tenant',
    status: 'suspended',
  }).select('id').single()
  f.suspendedTenantId = suspended!.id

  // -------- Members --------
  const { data: ownerMember } = await admin.from('tenant_members').insert({
    tenant_id: f.tenantId, user_id: f.ownerUserId, role: 'owner', status: 'active',
  }).select('id').single()
  f.ownerMemberId = ownerMember!.id

  const { data: staffMember } = await admin.from('tenant_members').insert({
    tenant_id: f.tenantId, user_id: f.staffUserId, role: 'staff', status: 'active',
  }).select('id').single()
  f.staffMemberId = staffMember!.id

  // -------- Customers --------
  await admin.from('customers').insert([
    { id: f.customerUserId!, display_name: 'Customer A' },
    { id: f.otherCustomerUserId!, display_name: 'Customer B' },
  ])
  await admin.from('tenant_customers').insert({
    tenant_id: f.tenantId, customer_id: f.customerUserId!,
  })

  // -------- Service + Packages --------
  const { data: service } = await admin.from('services').insert({
    tenant_id: f.tenantId, name: 'RLS Service', duration_minutes: 60, price: 1000, is_active: true,
  }).select('id').single()
  f.serviceId = service!.id

  const { data: activePkg } = await admin.from('service_packages').insert({
    tenant_id: f.tenantId, service_id: f.serviceId, name: 'Active Pkg',
    class_count: 10, price: 9000, expires_in_days: 180, is_active: true,
  }).select('id').single()
  f.activePackageId = activePkg!.id

  const { data: inactivePkg } = await admin.from('service_packages').insert({
    tenant_id: f.tenantId, service_id: f.serviceId, name: 'Inactive Pkg',
    class_count: 5, price: 4500, expires_in_days: 180, is_active: false,
  }).select('id').single()
  f.inactivePackageId = inactivePkg!.id

  // Service + package in suspended tenant (for negative public-read tests)
  const { data: suspendedService } = await admin.from('services').insert({
    tenant_id: f.suspendedTenantId, name: 'Suspended Service',
    duration_minutes: 60, price: 1000, is_active: true,
  }).select('id').single()
  const { data: suspendedPkg } = await admin.from('service_packages').insert({
    tenant_id: f.suspendedTenantId, service_id: suspendedService!.id,
    name: 'Suspended Pkg', class_count: 10, price: 9000, expires_in_days: 180, is_active: true,
  }).select('id').single()
  f.suspendedTenantPackageId = suspendedPkg!.id

  // -------- Purchase (pending_review) --------
  const { data: purchase } = await admin.from('customer_purchases').insert({
    tenant_id: f.tenantId, customer_id: f.customerUserId!, service_id: f.serviceId,
    package_id: f.activePackageId, classes_total: 10, classes_used: 0,
    approval_status: 'pending_review', payment_self_reported: 'awaiting_payment',
  }).select('id').single()
  f.purchaseId = purchase!.id

  // -------- Availability template (belongs to owner's member) --------
  // NOTE: spec plan referenced `is_active` on availability_templates and
  // `start_date`/`end_date` on availability_template_assignments — neither column
  // exists in current schema (see 20260525100000_availability_templates_schema.sql).
  // Using actual columns: assignments uses `effective_from` (date); template has no is_active.
  const { data: template } = await admin.from('availability_templates').insert({
    member_id: f.ownerMemberId, name: 'Owner Template',
  }).select('id').single()
  f.templateId = template!.id

  const { data: window } = await admin.from('availability_template_windows').insert({
    template_id: f.templateId, weekday: 1, start_time: '09:00', end_time: '12:00',
  }).select('id').single()
  f.templateWindowId = window!.id

  const { data: assignment } = await admin.from('availability_template_assignments').insert({
    template_id: f.templateId, member_id: f.ownerMemberId,
    effective_from: '2026-01-01',
  }).select('id').single()
  f.templateAssignmentId = assignment!.id

  // -------- Unavailable event (belongs to staff's member) --------
  const { data: event } = await admin.from('unavailable_events').insert({
    member_id: f.staffMemberId,
    start_at: '2026-12-25T00:00:00Z', end_at: '2026-12-25T23:59:59Z',
    reason: 'Holiday',
  }).select('id').single()
  f.unavailableEventId = event!.id

  // -------- Tenant photos --------
  const { data: photo } = await admin.from('tenant_photos').insert({
    tenant_id: f.tenantId, storage_path: `${f.tenantId}/photo-a.jpg`,
    caption: 'Active Photo', display_order: 0,
  }).select('id').single()
  f.tenantPhotoId = photo!.id

  const { data: suspendedPhoto } = await admin.from('tenant_photos').insert({
    tenant_id: f.suspendedTenantId, storage_path: `${f.suspendedTenantId}/photo-b.jpg`,
    caption: 'Suspended Photo', display_order: 0,
  }).select('id').single()
  f.suspendedTenantPhotoId = suspendedPhoto!.id

  // -------- Sign in clients --------
  ownerClient = await signIn(f.ownerEmail)
  staffClient = await signIn(f.staffEmail)
  customerClient = await signIn(f.customerEmail)
}, 60_000)

afterAll(async () => {
  // Cleanup in FK-respecting order
  if (f.purchaseId) await admin.from('customer_purchases').delete().eq('tenant_id', f.tenantId!)
  if (f.unavailableEventId) await admin.from('unavailable_events').delete().eq('id', f.unavailableEventId)
  if (f.templateAssignmentId) await admin.from('availability_template_assignments').delete().eq('id', f.templateAssignmentId)
  if (f.templateWindowId) await admin.from('availability_template_windows').delete().eq('id', f.templateWindowId)
  if (f.templateId) await admin.from('availability_templates').delete().eq('id', f.templateId)
  if (f.tenantPhotoId) await admin.from('tenant_photos').delete().in('tenant_id', [f.tenantId!, f.suspendedTenantId!])
  if (f.activePackageId) await admin.from('service_packages').delete().in('tenant_id', [f.tenantId!, f.suspendedTenantId!])
  if (f.serviceId) await admin.from('services').delete().in('tenant_id', [f.tenantId!, f.suspendedTenantId!])
  await admin.from('tenant_customers').delete().eq('tenant_id', f.tenantId!)
  await admin.from('tenant_members').delete().eq('tenant_id', f.tenantId!)
  if (f.tenantId) await admin.from('tenants').delete().in('id', [f.tenantId!, f.suspendedTenantId!])
  await admin.from('customers').delete().in('id', [f.customerUserId!, f.otherCustomerUserId!])
  for (const uid of [f.ownerUserId, f.staffUserId, f.customerUserId, f.otherCustomerUserId]) {
    if (uid) await admin.auth.admin.deleteUser(uid).catch(() => {})
  }
})

describe('availability_templates', () => {
  it('owner SELECTs own tenant template (1 row)', async () => {
    const { data } = await ownerClient.from('availability_templates').select('id').eq('id', f.templateId!)
    expect(data).toHaveLength(1)
  })

  it('staff SELECTs templates of own member_id (0 rows — template belongs to owner)', async () => {
    const { data } = await staffClient.from('availability_templates').select('id').eq('id', f.templateId!)
    expect(data).toHaveLength(0)
  })

  it('customer SELECTs templates (0 rows — RLS blocks)', async () => {
    const { data } = await customerClient.from('availability_templates').select('id').eq('id', f.templateId!)
    expect(data).toHaveLength(0)
  })

  it('anon SELECTs templates (0 rows — no session)', async () => {
    const { data } = await anonClient.from('availability_templates').select('id').eq('id', f.templateId!)
    expect(data).toHaveLength(0)
  })
})

describe('availability_template_windows', () => {
  it('owner SELECTs window of own tenant template', async () => {
    const { data } = await ownerClient.from('availability_template_windows').select('id').eq('id', f.templateWindowId!)
    expect(data).toHaveLength(1)
  })

  it('customer SELECTs window (0 rows)', async () => {
    const { data } = await customerClient.from('availability_template_windows').select('id').eq('id', f.templateWindowId!)
    expect(data).toHaveLength(0)
  })
})

describe('availability_template_assignments', () => {
  it('owner SELECTs assignment of own tenant', async () => {
    const { data } = await ownerClient.from('availability_template_assignments').select('id').eq('id', f.templateAssignmentId!)
    expect(data).toHaveLength(1)
  })

  it('customer SELECTs assignment (0 rows)', async () => {
    const { data } = await customerClient.from('availability_template_assignments').select('id').eq('id', f.templateAssignmentId!)
    expect(data).toHaveLength(0)
  })
})

describe('unavailable_events', () => {
  it('owner SELECTs event of own tenant (1 row, owner sees all in tenant)', async () => {
    const { data } = await ownerClient.from('unavailable_events').select('id').eq('id', f.unavailableEventId!)
    expect(data).toHaveLength(1)
  })

  it('staff SELECTs own member event (1 row)', async () => {
    const { data } = await staffClient.from('unavailable_events').select('id').eq('id', f.unavailableEventId!)
    expect(data).toHaveLength(1)
  })

  it('customer SELECTs event (0 rows)', async () => {
    const { data } = await customerClient.from('unavailable_events').select('id').eq('id', f.unavailableEventId!)
    expect(data).toHaveLength(0)
  })

  it('anon SELECTs event (0 rows)', async () => {
    const { data } = await anonClient.from('unavailable_events').select('id').eq('id', f.unavailableEventId!)
    expect(data).toHaveLength(0)
  })
})

describe('service_packages', () => {
  it('anon SELECTs active package of active tenant (1 row)', async () => {
    const { data } = await anonClient.from('service_packages').select('id').eq('id', f.activePackageId!)
    expect(data).toHaveLength(1)
  })

  it('anon SELECTs inactive package (0 rows — is_active=false blocks)', async () => {
    const { data } = await anonClient.from('service_packages').select('id').eq('id', f.inactivePackageId!)
    expect(data).toHaveLength(0)
  })

  it('anon SELECTs active package of suspended tenant (0 rows)', async () => {
    const { data } = await anonClient.from('service_packages').select('id').eq('id', f.suspendedTenantPackageId!)
    expect(data).toHaveLength(0)
  })

  it('owner INSERTs new package (success)', async () => {
    const { data, error } = await ownerClient.from('service_packages').insert({
      tenant_id: f.tenantId!, service_id: f.serviceId!, name: 'Owner Insert',
      class_count: 5, price: 4500, expires_in_days: 180, is_active: true,
    }).select('id').single()
    expect(error).toBeNull()
    expect(data?.id).toBeTruthy()
    // Cleanup
    if (data?.id) await admin.from('service_packages').delete().eq('id', data.id)
  })

  it('customer INSERTs package (blocked)', async () => {
    const { error } = await customerClient.from('service_packages').insert({
      tenant_id: f.tenantId!, service_id: f.serviceId!, name: 'Customer Insert',
      class_count: 5, price: 4500, expires_in_days: 180, is_active: true,
    })
    expect(error).not.toBeNull()
  })
})

describe('tenant_photos', () => {
  it('anon SELECTs photo of active tenant (1 row)', async () => {
    const { data } = await anonClient.from('tenant_photos').select('id').eq('id', f.tenantPhotoId!)
    expect(data).toHaveLength(1)
  })

  it('anon SELECTs photo of suspended tenant (0 rows)', async () => {
    const { data } = await anonClient.from('tenant_photos').select('id').eq('id', f.suspendedTenantPhotoId!)
    expect(data).toHaveLength(0)
  })

  it('owner DELETEs own photo (success)', async () => {
    // Insert a deletable photo first
    const { data: newPhoto } = await admin.from('tenant_photos').insert({
      tenant_id: f.tenantId!, storage_path: `${f.tenantId}/del.jpg`,
      caption: 'Delete me', display_order: 99,
    }).select('id').single()
    const { error } = await ownerClient.from('tenant_photos').delete().eq('id', newPhoto!.id)
    expect(error).toBeNull()
  })

  it('customer DELETEs owner photo (blocked, photo still exists)', async () => {
    await customerClient.from('tenant_photos').delete().eq('id', f.tenantPhotoId!)
    // Verify still there
    const { data } = await admin.from('tenant_photos').select('id').eq('id', f.tenantPhotoId!)
    expect(data).toHaveLength(1)
  })
})

describe('customer_purchases', () => {
  it('customer SELECTs own purchase (1 row)', async () => {
    const { data } = await customerClient.from('customer_purchases').select('id').eq('id', f.purchaseId!)
    expect(data).toHaveLength(1)
  })

  it('other customer SELECTs the purchase (0 rows)', async () => {
    // Sign in as the second customer
    const otherClient = await signIn(f.otherCustomerEmail)
    const { data } = await otherClient.from('customer_purchases').select('id').eq('id', f.purchaseId!)
    expect(data).toHaveLength(0)
  })

  it('owner (tenant member) SELECTs purchase in own tenant (≥1 row)', async () => {
    const { data } = await ownerClient.from('customer_purchases').select('id').eq('tenant_id', f.tenantId!)
    expect((data?.length ?? 0)).toBeGreaterThanOrEqual(1)
  })

  it('customer INSERTs own pending_review purchase (success)', async () => {
    const { data, error } = await customerClient.from('customer_purchases').insert({
      tenant_id: f.tenantId!, customer_id: f.customerUserId!, service_id: f.serviceId!,
      package_id: f.activePackageId!, classes_total: 10, classes_used: 0,
      approval_status: 'pending_review', payment_self_reported: 'awaiting_payment',
    }).select('id').single()
    expect(error).toBeNull()
    if (data?.id) await admin.from('customer_purchases').delete().eq('id', data.id)
  })

  it('customer INSERTs own purchase with approval_status=confirmed (blocked by WITH CHECK)', async () => {
    const { error } = await customerClient.from('customer_purchases').insert({
      tenant_id: f.tenantId!, customer_id: f.customerUserId!, service_id: f.serviceId!,
      package_id: f.activePackageId!, classes_total: 10, classes_used: 0,
      approval_status: 'confirmed', payment_self_reported: 'awaiting_payment',
    })
    expect(error).not.toBeNull()
  })

  it('customer INSERTs purchase with classes_used > 0 (blocked)', async () => {
    const { error } = await customerClient.from('customer_purchases').insert({
      tenant_id: f.tenantId!, customer_id: f.customerUserId!, service_id: f.serviceId!,
      package_id: f.activePackageId!, classes_total: 10, classes_used: 5,
      approval_status: 'pending_review', payment_self_reported: 'awaiting_payment',
    })
    expect(error).not.toBeNull()
  })

  it('customer UPDATEs own purchase (blocked — only members can update)', async () => {
    const { error } = await customerClient.from('customer_purchases')
      .update({ payment_self_reported: 'claimed_paid' })
      .eq('id', f.purchaseId!)
    // Postgres RLS doesn't error on UPDATE 0 rows; verify row didn't change
    const { data: after } = await admin.from('customer_purchases').select('payment_self_reported').eq('id', f.purchaseId!).single()
    expect(after?.payment_self_reported).toBe('awaiting_payment') // unchanged
  })
})
