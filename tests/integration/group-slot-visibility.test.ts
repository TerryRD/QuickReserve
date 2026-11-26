// @vitest-environment node
// 團班時段能見度：有人預約後（時段狀態 available → pending），其他學員與未登入訪客還看得到嗎？人數算得對嗎？
//
// 疑似問題：
//   1. availability_slots 的讀取規則（slots_select）只讓非成員讀到 status='available' 的時段（或自己有預約的時段），
//      團班第一位學員預約後時段變 pending，其他學員與未登入訪客就讀不到。
//   2. bookings 的讀取規則不給 anon、學員只讀得到自己的預約，所以公開頁（src/app/api/public/slots/route.ts）
//      用 embed 的 bookings(status) 算出來的人數不對。
//
// 測試寫的是「期望的正確行為」，問題成立時會紅；紅是預期的，重點是印出來的實際值。
// 所有資料庫操作與觀察都在 beforeAll 內依序做完並存進 observations，各個 it 只對 observations 斷言，
// 這樣前面的 it 紅了，後面的值照樣拿得到。beforeAll 最後印出 [GSV-OBSERVATIONS]。
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import {
  admin,
  book,
  makeCustomer,
  makePurchase,
  makeSlot,
  setupBfv2,
  teardownBfv2,
  uniqueOffset,
  type Bfv2Ctx,
} from './helpers/bfv2-fixture'

const WEEK_MIN = 7 * 24 * 60

type DbClient = SupabaseClient<Database>

// 與 route.ts 相同的 embed 讀法
type ServiceRel = { max_capacity: number } | { max_capacity: number }[] | null
type BookingRel = { status: string }

function readMaxCapacity(rel: ServiceRel): number {
  if (!rel) return 1
  if (Array.isArray(rel)) return rel[0]?.max_capacity ?? 1
  return rel.max_capacity
}

type QueryError = { message: string; code: string } | null

function toErr(e: { message: string; code?: string } | null): QueryError {
  return e ? { message: e.message, code: e.code ?? '' } : null
}

type Observation = {
  /** 模仿預約確認頁 src/app/book/[slotId]/page.tsx：讀不到 → 404 */
  slotById: { found: boolean; status: string | null; error: QueryError }
  /** 模仿公開頁清單 src/app/api/public/slots/route.ts */
  publicList: {
    listed: boolean
    currentBookings: number | null
    maxCapacity: number | null
    listedAfterFullFilter: boolean
    error: QueryError
  }
  /** 直接讀這個時段的預約 */
  bookingsOnSlot: { count: number | null; error: QueryError }
}

type Truth = { slotStatus: string | null; activeBookings: number | null; error: QueryError }

type BookAttempt = { ok: boolean; errorMessage: string | null; errorCode: string | null }

type PhaseObs = { anon: Observation; other: Observation; customer: Observation }

type Observations = {
  slotId: string
  phase0: PhaseObs
  phase1: PhaseObs & { truth: Truth }
  otherBook: BookAttempt
  phase2: PhaseObs & { truth: Truth }
  thirdBook: BookAttempt
  phase3: PhaseObs & { truth: Truth }
}

let ctx: Bfv2Ctx
const observations: Partial<Observations> = {}

async function observe(client: DbClient, slotId: string): Promise<Observation> {
  // 1. 預約確認頁：用登入者（或訪客）身分以 id 讀時段
  const byId = await client
    .from('availability_slots')
    .select('id, status')
    .eq('id', slotId)
    .maybeSingle()
  const slotById = {
    found: !!byId.data,
    status: byId.data?.status ?? null,
    error: toErr(byId.error),
  }

  // 2. 公開頁清單：同 route.ts 的查詢，再以 id 縮小範圍
  const list = await client
    .from('availability_slots')
    .select('id, start_at, end_at, services(max_capacity), bookings(status)')
    .eq('tenant_id', ctx.tenantId)
    .eq('service_id', ctx.groupServiceId)
    .in('status', ['available', 'pending'])
    .eq('id', slotId)
  let publicList: Observation['publicList']
  if (list.error) {
    publicList = {
      listed: false,
      currentBookings: null,
      maxCapacity: null,
      listedAfterFullFilter: false,
      error: toErr(list.error),
    }
  } else {
    const row = (list.data ?? []).find((s) => s.id === slotId)
    if (!row) {
      publicList = {
        listed: false,
        currentBookings: null,
        maxCapacity: null,
        listedAfterFullFilter: false,
        error: null,
      }
    } else {
      const bookings = (row.bookings as unknown as BookingRel[] | null) ?? []
      const current = bookings.filter((b) => b.status !== 'cancelled').length
      const max = readMaxCapacity(row.services as unknown as ServiceRel)
      publicList = {
        listed: true,
        currentBookings: current,
        maxCapacity: max,
        listedAfterFullFilter: current < max,
        error: null,
      }
    }
  }

  // 3. 直接讀這個時段的預約
  const bk = await client.from('bookings').select('id, status').eq('slot_id', slotId)
  const bookingsOnSlot = {
    count: bk.error ? null : (bk.data ?? []).length,
    error: toErr(bk.error),
  }

  return { slotById, publicList, bookingsOnSlot }
}

/** 用 service role 讀真實值：時段狀態與未取消的預約筆數 */
async function truth(slotId: string): Promise<Truth> {
  const slot = await admin.from('availability_slots').select('status').eq('id', slotId).single()
  const bk = await admin
    .from('bookings')
    .select('id')
    .eq('slot_id', slotId)
    .neq('status', 'cancelled')
  return {
    slotStatus: slot.data?.status ?? null,
    activeBookings: bk.error ? null : (bk.data ?? []).length,
    error: toErr(slot.error ?? bk.error),
  }
}

/** 直接呼叫 book_with_purchase，不 throw，把結果記下來 */
async function tryBook(
  client: DbClient,
  o: { slotId: string; customerId: string; purchaseId: string },
): Promise<BookAttempt> {
  const { error } = await client.rpc('book_with_purchase', {
    p_slot_id: o.slotId,
    p_customer_id: o.customerId,
    p_purchase_id: o.purchaseId,
  })
  return { ok: !error, errorMessage: error?.message ?? null, errorCode: error?.code ?? null }
}

async function observeAll(anon: DbClient, slotId: string): Promise<PhaseObs> {
  return {
    anon: await observe(anon, slotId),
    other: await observe(ctx.otherCustomer.client, slotId),
    customer: await observe(ctx.customer.client, slotId),
  }
}

describe('團班時段能見度：有人預約後其他學員與訪客是否看得到、人數是否正確', () => {
  beforeAll(async () => {
    ctx = await setupBfv2('gsv')
    try {
      const anon = createClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } },
      )

      const custPurchase = await makePurchase(ctx, {
        customerId: ctx.customer.userId,
        serviceId: ctx.groupServiceId,
      })
      const otherPurchase = await makePurchase(ctx, {
        customerId: ctx.otherCustomer.userId,
        serviceId: ctx.groupServiceId,
      })
      const third = await makeCustomer(ctx, 'third')
      const thirdPurchase = await makePurchase(ctx, {
        customerId: third.userId,
        serviceId: ctx.groupServiceId,
      })
      const slotId = await makeSlot(ctx, {
        memberId: ctx.owner.memberId,
        serviceId: ctx.groupServiceId,
        startOffsetMin: uniqueOffset(WEEK_MIN),
      })
      observations.slotId = slotId

      // phase0：沒人預約
      observations.phase0 = await observeAll(anon, slotId)

      // phase1：學員甲預約（1/3）
      await book(ctx.customer.client, {
        slotId,
        customerId: ctx.customer.userId,
        purchaseId: custPurchase,
      })
      observations.phase1 = { ...(await observeAll(anon, slotId)), truth: await truth(slotId) }

      // phase2：學員乙嘗試預約（2/3）
      observations.otherBook = await tryBook(ctx.otherCustomer.client, {
        slotId,
        customerId: ctx.otherCustomer.userId,
        purchaseId: otherPurchase,
      })
      observations.phase2 = { ...(await observeAll(anon, slotId)), truth: await truth(slotId) }

      // phase3：學員丙嘗試預約（3/3 額滿）
      observations.thirdBook = await tryBook(third.client, {
        slotId,
        customerId: third.userId,
        purchaseId: thirdPurchase,
      })
      observations.phase3 = { ...(await observeAll(anon, slotId)), truth: await truth(slotId) }
    } finally {
      console.log('[GSV-OBSERVATIONS] ' + JSON.stringify(observations, null, 2))
    }
  }, 120_000)

  afterAll(async () => {
    await teardownBfv2(ctx)
  }, 120_000)

  /** 取出某階段的觀察值；beforeAll 中途失敗時該階段不存在，直接讓測試失敗 */
  function obs<K extends keyof Observations>(key: K): Observations[K] {
    const v = observations[key]
    if (v === undefined) throw new Error(`沒有 ${String(key)} 的觀察值（前面的步驟失敗了）`)
    return v as Observations[K]
  }

  describe('沒人預約時（基準）', () => {
    it('未登入、乙、甲都讀得到時段，公開清單列出且人數 0', () => {
      const p = obs('phase0')
      for (const o of [p.anon, p.other, p.customer]) {
        expect(o.slotById.found).toBe(true)
        expect(o.publicList.listed).toBe(true)
        expect(o.publicList.currentBookings).toBe(0)
      }
    })
  })

  describe('甲預約後（1/3）', () => {
    it('前提：資料庫實際的時段狀態是待確認、有效預約 1 筆', () => {
      expect(obs('phase1').truth).toMatchObject({ slotStatus: 'pending', activeBookings: 1 })
    })

    it('未登入：公開清單仍列出這個時段', () => {
      expect(obs('phase1').anon.publicList.listed).toBe(true)
    })

    it('未登入：公開清單人數顯示 1', () => {
      expect(obs('phase1').anon.publicList.currentBookings).toBe(1)
    })

    it('乙：預約確認頁讀得到這個時段', () => {
      expect(obs('phase1').other.slotById.found).toBe(true)
    })

    it('乙：公開清單列出這個時段且人數 1', () => {
      const pl = obs('phase1').other.publicList
      expect(pl.listed).toBe(true)
      expect(pl.currentBookings).toBe(1)
    })

    it('甲：讀得到自己預約的時段', () => {
      expect(obs('phase1').customer.slotById.found).toBe(true)
    })

    it('甲：看到的人數是 1', () => {
      expect(obs('phase1').customer.publicList.currentBookings).toBe(1)
    })
  })

  describe('乙預約', () => {
    it('乙可以預約成功', () => {
      expect(obs('otherBook').ok).toBe(true)
    })
  })

  describe('乙預約後（2/3）', () => {
    it('未登入：公開清單仍列出這個時段，人數顯示 2', () => {
      const pl = obs('phase2').anon.publicList
      expect(pl.listed).toBe(true)
      expect(pl.currentBookings).toBe(2)
    })

    it('甲：看到的人數是 2', () => {
      expect(obs('phase2').customer.publicList.currentBookings).toBe(2)
    })
  })

  describe('丙預約後（3/3 額滿）', () => {
    it('丙預約成功，資料庫實際的時段狀態是已額滿、有效預約 3 筆', () => {
      expect(obs('thirdBook').ok).toBe(true)
      expect(obs('phase3').truth).toMatchObject({ slotStatus: 'booked', activeBookings: 3 })
    })

    it('未登入：額滿後公開清單不再列出這個時段', () => {
      expect(obs('phase3').anon.publicList.listedAfterFullFilter).toBe(false)
    })
  })
})
