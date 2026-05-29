import { unstable_cache } from 'next/cache'
import { addDays, parseISO, startOfDay } from 'date-fns'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { publicSlotsTag } from '@/lib/cache-tags'

const QuerySchema = z.object({
  tenantId: z.string().uuid(),
  serviceId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
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

async function fetchSlots(tenantId: string, serviceId: string, date: string) {
  const supabase = getAnonClient()
  const dayStart = startOfDay(parseISO(date)).toISOString()
  const dayEnd = addDays(startOfDay(parseISO(date)), 1).toISOString()
  const { data, error } = await supabase
    .from('availability_slots')
    .select('id, start_at, end_at, services(max_capacity), bookings(status)')
    .eq('tenant_id', tenantId)
    .eq('service_id', serviceId)
    // 'pending' is included so group classes mid-fill stay bookable.
    .in('status', ['available', 'pending'])
    .gte('start_at', dayStart)
    .lt('start_at', dayEnd)
    .order('start_at')
  if (error) throw new Error(error.message)

  return (data ?? [])
    .map((s) => {
      const svc = s.services as ServiceRel
      const bookings = (s.bookings as BookingRel[] | null) ?? []
      const current = bookings.filter((b) => b.status !== 'cancelled').length
      const max = readMaxCapacity(svc)
      return {
        id: s.id,
        start_at: s.start_at,
        end_at: s.end_at,
        max_capacity: max,
        current_bookings: current,
      }
    })
    // Defensive: book_with_purchase now flips status to 'booked' at full so
    // the .in() above already excludes these, but a race between cancel and
    // re-fetch can briefly let a full row through. Filter anyway.
    .filter((s) => s.current_bookings < s.max_capacity)
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const parsed = QuerySchema.safeParse({
    tenantId: searchParams.get('tenantId'),
    serviceId: searchParams.get('serviceId'),
    date: searchParams.get('date'),
  })
  if (!parsed.success) {
    return Response.json({ error: 'invalid query' }, { status: 400 })
  }
  const { tenantId, serviceId, date } = parsed.data

  const cached = unstable_cache(
    () => fetchSlots(tenantId, serviceId, date),
    ['public-slots', tenantId, serviceId, date],
    { tags: [publicSlotsTag(tenantId)], revalidate: 60 },
  )

  try {
    const slots = await cached()
    return Response.json(
      { slots },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
      },
    )
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    )
  }
}
