import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { computeOccurrences, type RecurringRuleInput } from '@/lib/recurrence'
import { isExclusionViolation } from '@/lib/conflicts'
import { publicSlotsTag } from '@/lib/cache-tags'

const MATERIALIZE_DAYS = 90

/**
 * Vercel Cron entrypoint. Runs daily 00:30 UTC+8 (16:30 UTC).
 *
 * For each active recurring rule, ensure all occurrences in the rolling
 * [today, today+90] window are materialized into availability_slots.
 * Conflicts (with other slots) are silently skipped.
 */
export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const admin = createSupabaseAdminClient()
  const now = new Date()
  const windowStart = now
  const windowEnd = new Date(now.getTime() + MATERIALIZE_DAYS * 24 * 3600 * 1000)

  const { data: rules, error } = await admin
    .from('recurring_rules')
    .select(
      'id, tenant_id, member_id, service_id, freq, interval_n, by_weekday, by_month_day, start_date, start_time, end_time, end_condition, end_count, end_until',
    )
    .eq('is_active', true)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let totalCreated = 0
  let totalSkipped = 0
  let totalConsidered = 0
  const affectedTenants = new Set<string>()

  for (const rule of rules ?? []) {
    const ruleInput: RecurringRuleInput = {
      freq: rule.freq as RecurringRuleInput['freq'],
      interval_n: rule.interval_n,
      by_weekday: rule.by_weekday,
      by_month_day: rule.by_month_day,
      start_date: rule.start_date,
      start_time: rule.start_time,
      end_time: rule.end_time,
      end_condition: rule.end_condition as RecurringRuleInput['end_condition'],
      end_count: rule.end_count,
      end_until: rule.end_until,
    }

    const occurrences = computeOccurrences(ruleInput, windowStart, windowEnd)
    totalConsidered += occurrences.length
    if (occurrences.length === 0) continue

    // Existing slots from THIS rule in the window
    const { data: existing } = await admin
      .from('availability_slots')
      .select('start_at')
      .eq('recurring_rule_id', rule.id)
      .gte('start_at', windowStart.toISOString())
      .lte('start_at', windowEnd.toISOString())
    const existingSet = new Set((existing ?? []).map((e) => e.start_at))

    const toTry = occurrences.filter((o) => !existingSet.has(o.startAt))
    if (toTry.length === 0) continue

    // Insert one at a time; silently skip slot conflicts (overlap with other slots)
    for (const occ of toTry) {
      const { error: insertErr } = await admin.from('availability_slots').insert({
        tenant_id: rule.tenant_id,
        member_id: rule.member_id,
        service_id: rule.service_id,
        recurring_rule_id: rule.id,
        start_at: occ.startAt,
        end_at: occ.endAt,
        status: 'available' as const,
      })
      if (insertErr) {
        if (isExclusionViolation(insertErr)) {
          totalSkipped++
        } else {
          console.error('[cron/materialize-recurring]', insertErr.message, { ruleId: rule.id })
        }
      } else {
        totalCreated++
        affectedTenants.add(rule.tenant_id)
      }
    }
  }

  for (const tenantId of affectedTenants) {
    revalidateTag(publicSlotsTag(tenantId))
  }

  return NextResponse.json({
    rules: rules?.length ?? 0,
    considered: totalConsidered,
    created: totalCreated,
    skipped: totalSkipped,
    timestamp: now.toISOString(),
  })
}
