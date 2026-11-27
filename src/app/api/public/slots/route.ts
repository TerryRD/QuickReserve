import { unstable_cache } from 'next/cache'
import { addDays, parseISO, startOfDay } from 'date-fns'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { publicSlotsTag } from '@/lib/cache-tags'
import { toPublicSlots } from '@/lib/public-slots'
import type { Database } from '@/lib/supabase/types'

const QuerySchema = z.object({
  tenantId: z.string().uuid(),
  serviceId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

function getAnonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * 某一天還能預約的時段。透過資料庫函式 public_bookable_slots 查詢：
 * 只回傳教練未停用、狀態為沒人預約或有人預約但未額滿、尚未開課的時段，
 * 已佔名額由資料庫算好（未登入也算得到正確人數），這裡只負責轉成前端的形狀。
 * 查詢失敗直接 throw，由 GET 回 500，不回空清單。
 */
async function fetchSlots(tenantId: string, serviceId: string, date: string) {
  const supabase = getAnonClient()
  const dayStart = startOfDay(parseISO(date)).toISOString()
  const dayEnd = addDays(startOfDay(parseISO(date)), 1).toISOString()
  const { data, error } = await supabase.rpc('public_bookable_slots', {
    p_tenant_id: tenantId,
    p_service_id: serviceId,
    p_from: dayStart,
    p_to: dayEnd,
  })
  if (error) throw new Error(error.message)
  if (!Array.isArray(data)) throw new Error('public_bookable_slots 沒有回傳資料')

  return toPublicSlots(data)
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
    return Response.json({ error: err instanceof Error ? err.message : 'unknown' }, { status: 500 })
  }
}
