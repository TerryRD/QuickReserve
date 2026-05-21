// @vitest-environment node
import WebSocket from 'ws'
// Polyfill global WebSocket for Node 20 (Supabase realtime client needs it at construction time)
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

const fixtures: {
  tenantAId?: string
  tenantBId?: string
  userAId?: string
  userBId?: string
  userAEmail: string
  userBEmail: string
  userAPassword: string
  userBPassword: string
} = {
  userAEmail: `rls-test-a-${Date.now()}@example.com`,
  userBEmail: `rls-test-b-${Date.now()}@example.com`,
  userAPassword: 'TestPass123!',
  userBPassword: 'TestPass123!',
}

describe('Identity RLS isolation', () => {
  beforeAll(async () => {
    // Create users via admin API
    const { data: userA, error: errA } = await admin.auth.admin.createUser({
      email: fixtures.userAEmail,
      password: fixtures.userAPassword,
      email_confirm: true,
    })
    if (errA || !userA?.user) throw new Error(`failed to create user A: ${errA?.message}`)
    fixtures.userAId = userA.user.id

    const { data: userB, error: errB } = await admin.auth.admin.createUser({
      email: fixtures.userBEmail,
      password: fixtures.userBPassword,
      email_confirm: true,
    })
    if (errB || !userB?.user) throw new Error(`failed to create user B: ${errB?.message}`)
    fixtures.userBId = userB.user.id

    // Create two tenants
    const ts = Date.now()
    const { data: tenantA, error: tErrA } = await admin
      .from('tenants')
      .insert({ slug: `rls-a-${ts}`, name: 'Tenant A' })
      .select()
      .single()
    if (tErrA || !tenantA) throw new Error(`failed to create tenant A: ${tErrA?.message}`)
    fixtures.tenantAId = tenantA.id

    const { data: tenantB, error: tErrB } = await admin
      .from('tenants')
      .insert({ slug: `rls-b-${ts}`, name: 'Tenant B' })
      .select()
      .single()
    if (tErrB || !tenantB) throw new Error(`failed to create tenant B: ${tErrB?.message}`)
    fixtures.tenantBId = tenantB.id

    // Assign users as owners
    await admin.from('tenant_members').insert([
      { tenant_id: tenantA.id, user_id: userA.user.id, role: 'owner', status: 'active' },
      { tenant_id: tenantB.id, user_id: userB.user.id, role: 'owner', status: 'active' },
    ])
  }, 30_000)

  afterAll(async () => {
    if (fixtures.tenantAId) await admin.from('tenants').delete().eq('id', fixtures.tenantAId)
    if (fixtures.tenantBId) await admin.from('tenants').delete().eq('id', fixtures.tenantBId)
    if (fixtures.userAId) await admin.auth.admin.deleteUser(fixtures.userAId)
    if (fixtures.userBId) await admin.auth.admin.deleteUser(fixtures.userBId)
  }, 30_000)

  it('Tenant A owner cannot see Tenant B members', async () => {
    const userAClient = createClient<Database>(SUPABASE_URL, ANON_KEY)
    const { error: signInErr } = await userAClient.auth.signInWithPassword({
      email: fixtures.userAEmail,
      password: fixtures.userAPassword,
    })
    expect(signInErr).toBeNull()

    const { data, error } = await userAClient
      .from('tenant_members')
      .select('id, tenant_id')
      .eq('tenant_id', fixtures.tenantBId!)
    expect(error).toBeNull()
    expect(data).toEqual([]) // RLS filters out — no rows visible
  })

  it('Tenant A owner CAN see own tenant members', async () => {
    const userAClient = createClient<Database>(SUPABASE_URL, ANON_KEY)
    await userAClient.auth.signInWithPassword({
      email: fixtures.userAEmail,
      password: fixtures.userAPassword,
    })

    const { data } = await userAClient
      .from('tenant_members')
      .select('id, tenant_id')
      .eq('tenant_id', fixtures.tenantAId!)
    expect(data?.length).toBeGreaterThanOrEqual(1)
  })
})
