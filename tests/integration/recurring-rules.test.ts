// @vitest-environment node
import WebSocket from 'ws'
if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket
}

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import { computeOccurrences } from '@/lib/recurrence'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const admin = createClient<Database>(SUPABASE_URL, SERVICE_KEY)

const ctx: {
  userId?: string
  tenantId?: string
  memberId?: string
  serviceId?: string
  ruleId?: string
} = {}

describe('recurring_rules integration', () => {
  beforeAll(async () => {
    const ts = Date.now()
    const { data: user } = await admin.auth.admin.createUser({
      email: `recur-${ts}@example.com`,
      password: 'TestPass123!',
      email_confirm: true,
    })
    ctx.userId = user!.user!.id
    const { data: tenant } = await admin
      .from('tenants')
      .insert({ slug: `recur-${ts}`, name: 'Recur test' })
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

  it('persists recurring_rule and FK from slot works (ON DELETE SET NULL)', async () => {
    // Insert rule
    const { data: rule, error: ruleErr } = await admin
      .from('recurring_rules')
      .insert({
        tenant_id: ctx.tenantId!,
        member_id: ctx.memberId!,
        service_id: ctx.serviceId!,
        freq: 'weekly',
        interval_n: 1,
        by_weekday: [2, 4],
        start_date: '2026-09-01',
        start_time: '19:00:00',
        end_time: '21:00:00',
        end_condition: 'count',
        end_count: 4,
      })
      .select()
      .single()
    expect(ruleErr).toBeNull()
    ctx.ruleId = rule!.id

    // Insert a slot tied to this rule
    const { error: slotErr } = await admin.from('availability_slots').insert({
      tenant_id: ctx.tenantId!,
      member_id: ctx.memberId!,
      service_id: ctx.serviceId!,
      recurring_rule_id: rule!.id,
      start_at: '2026-09-01T11:00:00Z',
      end_at: '2026-09-01T13:00:00Z',
    })
    expect(slotErr).toBeNull()

    // Delete rule → slot should remain with recurring_rule_id = null
    await admin.from('recurring_rules').delete().eq('id', rule!.id)
    const { data: slot } = await admin
      .from('availability_slots')
      .select('recurring_rule_id')
      .eq('member_id', ctx.memberId!)
      .single()
    expect(slot?.recurring_rule_id).toBeNull()
  })

  it('rejects rule with invalid end_condition shape', async () => {
    // end_condition='count' without end_count should be rejected by CHECK constraint
    const { error } = await admin.from('recurring_rules').insert({
      tenant_id: ctx.tenantId!,
      member_id: ctx.memberId!,
      service_id: ctx.serviceId!,
      freq: 'daily',
      interval_n: 1,
      start_date: '2026-10-01',
      start_time: '09:00:00',
      end_time: '10:00:00',
      end_condition: 'count',
      end_count: null,
    })
    expect(error).not.toBeNull()
    // Either 23514 (check violation) or 23502 (not null) is acceptable
    expect(['23514', '23502']).toContain(error?.code)
  })

  it('computeOccurrences matches a real daily rule shape', () => {
    const occs = computeOccurrences(
      {
        freq: 'daily',
        interval_n: 1,
        by_weekday: null,
        by_month_day: null,
        start_date: '2026-09-01',
        start_time: '08:00:00',
        end_time: '09:00:00',
        end_condition: 'until',
        end_count: null,
        end_until: '2026-09-05',
      },
      new Date('2026-09-01T00:00:00+08:00'),
      new Date('2026-09-30T00:00:00+08:00'),
    )
    expect(occs).toHaveLength(5)
    expect(occs[0]!.startAt).toBe(new Date('2026-09-01T08:00:00+08:00').toISOString())
  })
})
