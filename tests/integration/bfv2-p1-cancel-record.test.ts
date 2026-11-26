// @vitest-environment node
// 任務 10：取消紀錄與取消必填原因（T10-1 ～ T10-13）
// 對應 supabase/migrations/20261126100300_bfv2_p1_functions.sql（cancel_booking、auto_cancel_group_slot）
// 與 20261126100400_bfv2_p1_guards.sql（bookings_cancel_record_check、移除 bookings_insert／update 政策）
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  admin,
  book,
  getBooking,
  ledgerRows,
  makePurchase,
  makeService,
  makeSlot,
  moveSlot,
  nearOffset,
  setBookingDeadline,
  setupBfv2,
  teardownBfv2,
  uniqueOffset,
  usedCount,
  type Bfv2Ctx,
} from './helpers/bfv2-fixture'

const HOUR_MIN = 60
const WEEK_MIN = 7 * 24 * HOUR_MIN
const DAY_MS = 24 * 3600_000

let ctx: Bfv2Ctx
let soloPurchase: string
let groupPurchase: string
let otherCustGroupPurchase: string

/** 學員預約一堂一對一（自動確認），回傳預約 id */
async function bookSolo(startBaseMin = WEEK_MIN) {
  const slotId = await makeSlot(ctx, {
    memberId: ctx.owner.memberId,
    serviceId: ctx.soloServiceId,
    startOffsetMin: uniqueOffset(startBaseMin),
  })
  const { bookingId, autoConfirmed } = await book(ctx.customer.client, {
    slotId,
    customerId: ctx.customer.userId,
    purchaseId: soloPurchase,
  })
  expect(autoConfirmed).toBe(true)
  return { slotId, bookingId }
}

/** 學員成為團班第一位報名者（待確認），回傳預約 id */
async function bookGroupFirst() {
  const slotId = await makeSlot(ctx, {
    memberId: ctx.owner.memberId,
    serviceId: ctx.groupServiceId,
    startOffsetMin: uniqueOffset(WEEK_MIN),
  })
  const { bookingId, autoConfirmed } = await book(ctx.customer.client, {
    slotId,
    customerId: ctx.customer.userId,
    purchaseId: groupPurchase,
  })
  expect(autoConfirmed).toBe(false)
  return { slotId, bookingId }
}

/** 把時段搬到距現在 12～21 小時（已過 24 小時期限、尚未開課），並把預約上的期限設成「開課 − 24 小時」 */
async function moveSlotPastDeadline(slotId: string, bookingId: string) {
  const start = await moveSlot(slotId, nearOffset())
  await setBookingDeadline(bookingId, new Date(start.getTime() - DAY_MS))
  return start
}

describe('bfv2 P1：取消紀錄與取消必填原因', () => {
  beforeAll(async () => {
    ctx = await setupBfv2('cancel')
    soloPurchase = await makePurchase(ctx, {
      customerId: ctx.customer.userId,
      serviceId: ctx.soloServiceId,
      total: 30,
    })
    groupPurchase = await makePurchase(ctx, {
      customerId: ctx.customer.userId,
      serviceId: ctx.groupServiceId,
      total: 30,
    })
    otherCustGroupPurchase = await makePurchase(ctx, {
      customerId: ctx.otherCustomer.userId,
      serviceId: ctx.groupServiceId,
      total: 10,
    })
  }, 120_000)

  afterAll(async () => {
    await teardownBfv2(ctx)
  }, 120_000)

  it('T10-1 學員期限內取消已確認預約：customer／refunded，已用堂數回到原值', async () => {
    const before = await usedCount(soloPurchase)
    const { bookingId } = await bookSolo()
    expect(await usedCount(soloPurchase)).toBe(before + 1)

    const { error } = await ctx.customer.client.rpc('cancel_booking', {
      p_booking_id: bookingId,
      p_reason: '生病',
    })
    expect(error).toBeNull()

    const b = await getBooking(bookingId)
    expect(b.status).toBe('cancelled')
    expect(b.cancel_category).toBe('customer')
    expect(b.class_disposition).toBe('refunded')
    expect(b.cancel_actor_role).toBe('customer')
    expect(b.cancel_reason).toBe('生病')
    expect(b.cancelled_by).toBe(ctx.customer.userId)
    expect(await usedCount(soloPurchase)).toBe(before)
  })

  it('T10-2 學員逾期取消已確認預約（P1 過渡）：customer／forfeited，已用堂數不退', async () => {
    const { slotId, bookingId } = await bookSolo()
    await moveSlotPastDeadline(slotId, bookingId)
    const before = await usedCount(soloPurchase)

    const { error } = await ctx.customer.client.rpc('cancel_booking', {
      p_booking_id: bookingId,
      p_reason: '工作',
    })
    expect(error).toBeNull()

    const b = await getBooking(bookingId)
    expect(b.status).toBe('cancelled')
    expect(b.cancel_category).toBe('customer')
    expect(b.class_disposition).toBe('forfeited')
    expect(await usedCount(soloPurchase)).toBe(before)
  })

  it('T10-3 學員取消待確認預約且已過期限（團班第一位）：refunded', async () => {
    const { slotId, bookingId } = await bookGroupFirst()
    await moveSlotPastDeadline(slotId, bookingId)
    const before = await usedCount(groupPurchase)

    const { error } = await ctx.customer.client.rpc('cancel_booking', {
      p_booking_id: bookingId,
      p_reason: '交通',
    })
    expect(error).toBeNull()

    const b = await getBooking(bookingId)
    expect(b.status).toBe('cancelled')
    expect(b.cancel_category).toBe('customer')
    expect(b.class_disposition).toBe('refunded')
    expect(await usedCount(groupPurchase)).toBe(before - 1)
  })

  it('T10-4 未填原因（省略、空字串、空白、換行定位）：學員與 Owner 都回 REASON_REQUIRED，預約不變', async () => {
    const variants: Array<[string, { p_reason?: string }]> = [
      ['省略', {}],
      ['空字串', { p_reason: '' }],
      ['三個空白', { p_reason: '   ' }],
      ['換行加定位', { p_reason: '\n\t' }],
    ]
    // 每個「身分 × 寫法」各用一筆新的已確認預約，某一種寫法被放行時不會影響其他寫法的結果
    const results: Record<string, { error: string | null; status: string }> = {}
    const expected: Record<string, { error: string | null; status: string }> = {}
    for (const [who, client] of [
      ['學員', ctx.customer.client],
      ['Owner', ctx.owner.client],
    ] as const) {
      for (const [name, v] of variants) {
        const { bookingId } = await bookSolo()
        const { error } = await client.rpc('cancel_booking', { p_booking_id: bookingId, ...v })
        const key = `${who}／${name}`
        results[key] = {
          error: error?.message ?? null,
          status: (await getBooking(bookingId)).status,
        }
        expected[key] = { error: 'REASON_REQUIRED', status: 'confirmed' }
      }
    }
    expect(results).toEqual(expected)
  })

  it('T10-5 原因 501 字回 REASON_TOO_LONG；500 字成功', async () => {
    const { bookingId } = await bookSolo()
    const { error: longErr } = await ctx.customer.client.rpc('cancel_booking', {
      p_booking_id: bookingId,
      p_reason: '字'.repeat(501),
    })
    expect(longErr?.message).toContain('REASON_TOO_LONG')
    expect((await getBooking(bookingId)).status).toBe('confirmed')

    const reason500 = '字'.repeat(500)
    const { error } = await ctx.customer.client.rpc('cancel_booking', {
      p_booking_id: bookingId,
      p_reason: reason500,
    })
    expect(error).toBeNull()
    const b = await getBooking(bookingId)
    expect(b.status).toBe('cancelled')
    expect(b.cancel_reason).toBe(reason500)
  })

  it('T10-6 Owner 取消已確認且已過期限的預約：coach_cancelled／refunded／owner', async () => {
    const before = await usedCount(soloPurchase)
    const { slotId, bookingId } = await bookSolo()
    await moveSlotPastDeadline(slotId, bookingId)
    expect(await usedCount(soloPurchase)).toBe(before + 1)

    const { error } = await ctx.owner.client.rpc('cancel_booking', {
      p_booking_id: bookingId,
      p_reason: '教練臨時有事',
    })
    expect(error).toBeNull()

    const b = await getBooking(bookingId)
    expect(b.cancel_category).toBe('coach_cancelled')
    expect(b.class_disposition).toBe('refunded')
    expect(b.cancel_actor_role).toBe('owner')
    expect(b.cancelled_by).toBe(ctx.owner.userId)
    expect(await usedCount(soloPurchase)).toBe(before)
  })

  it('T10-7 Owner 取消待確認預約：coach_rejected／refunded', async () => {
    const before = await usedCount(groupPurchase)
    const { bookingId } = await bookGroupFirst()
    const { error } = await ctx.owner.client.rpc('cancel_booking', {
      p_booking_id: bookingId,
      p_reason: '這個時段不開',
    })
    expect(error).toBeNull()

    const b = await getBooking(bookingId)
    expect(b.cancel_category).toBe('coach_rejected')
    expect(b.class_disposition).toBe('refunded')
    expect(b.cancel_actor_role).toBe('owner')
    expect(await usedCount(groupPurchase)).toBe(before)
  })

  it('T10-8 取消期限讀預約上的值：服務時數事後改為 1 小時，距開課 12 小時取消仍為 forfeited', async () => {
    // 專用服務，避免改到其他案例共用的服務
    const svc = await makeService(ctx, {
      name: 'Deadline snapshot',
      maxCapacity: 1,
      minAttendance: 1,
      cancelDeadlineHours: 24,
    })
    const purchase = await makePurchase(ctx, { customerId: ctx.customer.userId, serviceId: svc })
    const slotId = await makeSlot(ctx, {
      memberId: ctx.owner.memberId,
      serviceId: svc,
      startOffsetMin: uniqueOffset(WEEK_MIN),
    })
    const { data: slot } = await admin
      .from('availability_slots')
      .select('start_at')
      .eq('id', slotId)
      .single()
    const { bookingId } = await book(ctx.customer.client, {
      slotId,
      customerId: ctx.customer.userId,
      purchaseId: purchase,
    })

    const stored = (await getBooking(bookingId)).cancel_deadline_at
    expect(stored).not.toBeNull()
    expect(new Date(stored!).getTime()).toBe(new Date(slot!.start_at).getTime() - DAY_MS)

    const { error: svcErr } = await admin
      .from('services')
      .update({ cancel_deadline_hours: 1 })
      .eq('id', svc)
    expect(svcErr).toBeNull()
    expect((await getBooking(bookingId)).cancel_deadline_at).toBe(stored)

    // 距開課 12 小時：照預約上的 24 小時期限 → 已逾期；若讀服務當下的 1 小時 → 期限內
    await moveSlotPastDeadline(slotId, bookingId)
    const { error } = await ctx.customer.client.rpc('cancel_booking', {
      p_booking_id: bookingId,
      p_reason: '天氣',
    })
    expect(error).toBeNull()
    const b = await getBooking(bookingId)
    expect(b.class_disposition).toBe('forfeited')
    expect(await usedCount(purchase)).toBe(1)
  })

  it('T10-9 開課後學員取消：SLOT_STARTED', async () => {
    const { slotId, bookingId } = await bookSolo()
    await moveSlot(slotId, -10) // 10 分鐘前開課，仍在上課中（本檔沒有其他時段落在現在附近）
    const { error } = await ctx.customer.client.rpc('cancel_booking', {
      p_booking_id: bookingId,
      p_reason: '生病',
    })
    expect(error?.message).toContain('SLOT_STARTED')
    expect((await getBooking(bookingId)).status).toBe('confirmed')
  })

  it('T10-10 已取消、已出席、未出席的預約再取消：INVALID_STATE', async () => {
    const { bookingId: cancelledId } = await bookSolo()
    const { error: c1 } = await ctx.customer.client.rpc('cancel_booking', {
      p_booking_id: cancelledId,
      p_reason: '生病',
    })
    expect(c1).toBeNull()
    const { error: again } = await ctx.customer.client.rpc('cancel_booking', {
      p_booking_id: cancelledId,
      p_reason: '生病',
    })
    expect(again?.message).toContain('INVALID_STATE')

    for (const status of ['completed', 'no_show'] as const) {
      const { bookingId } = await bookSolo()
      const { error: upErr } = await admin.from('bookings').update({ status }).eq('id', bookingId)
      expect(upErr).toBeNull()
      for (const client of [ctx.customer.client, ctx.owner.client]) {
        const { error } = await client.rpc('cancel_booking', {
          p_booking_id: bookingId,
          p_reason: '測試',
        })
        expect(error?.message, status).toContain('INVALID_STATE')
      }
      expect((await getBooking(bookingId)).status).toBe(status)
    }
  })

  it('T10-11 不經函式直接改表：學員與教練的 update 影響 0 列，學員 insert 失敗', async () => {
    const { bookingId } = await bookSolo()
    const { data: custUpd, error: custErr } = await ctx.customer.client
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', bookingId)
      .select()
    expect(custErr).toBeNull()
    expect(custUpd).toHaveLength(0)
    expect((await getBooking(bookingId)).status).toBe('confirmed')

    const { bookingId: pendingId, slotId: pendingSlot } = await bookGroupFirst()
    const { data: ownerUpd, error: ownerErr } = await ctx.owner.client
      .from('bookings')
      .update({ status: 'confirmed' })
      .eq('id', pendingId)
      .select()
    expect(ownerErr).toBeNull()
    expect(ownerUpd).toHaveLength(0)
    expect((await getBooking(pendingId)).status).toBe('pending')

    const { data: ins, error: insErr } = await ctx.customer.client
      .from('bookings')
      .insert({
        tenant_id: ctx.tenantId,
        slot_id: pendingSlot,
        customer_id: ctx.customer.userId,
        service_id: ctx.groupServiceId,
        purchase_id: groupPurchase,
        status: 'confirmed',
      })
      .select()
    expect(insErr).not.toBeNull()
    expect(ins).toBeNull()
    const { count } = await admin
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('slot_id', pendingSlot)
    expect(count).toBe(1)
  })

  it('T10-12 人數不足自動取消：under_min／system／refunded，重複呼叫不重複退堂', async () => {
    const before = await usedCount(otherCustGroupPurchase)
    const slotId = await makeSlot(ctx, {
      memberId: ctx.owner.memberId,
      serviceId: ctx.groupServiceId,
      startOffsetMin: uniqueOffset(WEEK_MIN),
    })
    const { bookingId } = await book(ctx.otherCustomer.client, {
      slotId,
      customerId: ctx.otherCustomer.userId,
      purchaseId: otherCustGroupPurchase,
    })
    expect(await usedCount(otherCustGroupPurchase)).toBe(before + 1)

    const { data: rows, error } = await admin.rpc('auto_cancel_group_slot', { p_slot_id: slotId })
    expect(error).toBeNull()
    expect(rows).toHaveLength(1)
    expect(rows![0]!.affected_customer_id).toBe(ctx.otherCustomer.userId)

    const b = await getBooking(bookingId)
    expect(b.status).toBe('cancelled')
    expect(b.cancel_category).toBe('under_min')
    expect(b.cancel_actor_role).toBe('system')
    expect(b.class_disposition).toBe('refunded')
    expect(b.cancel_reason).toBe('人數不足，系統自動取消')
    expect(b.cancelled_by).toBeNull()
    expect(await usedCount(otherCustGroupPurchase)).toBe(before)

    const { data: slot } = await admin
      .from('availability_slots')
      .select('status')
      .eq('id', slotId)
      .single()
    expect(slot!.status).toBe('cancelled')

    const ledgerBefore = (await ledgerRows(otherCustGroupPurchase)).length
    const { data: again, error: againErr } = await admin.rpc('auto_cancel_group_slot', {
      p_slot_id: slotId,
    })
    expect(againErr).toBeNull()
    expect(again ?? []).toHaveLength(0)
    expect(await usedCount(otherCustGroupPurchase)).toBe(before)
    expect((await ledgerRows(otherCustGroupPurchase)).length).toBe(ledgerBefore)
  })

  it('T10-13 一致性限制：service role 直接把預約改成已取消（不帶取消類別）被擋', async () => {
    const { bookingId } = await bookSolo()
    const { error } = await admin
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', bookingId)
    const after = await getBooking(bookingId)
    expect({ error: error?.message ?? null, status: after.status }).toEqual({
      error: expect.stringContaining('bookings_cancel_record_check'),
      status: 'confirmed',
    })
  })
})
