import { unstable_cache } from 'next/cache'
import { addDays, parseISO, startOfMonth, startOfWeek } from 'date-fns'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { publicSlotsTag } from '@/lib/cache-tags'
import { countSlotsByDay } from '@/lib/public-slots'
import type { Database } from '@/lib/supabase/types'

const QuerySchema = z.object({
  tenantId: z.string().uuid(),
  serviceId: z.string().uuid(),
  // Any date inside the month to summarise (yyyy-MM-dd).
  month: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

function getAnonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * Returns a map of `yyyy-MM-dd` → bookable-slot count for the calendar grid
 * (6 weeks) covering `month`. Days are bucketed by the UTC date of the slot's
 * start, identical to /api/public/slots, so the calendar's "has slots" flag
 * matches exactly what that endpoint returns when the day is selected.
 *
 * 透過資料庫函式 public_bookable_slots 查詢（與 /api/public/slots 同一支）：
 * 只算教練未停用、沒人預約或有人預約但未額滿、尚未開課的時段，人數由資料庫算好。
 * 查詢失敗直接 throw，由 GET 回 500，不回空的月曆。
 */
async function fetchSlotDays(tenantId: string, serviceId: string, month: string) {
  const gridStart = startOfWeek(startOfMonth(parseISO(month)), { weekStartsOn: 0 })
  const windowStart = gridStart.toISOString()
  const windowEnd = addDays(gridStart, 42).toISOString()

  const supabase = getAnonClient()
  const { data, error } = await supabase.rpc('public_bookable_slots', {
    p_tenant_id: tenantId,
    p_service_id: serviceId,
    p_from: windowStart,
    p_to: windowEnd,
  })
  if (error) throw new Error(error.message)
  if (!Array.isArray(data)) throw new Error('public_bookable_slots 沒有回傳資料')

  return countSlotsByDay(data)
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
