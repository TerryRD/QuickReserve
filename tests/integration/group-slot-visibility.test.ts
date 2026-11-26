// @vitest-environment node
// 團班時段可見性（回歸測試）：團班有人預約後（時段狀態 available → pending），
// 未登入訪客與其他學員仍看得到這個時段、人數正確，第二位以後的學員也開得了預約確認頁並約得進去。
//
// 對應修正：
//   supabase/migrations/20261126110000_group_slot_visibility_functions.sql
//     slot_taken_count（時段已佔名額）、public_bookable_slots（公開頁查詢）
//   supabase/migrations/20261126110100_group_slot_visibility_policy.sql
//     時段讀取規則：非成員也讀得到 pending 的時段
// 注意：這支在上面兩個 migration 執行到資料庫之前會紅（函式不存在、規則未放寬）。
//
// 登入次數有上限：只用 setupBfv2 內建的帳號與學員丙；「另一個租戶」的 Owner 只建帳號、不登入。
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import {
  admin,
  book,
  makeCustomer,
  makePurchase,
  makeService,
  makeSlot,
  makeTenant,
  makeUser,
  setupBfv2,
  teardownBfv2,
  uniqueOffset,
  type Bfv2Ctx,
} from './helpers/bfv2-fixture'

const MIN = 60_000
const DAY_MIN = 24 * 60
const WEEK_MIN = 7 * DAY_MIN

type DbClient = SupabaseClient<Database>
type BookableRow = Database['public']['Functions']['public_bookable_slots']['Returns'][number]

let ctx: Bfv2Ctx
let anon: DbClient
let third: { userId: string; client: DbClient }
let custGroupPurchase: string
let otherGroupPurchase: string
let thirdGroupPurchase: string
let custSoloPurchase: string
let otherSoloPurchase: string

/**
 * 用 public_bookable_slots 查某服務在「現在 ±30 天」內還能預約的時段，回傳指定時段那一列（沒有就 null）。
 * 查詢失敗直接 throw。
 */
async function findBookable(
  client: DbClient,
  o: { slotId: string; serviceId: string; tenantId?: string },
): Promise<BookableRow | null> {
  const now = Date.now()
  const { data, error } = await client.rpc('public_bookable_slots', {
    p_tenant_id: o.tenantId ?? ctx.tenantId,
    p_service_id: o.serviceId,
    p_from: new Date(now - 30 * DAY_MIN * MIN).toISOString(),
    p_to: new Date(now + 30 * DAY_MIN * MIN).toISOString(),
  })
  if (error) throw new Error(`public_bookable_slots: ${error.message}`)
  return data.find((r) => r.id === o.slotId) ?? null
}

/** slot_taken_count；查詢失敗直接 throw */
async function takenCount(client: DbClient, slotId: string): Promise<number> {
  const { data, error } = await client.rpc('slot_taken_count', { p_slot_id: slotId })
  if (error) throw new Error(`slot_taken_count: ${error.message}`)
  return data
}

/** 模仿預約確認頁 src/app/book/[slotId]/page.tsx：以登入者（或訪客）身分用 id 讀時段 */
async function readSlotAs(client: DbClient, slotId: string) {
  const { data, error } = await client
    .from('availability_slots')
    .select('id, status')
    .eq('id', slotId)
    .maybeSingle()
  if (error) throw new Error(`讀時段: ${error.message}`)
  return data
}

/** 用 service role 讀時段實際狀態 */
async function slotStatus(slotId: string): Promise<string> {
  const { data, error } = await admin
    .from('availability_slots')
    .select('status')
    .eq('id', slotId)
    .single()
  if (error) throw new Error(`slotStatus: ${error.message}`)
  return data.status
}

/** 用 service role 數時段的有效（未取消）預約筆數 */
async function activeBookingCount(slotId: string): Promise<number> {
  const { data, error } = await admin
    .from('bookings')
    .select('id')
    .eq('slot_id', slotId)
    .neq('status', 'cancelled')
  if (error) throw new Error(`activeBookingCount: ${error.message}`)
  return data.length
}

function groupSlot() {
  return makeSlot(ctx, {
    memberId: ctx.owner.memberId,
    serviceId: ctx.groupServiceId,
    startOffsetMin: uniqueOffset(WEEK_MIN),
  })
}

describe('團班時段可見性：有人預約後其他學員與訪客看得到、人數正確', () => {
  beforeAll(async () => {
    ctx = await setupBfv2('gsv')
    anon = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
    third = await makeCustomer(ctx, 'third')

    custGroupPurchase = await makePurchase(ctx, {
      customerId: ctx.customer.userId,
      serviceId: ctx.groupServiceId,
    })
    otherGroupPurchase = await makePurchase(ctx, {
      customerId: ctx.otherCustomer.userId,
      serviceId: ctx.groupServiceId,
    })
    thirdGroupPurchase = await makePurchase(ctx, {
      customerId: third.userId,
      serviceId: ctx.groupServiceId,
    })
    custSoloPurchase = await makePurchase(ctx, {
      customerId: ctx.customer.userId,
      serviceId: ctx.soloServiceId,
    })
    otherSoloPurchase = await makePurchase(ctx, {
      customerId: ctx.otherCustomer.userId,
      serviceId: ctx.soloServiceId,
    })
  }, 120_000)

  afterAll(async () => {
    await teardownBfv2(ctx)
  }, 120_000)

  describe('沒人預約的團班時段（基準）', () => {
    let slotId: string
    beforeAll(async () => {
      slotId = await groupSlot()
    }, 120_000)

    it('未登入查得到，已佔名額 0、名額上限 3', async () => {
      const row = await findBookable(anon, { slotId, serviceId: ctx.groupServiceId })
      expect(row).toMatchObject({ id: slotId, taken: 0, max_capacity: 3 })
    })
  })

  // 案例 1～4、7 共用同一個團班時段，依序推進：甲預約 → 乙預約 → 丙預約（額滿）
  describe('同一個團班時段從 1 人到額滿', () => {
    let slotId: string
    beforeAll(async () => {
      slotId = await groupSlot()
    }, 120_000)

    describe('甲預約後（1/3）', () => {
      beforeAll(async () => {
        await book(ctx.customer.client, {
          slotId,
          customerId: ctx.customer.userId,
          purchaseId: custGroupPurchase,
        })
      }, 120_000)

      it('前提：資料庫實際的時段狀態是 pending、有效預約 1 筆', async () => {
        expect(await slotStatus(slotId)).toBe('pending')
        expect(await activeBookingCount(slotId)).toBe(1)
      })

      it('未登入：公開查詢查得到，已佔名額 1、名額上限 3', async () => {
        const row = await findBookable(anon, { slotId, serviceId: ctx.groupServiceId })
        expect(row).toMatchObject({ id: slotId, taken: 1, max_capacity: 3 })
      })

      it('乙（已登入、未預約）：公開查詢查得到，已佔名額 1', async () => {
        const row = await findBookable(ctx.otherCustomer.client, {
          slotId,
          serviceId: ctx.groupServiceId,
        })
        expect(row).toMatchObject({ id: slotId, taken: 1, max_capacity: 3 })
      })

      it('未登入：仍讀不到這個時段的任何預約資料', async () => {
        const { data, error } = await anon.from('bookings').select('id').eq('slot_id', slotId)
        expect(error).toBeNull()
        expect(data ?? []).toHaveLength(0)
      })
    })

    describe('乙預約（2/3）', () => {
      it('乙用 id 直接讀得到這個時段，狀態 pending（預約確認頁不再找不到）', async () => {
        const slot = await readSlotAs(ctx.otherCustomer.client, slotId)
        expect(slot).toMatchObject({ id: slotId, status: 'pending' })
      })

      it('乙查已佔名額是 1', async () => {
        expect(await takenCount(ctx.otherCustomer.client, slotId)).toBe(1)
      })

      it('乙預約成功', async () => {
        const { bookingId } = await book(ctx.otherCustomer.client, {
          slotId,
          customerId: ctx.otherCustomer.userId,
          purchaseId: otherGroupPurchase,
        })
        expect(bookingId).toBeTruthy()
        expect(await activeBookingCount(slotId)).toBe(2)
      })

      it('乙預約後：未登入查到已佔名額 2', async () => {
        const row = await findBookable(anon, { slotId, serviceId: ctx.groupServiceId })
        expect(row).toMatchObject({ id: slotId, taken: 2, max_capacity: 3 })
      })

      it('乙預約後：甲查已佔名額也是 2', async () => {
        expect(await takenCount(ctx.customer.client, slotId)).toBe(2)
      })
    })

    describe('丙預約後額滿（3/3）', () => {
      beforeAll(async () => {
        await book(third.client, {
          slotId,
          customerId: third.userId,
          purchaseId: thirdGroupPurchase,
        })
      }, 120_000)

      it('前提：資料庫實際的時段狀態是 booked、有效預約 3 筆', async () => {
        expect(await slotStatus(slotId)).toBe('booked')
        expect(await activeBookingCount(slotId)).toBe(3)
      })

      it('公開查詢不再回傳這個時段', async () => {
        expect(await findBookable(anon, { slotId, serviceId: ctx.groupServiceId })).toBeNull()
      })

      it('已佔名額是 3', async () => {
        expect(await takenCount(anon, slotId)).toBe(3)
      })

      it('未登入用 id 直接讀不到這個時段（額滿的時段不開放）', async () => {
        // 甲乙丙都有預約這個時段，讀得到是正常的，所以用未登入驗證
        expect(await readSlotAs(anon, slotId)).toBeNull()
      })

      it('未登入：仍讀不到這個時段的任何預約資料', async () => {
        const { data, error } = await anon.from('bookings').select('id').eq('slot_id', slotId)
        expect(error).toBeNull()
        expect(data ?? []).toHaveLength(0)
      })
    })
  })

  describe('個人班（名額 1）', () => {
    let slotId: string
    beforeAll(async () => {
      slotId = await makeSlot(ctx, {
        memberId: ctx.owner.memberId,
        serviceId: ctx.soloServiceId,
        startOffsetMin: uniqueOffset(WEEK_MIN),
      })
      await book(ctx.customer.client, {
        slotId,
        customerId: ctx.customer.userId,
        purchaseId: custSoloPurchase,
      })
    }, 120_000)

    it('甲預約後時段已不是 available（有人預約或已額滿）', async () => {
      // 目前 book_with_purchase 在個人班達開班人數時直接自動確認並把時段改成 booked；
      // 之後若改成先停在待確認（pending），這裡也要成立
      expect(['pending', 'booked']).toContain(await slotStatus(slotId))
    })

    it('公開查詢不回傳這個時段', async () => {
      expect(await findBookable(anon, { slotId, serviceId: ctx.soloServiceId })).toBeNull()
    })

    it('已佔名額是 1', async () => {
      expect(await takenCount(anon, slotId)).toBe(1)
    })

    it('乙預約被擋下，資料庫實際預約仍只有 1 筆', async () => {
      const { error } = await ctx.otherCustomer.client.rpc('book_with_purchase', {
        p_slot_id: slotId,
        p_customer_id: ctx.otherCustomer.userId,
        p_purchase_id: otherSoloPurchase,
      })
      // 時段為 pending 時擋在名額檢查（SLOT_FULL），已是 booked 時擋在狀態檢查（SLOT_UNAVAILABLE）
      expect(error?.message ?? '').toMatch(/SLOT_FULL|SLOT_UNAVAILABLE/)
      expect(await activeBookingCount(slotId)).toBe(1)
    })
  })

  describe('不該出現在公開查詢的時段', () => {
    it('已關閉（cancelled）的時段不回傳', async () => {
      const slotId = await groupSlot()
      expect(await findBookable(anon, { slotId, serviceId: ctx.groupServiceId })).not.toBeNull()
      const { error } = await admin
        .from('availability_slots')
        .update({ status: 'cancelled' })
        .eq('id', slotId)
      if (error) throw new Error(`關閉時段: ${error.message}`)
      expect(await findBookable(anon, { slotId, serviceId: ctx.groupServiceId })).toBeNull()
    })

    it('已過去的時段不回傳', async () => {
      const slotId = await makeSlot(ctx, {
        memberId: ctx.owner.memberId,
        serviceId: ctx.groupServiceId,
        startOffsetMin: uniqueOffset(-3 * DAY_MIN),
      })
      expect(await slotStatus(slotId)).toBe('available')
      expect(await findBookable(anon, { slotId, serviceId: ctx.groupServiceId })).toBeNull()
    })

    it('教練已停用（suspended）的租戶，時段查不到', async () => {
      const { tenantId } = await makeTenant(ctx, '-sus')
      ctx.extraTenantIds.push(tenantId)
      // 只建帳號、不登入（登入次數有上限）
      const { userId } = await makeUser(ctx, 'ownersus')
      const { data: member, error: mErr } = await admin
        .from('tenant_members')
        .insert({ tenant_id: tenantId, user_id: userId, role: 'owner', status: 'active' })
        .select('id')
        .single()
      if (mErr) throw new Error(`tenant_members: ${mErr.message}`)
      const serviceId = await makeService(
        { tenantId },
        { name: 'Group', maxCapacity: 3, minAttendance: 2, cancelDeadlineHours: 24 },
      )
      const start = Date.now() + WEEK_MIN * MIN
      const { data: slot, error: sErr } = await admin
        .from('availability_slots')
        .insert({
          tenant_id: tenantId,
          member_id: member.id,
          service_id: serviceId,
          start_at: new Date(start).toISOString(),
          end_at: new Date(start + 60 * MIN).toISOString(),
        })
        .select('id')
        .single()
      if (sErr) throw new Error(`availability_slots: ${sErr.message}`)

      // 對照：租戶正常時查得到
      expect(await findBookable(anon, { slotId: slot.id, serviceId, tenantId })).toMatchObject({
        id: slot.id,
        taken: 0,
      })

      const { error: tErr } = await admin
        .from('tenants')
        .update({ status: 'suspended' })
        .eq('id', tenantId)
      if (tErr) throw new Error(`停用租戶: ${tErr.message}`)
      expect(await findBookable(anon, { slotId: slot.id, serviceId, tenantId })).toBeNull()
    })
  })
})
