import { unstable_cache } from 'next/cache'
import { addDays, parseISO, startOfMonth, startOfWeek } from 'date-fns'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { publicSlotsTag } from '@/lib/cache-tags'

const QuerySchema = z.object({
  tenantId: z.string().uuid(),
  serviceId: z.string().uuid(),
  // Any date inside the month to summarise (yyyy-MM-dd).
  month: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

function getAnonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

type ServiceRel = { max_capacity: number } | { max_capacity: number }[] | null
type BookingRel = { status: string }

function readMaxCapacity(rel: ServiceRel): number {
  if (!rel) return 1
  if (Array.isArray(rel)) return rel[0]?.max_capacity ?? 1
  return rel.max_capacity
}

/**
 * Returns a map of `yyyy-MM-dd` → bookable-slot count for the calendar grid
 * (6 weeks) covering `month`. Days are bucketed by the UTC date of the slot's
 * start, identical to /api/public/slots, so the calendar's "has slots" flag
 * matches exactly what that endpoint returns when the day is selected.
 */
async function fetchSlotDays(tenantId: string, serviceId: string, month: string) {
  const gridStart = startOfWeek(startOfMonth(parseISO(month)), { weekStartsOn: 0 })
  const windowStart = gridStart.toISOString()
  const windowEnd = addDays(gridStart, 42).toISOString()

  const supabase = getAnonClient()
  const { data, error } = await supabase
    .from('availability_slots')
    .select('start_at, services(max_capacity), bookings(status)')
    .eq('tenant_id', tenantId)
    .eq('service_id', serviceId)
    // 'pending' included so group classes mid-fill stay bookable (matches /slots).
    .in('status', ['available', 'pending'])
    .gte('start_at', windowStart)
    .lt('start_at', windowEnd)
  if (error) throw new Error(error.message)

  const counts: Record<string, number> = {}
  for (const s of data ?? []) {
    const svc = s.services as ServiceRel
    const bookings = (s.bookings as BookingRel[] | null) ?? []
    const current = bookings.filter((b) => b.status !== 'cancelled').length
    if (current >= readMaxCapacity(svc)) continue
    const dayKey = (s.start_at as string).slice(0, 10)
    counts[dayKey] = (counts[dayKey] ?? 0) + 1
  }
  return counts
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const parsed = QuerySchema.safeParse({
    tenantId: searchParams.get('tenantId'),
    serviceId: searchParams.get('serviceId'),
    month: searchParams.get('month'),
  })
  if (!parsed.success) {
    return Response.json({ error: 'invalid query' }, { status: 400 })
  }
  const { tenantId, serviceId, month } = parsed.data

  const cached = unstable_cache(
    () => fetchSlotDays(tenantId, serviceId, month),
    ['public-slot-days', tenantId, serviceId, month],
    { tags: [publicSlotsTag(tenantId)], revalidate: 60 },
  )

  try {
    const days = await cached()
    return Response.json(
      { days },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
      },
    )
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'unknown' }, { status: 500 })
  }
}
