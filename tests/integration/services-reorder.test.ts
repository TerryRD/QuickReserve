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
  tenantAId?: string
  tenantBId?: string
  ownerAId?: string
  ownerBId?: string
  servicesA?: string[]
  servicesB?: string[]
} = {}

describe('Services drag-reorder (display_order + ownership)', () => {
  beforeAll(async () => {
    const { data: ownerA } = await admin.auth.admin.createUser({
      email: `owner-a-${ts}@example.com`,
      password: 'TestPass123!',
      email_confirm: true,
    })
    ctx.ownerAId = ownerA!.user!.id
    const { data: ownerB } = await admin.auth.admin.createUser({
      email: `owner-b-${ts}@example.com`,
      password: 'TestPass123!',
      email_confirm: true,
    })
    ctx.ownerBId = ownerB!.user!.id

    const { data: tA } = await admin
      .from('tenants')
      .insert({ slug: `reorder-a-${ts}`, name: 'Reorder A' })
      .select()
      .single()
    ctx.tenantAId = tA!.id
    const { data: tB } = await admin
      .from('tenants')
      .insert({ slug: `reorder-b-${ts}`, name: 'Reorder B' })
      .select()
      .single()
    ctx.tenantBId = tB!.id

    await admin.from('tenant_members').insert([
      { tenant_id: tA!.id, user_id: ownerA!.user!.id, role: 'owner', status: 'active' },
      { tenant_id: tB!.id, user_id: ownerB!.user!.id, role: 'owner', status: 'active' },
    ])

    // Tenant A: 3 services. Insert order matters less since the migration
    // backfilled display_order alphabetically; we'll assert against the
    // current values, not assumptions.
    const { data: svcsA } = await admin
      .from('services')
      .insert([
        { tenant_id: tA!.id, name: 'Alpha', duration_minutes: 30 },
        { tenant_id: tA!.id, name: 'Beta', duration_minutes: 60 },
        { tenant_id: tA!.id, name: 'Gamma', duration_minutes: 45 },
      ])
      .select('id')
    ctx.servicesA = svcsA!.map((s) => s.id)

    // Tenant B: 1 service — for the cross-tenant attempt
    const { data: svcsB } = await admin
      .from('services')
      .insert([{ tenant_id: tB!.id, name: 'Bonly', duration_minutes: 30 }])
      .select('id')
    ctx.servicesB = svcsB!.map((s) => s.id)

    // Manually set display_order so the test starts from a known baseline,
    // independent of the migration backfill semantics.
    await Promise.all(
      ctx.servicesA!.map((id, idx) =>
        admin.from('services').update({ display_order: idx }).eq('id', id),
      ),
    )
  }, 30_000)

  afterAll(async () => {
    if (ctx.tenantAId) await admin.from('tenants').delete().eq('id', ctx.tenantAId)
    if (ctx.tenantBId) await admin.from('tenants').delete().eq('id', ctx.tenantBId)
    if (ctx.ownerAId) await admin.auth.admin.deleteUser(ctx.ownerAId)
    if (ctx.ownerBId) await admin.auth.admin.deleteUser(ctx.ownerBId)
  }, 30_000)

  it('reverses order: admin can bulk-update display_order', async () => {
    const reversed = [...ctx.servicesA!].reverse()
    await Promise.all(
      reversed.map((id, idx) =>
        admin.from('services').update({ display_order: idx }).eq('id', id),
      ),
    )

    const { data: rows } = await admin
      .from('services')
      .select('id, display_order')
      .in('id', ctx.servicesA!)
      .order('display_order', { ascending: true })

    expect(rows?.map((r) => r.id)).toEqual(reversed)
  })

  it('public-page ordering follows display_order then name', async () => {
    // Sets the order to [B-via-display-0, A-via-display-1, G-via-display-2].
    // After the next SELECT ordered by (display_order asc, name asc) we should
    // get back the exact array ordering we wrote.
    const target = [ctx.servicesA![1]!, ctx.servicesA![0]!, ctx.servicesA![2]!]
    await Promise.all(
      target.map((id, idx) =>
        admin.from('services').update({ display_order: idx }).eq('id', id),
      ),
    )

    const { data: rows } = await admin
      .from('services')
      .select('id, display_order, name')
      .eq('tenant_id', ctx.tenantAId!)
      .order('display_order', { ascending: true })
      .order('name', { ascending: true })

    expect(rows?.map((r) => r.id)).toEqual(target)
  })

  it('cross-tenant id cannot satisfy ownership check', async () => {
    // Simulate what reorderServicesAction's count guard would see when an
    // attacker mixes someone else's id into their payload.
    const mixed = [...ctx.servicesA!.slice(0, 2), ctx.servicesB![0]!]
    const { count } = await admin
      .from('services')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', ctx.tenantAId!)
      .in('id', mixed)
    // count returns 2 — the cross-tenant id is filtered out — so the action
    // would reject the request (count !== orderedIds.length).
    expect(count).toBe(2)
  })
})
