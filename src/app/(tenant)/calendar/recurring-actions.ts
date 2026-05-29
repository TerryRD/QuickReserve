'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { revalidateTag } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { actionClient } from '@/lib/safe-action'
import { requireTenantMember } from '@/lib/auth/get-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AppError } from '@/lib/errors'
import type { ConflictSlot } from '@/lib/errors'
import { computeOccurrences, type RecurringRuleInput, type Occurrence } from '@/lib/recurrence'
import { publicSlotsTag } from '@/lib/cache-tags'
import { fetchActiveTemplate, fetchUnavailableEvents } from '@/lib/availability-server'
import { effectiveAvailability } from '@/lib/availability'
import type { Database } from '@/lib/supabase/types'

const MATERIALIZE_DAYS = 90

const FreqEnum = z.enum(['daily', 'weekly', 'monthly', 'every_n_days'])
const EndConditionEnum = z.enum(['count', 'until', 'none'])

const CreateRecurringRuleSchema = z
  .object({
    serviceId: z.string().uuid(),
    freq: FreqEnum,
    intervalN: z.coerce.number().int().positive().max(365).default(1),
    byWeekday: z.array(z.number().int().min(1).max(7)).optional().nullable(),
    byMonthDay: z.coerce.number().int().min(1).max(31).optional().nullable(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD'),
    startTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
    endTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
    endCondition: EndConditionEnum,
    endCount: z.coerce.number().int().positive().nullable().optional(),
    endUntil: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional(),
    skipConflicts: z.boolean().default(false),
  })
  .refine((v) => v.freq !== 'weekly' || (v.byWeekday && v.byWeekday.length > 0), {
    message: '每週需選擇至少一個星期幾',
    path: ['byWeekday'],
  })
  .refine((v) => v.freq !== 'monthly' || v.byMonthDay, {
    message: '每月需指定日期',
    path: ['byMonthDay'],
  })
  .refine((v) => v.endCondition !== 'count' || (v.endCount && v.endCount > 0), {
    message: '請填寫次數',
    path: ['endCount'],
  })
  .refine((v) => v.endCondition !== 'until' || v.endUntil, {
    message: '請填寫截止日期',
    path: ['endUntil'],
  })

// Preview-only schema mirrors Create minus the skipConflicts flag (preview
// never writes, so the decision is irrelevant). Refine guards are looser:
// while the user is typing we don't want to surface "請填寫次數" toasts.
const PreviewRecurringRuleSchema = z.object({
  serviceId: z.string().uuid(),
  freq: FreqEnum,
  intervalN: z.coerce.number().int().positive().max(365).default(1),
  byWeekday: z.array(z.number().int().min(1).max(7)).optional().nullable(),
  byMonthDay: z.coerce.number().int().min(1).max(31).optional().nullable(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD'),
  startTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  endTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  endCondition: EndConditionEnum,
  endCount: z.coerce.number().int().positive().nullable().optional(),
  endUntil: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
})

type ParsedRuleInput = z.infer<typeof PreviewRecurringRuleSchema>

type PreviewBreakdown = {
  occurrences: Occurrence[]
  toInsert: Occurrence[]
  availabilityFiltered: Occurrence[]
  conflicts: ConflictSlot[]
  skippedAvailability: number
}

// Shared between create + preview: computes the occurrence set, classifies
// each against existing slots (conflict) and the active availability template
// (skipped). Throws AppError on service-not-found; returns zero-length arrays
// on empty rule (preview should treat that as "no time yet" not an error).
async function computeRulePreview(
  supabase: SupabaseClient<Database>,
  session: { tenantId: string; memberId: string },
  input: ParsedRuleInput,
): Promise<PreviewBreakdown> {
  // 1. Verify the service belongs to this tenant
  const { data: svc } = await supabase
    .from('services')
    .select('id, tenant_id')
    .eq('id', input.serviceId)
    .maybeSingle()
  if (!svc || svc.tenant_id !== session.tenantId) {
    throw new AppError('SERVICE_NOT_FOUND', '服務不存在')
  }

  // 2. Compute occurrences in the 90-day materialization window
  const startDate = new Date(`${input.startDate}T00:00:00+08:00`)
  const windowEnd = new Date(startDate.getTime() + MATERIALIZE_DAYS * 24 * 3600 * 1000)
  const ruleInput: RecurringRuleInput = {
    freq: input.freq,
    interval_n: input.intervalN,
    by_weekday: input.byWeekday ?? null,
    by_month_day: input.byMonthDay ?? null,
    start_date: input.startDate,
    start_time: input.startTime,
    end_time: input.endTime,
    end_condition: input.endCondition,
    end_count: input.endCount ?? null,
    end_until: input.endUntil ?? null,
  }
  const occurrences = computeOccurrences(ruleInput, startDate, windowEnd)
  if (occurrences.length === 0) {
    return {
      occurrences: [],
      toInsert: [],
      availabilityFiltered: [],
      conflicts: [],
      skippedAvailability: 0,
    }
  }

  // 3. Existing non-cancelled slots overlapping our range
  const firstStart = occurrences[0]!.startAt
  const lastEnd = occurrences[occurrences.length - 1]!.endAt
  const { data: existing } = await supabase
    .from('availability_slots')
    .select('id, start_at, end_at, services(name)')
    .eq('member_id', session.memberId)
    .gte('end_at', firstStart)
    .lte('start_at', lastEnd)
    .neq('status', 'cancelled')

  // 4. Split occurrences into conflicts vs to-insert
  const conflicts: ConflictSlot[] = []
  const toInsert: Occurrence[] = []
  for (const occ of occurrences) {
    const hit = (existing ?? []).find((e) => e.start_at < occ.endAt && e.end_at > occ.startAt)
    if (hit) {
      conflicts.push({
        id: hit.id,
        startAt: hit.start_at,
        endAt: hit.end_at,
        serviceName: (hit.services as { name: string } | null)?.name ?? undefined,
        hasBooking: false,
        bookingId: null,
      })
    } else {
      toInsert.push(occ)
    }
  }

  // 5. Filter occurrences against the active availability template
  const template = await fetchActiveTemplate(supabase, session.memberId, startDate)
  let availabilityFiltered: Occurrence[] = toInsert
  let skippedAvailability = 0
  if (template !== null && toInsert.length > 0) {
    const events = await fetchUnavailableEvents(
      supabase,
      session.memberId,
      new Date(toInsert[0]!.startAt),
      new Date(toInsert[toInsert.length - 1]!.endAt),
    )
    const passed: Occurrence[] = []
    for (const occ of toInsert) {
      const start = new Date(occ.startAt)
      const end = new Date(occ.endAt)
      const dayRanges = effectiveAvailability({
        date: start,
        activeTemplate: template,
        unavailableEvents: events,
        tzOffsetHours: 8,
      })
      if (dayRanges.some((r) => r.start <= start && r.end >= end)) {
        passed.push(occ)
      } else {
        skippedAvailability++
      }
    }
    availabilityFiltered = passed
  }

  return { occurrences, toInsert, availabilityFiltered, conflicts, skippedAvailability }
}

type CreateResult = {
  ruleId: string | null
  created: number
  skipped: number
  skippedAvailability: number
  conflicts: ConflictSlot[]
}

export const createRecurringRuleAction = actionClient
  .inputSchema(CreateRecurringRuleSchema)
  .action(async ({ parsedInput }): Promise<CreateResult> => {
    const session = await requireTenantMember()
    const supabase = await createSupabaseServerClient()

    const preview = await computeRulePreview(supabase, session, parsedInput)
    if (preview.occurrences.length === 0) {
      throw new AppError('NO_OCCURRENCES', '此規則在 90 天視窗內沒有任何時段')
    }

    // Return conflicts without writing anything if user hasn't opted into skip
    if (preview.conflicts.length > 0 && !parsedInput.skipConflicts) {
      return {
        ruleId: null,
        created: 0,
        skipped: 0,
        skippedAvailability: 0,
        conflicts: preview.conflicts,
      }
    }

    // Insert the rule
    const { data: rule, error: ruleErr } = await supabase
      .from('recurring_rules')
      .insert({
        tenant_id: session.tenantId,
        member_id: session.memberId,
        service_id: parsedInput.serviceId,
        freq: parsedInput.freq,
        interval_n: parsedInput.intervalN,
        by_weekday: parsedInput.byWeekday ?? null,
        by_month_day: parsedInput.byMonthDay ?? null,
        start_date: parsedInput.startDate,
        start_time: parsedInput.startTime,
        end_time: parsedInput.endTime,
        end_condition: parsedInput.endCondition,
        end_count: parsedInput.endCount ?? null,
        end_until: parsedInput.endUntil ?? null,
      })
      .select('id')
      .single()
    if (ruleErr || !rule) {
      throw new AppError('RULE_CREATE_FAILED', ruleErr?.message ?? '建立規則失敗')
    }

    // Batch insert the non-conflicting, in-availability slots
    if (preview.availabilityFiltered.length > 0) {
      const rows = preview.availabilityFiltered.map((o) => ({
        tenant_id: session.tenantId,
        member_id: session.memberId,
        service_id: parsedInput.serviceId,
        recurring_rule_id: rule.id,
        start_at: o.startAt,
        end_at: o.endAt,
        status: 'available' as const,
      }))
      const { error: insertErr } = await supabase.from('availability_slots').insert(rows)
      if (insertErr) {
        // Roll back the rule
        await supabase.from('recurring_rules').delete().eq('id', rule.id)
        throw new AppError('SLOTS_BATCH_INSERT_FAILED', insertErr.message)
      }
    }

    revalidatePath('/calendar')
    revalidateTag(publicSlotsTag(session.tenantId))
    return {
      ruleId: rule.id,
      created: preview.availabilityFiltered.length,
      skipped: preview.conflicts.length,
      skippedAvailability: preview.skippedAvailability,
      conflicts: parsedInput.skipConflicts ? preview.conflicts : [],
    }
  })

// Live preview action — same compute as create, but returns counts only.
// Called from the dialog with debounce as the user fills the form.
type PreviewResult = {
  occurrencesCount: number
  conflictsCount: number
  availabilitySkippedCount: number
}

export const previewRecurringRuleAction = actionClient
  .inputSchema(PreviewRecurringRuleSchema)
  .action(async ({ parsedInput }): Promise<PreviewResult> => {
    const session = await requireTenantMember()
    const supabase = await createSupabaseServerClient()

    const preview = await computeRulePreview(supabase, session, parsedInput)
    return {
      occurrencesCount: preview.occurrences.length,
      conflictsCount: preview.conflicts.length,
      availabilitySkippedCount: preview.skippedAvailability,
    }
  })
