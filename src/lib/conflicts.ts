import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import type { ConflictSlot } from '@/lib/errors'

/** Postgres exclusion_violation = 23P01 */
export function isExclusionViolation(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const code = (err as { code?: string }).code
  return code === '23P01'
}

/**
 * Given a tenant member and a desired time range, find the slots that conflict.
 * Used after an EXCLUDE constraint violation to build a friendly error.
 */
export async function findConflictingSlots(
  supabase: SupabaseClient<Database>,
  args: { memberId: string; startAt: string; endAt: string },
): Promise<ConflictSlot[]> {
  // Approximate overlap with start < otherEnd AND end > otherStart
  const { data } = await supabase
    .from('availability_slots')
    .select('id, start_at, end_at, status, services(name)')
    .eq('member_id', args.memberId)
    .lt('start_at', args.endAt)
    .gt('end_at', args.startAt)
    .neq('status', 'cancelled')
  return (data ?? []).map((row) => ({
    id: row.id,
    startAt: row.start_at,
    endAt: row.end_at,
    serviceName: (row.services as { name: string } | null)?.name ?? undefined,
    hasBooking: row.status === 'pending' || row.status === 'booked',
    bookingId: null, // filled in Plan 4 when bookings exist
  }))
}
