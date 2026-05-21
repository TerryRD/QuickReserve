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
  userId?: string
  tenantId?: string
  memberId?: string
  serviceId?: string
} = {}

describe('availability_slots EXCLUDE constraint', () => {
  beforeAll(async () => {
    const ts = Date.now()
    const { data: user } = await admin.auth.admin.createUser({
      email: `excl-${ts}@example.com`,
      password: 'TestPass123!',
      email_confirm: true,
    })
    ctx.userId = user!.user!.id
    const { data: tenant } = await admin
      .from('tenants')
      .insert({ slug: `excl-${ts}`, name: 'EXCL test' })
      .select()
      .single()
    ctx.tenantId = tenant!.id
    const { data: member } = await admin
      .from('tenant_members')
      .insert({ tenant_id: tenant!.id, user_id: user!.user!.id, role: 'owner', status: 'active' })
      .select()
      .single()
    ctx.memberId = member!.id
    const { data: svc } = await admin
      .from('services')
      .insert({ tenant_id: tenant!.id, name: 'svc', duration_minutes: 60 })
      .select()
      .single()
    ctx.serviceId = svc!.id
  }, 30_000)

  afterAll(async () => {
    if (ctx.tenantId) await admin.from('tenants').delete().eq('id', ctx.tenantId)
    if (ctx.userId) await admin.auth.admin.deleteUser(ctx.userId)
  }, 30_000)

  it('allows non-overlapping slots', async () => {
    const { error: a } = await admin.from('availability_slots').insert({
      tenant_id: ctx.tenantId!,
      member_id: ctx.memberId!,
      service_id: ctx.serviceId!,
      start_at: '2026-06-01T08:00:00Z',
      end_at: '2026-06-01T09:00:00Z',
    })
    expect(a).toBeNull()
    const { error: b } = await admin.from('availability_slots').insert({
      tenant_id: ctx.tenantId!,
      member_id: ctx.memberId!,
      service_id: ctx.serviceId!,
      start_at: '2026-06-01T09:00:00Z',
      end_at: '2026-06-01T10:00:00Z',
    })
    expect(b).toBeNull()
  })

  it('rejects overlapping slot with 23P01', async () => {
    const { error } = await admin.from('availability_slots').insert({
      tenant_id: ctx.tenantId!,
      member_id: ctx.memberId!,
      service_id: ctx.serviceId!,
      start_at: '2026-06-01T08:30:00Z',
      end_at: '2026-06-01T09:30:00Z',
    })
    expect(error).not.toBeNull()
    expect(error?.code).toBe('23P01')
  })
})
