import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { effectiveAvailability, type Range, type TemplateWindow } from './availability'
import type { Database } from './supabase/types'

const TZ_OFFSET_HOURS = 8

type Client = SupabaseClient<Database>

export async function fetchActiveTemplate(
  supabase: Client,
  memberId: string,
  asOf: Date,
): Promise<{ windows: TemplateWindow[] } | null> {
  const asOfDate = new Date(asOf.getTime() + TZ_OFFSET_HOURS * 3600 * 1000)
    .toISOString()
    .slice(0, 10)

  const { data: assignment, error: aErr } = await supabase
    .from('availability_template_assignments')
    .select('template_id')
    .eq('member_id', memberId)
    .lte('effective_from', asOfDate)
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (aErr) throw aErr

  if (!assignment) return null

  const { data: windows, error: wErr } = await supabase
    .from('availability_template_windows')
    .select('weekday, start_time, end_time')
    .eq('template_id', assignment.template_id)
  if (wErr) throw wErr

  return { windows: (windows ?? []) as TemplateWindow[] }
}

export async function fetchUnavailableEvents(
  supabase: Client,
  memberId: string,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<Range[]> {
  const { data, error } = await supabase
    .from('unavailable_events')
    .select('start_at, end_at')
    .eq('member_id', memberId)
    .lt('start_at', rangeEnd.toISOString())
    .gt('end_at', rangeStart.toISOString())
  if (error) throw error

  return (data ?? []).map((e) => ({
    start: new Date(e.start_at),
    end: new Date(e.end_at),
  }))
}

/**
 * Returns true if [startAt, endAt] is fully covered by an active-template
 * window AND does not overlap any unavailable_event. Null template = no
 * constraint = always true.
 */
export async function validateInEffectiveRange(
  supabase: Client,
  memberId: string,
  startAt: Date,
  endAt: Date,
): Promise<boolean> {
  const template = await fetchActiveTemplate(supabase, memberId, startAt)
  if (!template) return true // unconstrained

  const events = await fetchUnavailableEvents(supabase, memberId, startAt, endAt)
  const effective = effectiveAvailability({
    date: startAt,
    activeTemplate: template,
    unavailableEvents: events,
    tzOffsetHours: TZ_OFFSET_HOURS,
  })

  // The slot must be FULLY contained in at least one effective range
  return effective.some((r) => r.start <= startAt && r.end >= endAt)
}
