// @vitest-environment node
// 任務 12：歷程與堂數明細（T12-1 ～ T12-12）
// 對應 supabase/migrations/20261126100300_bfv2_p1_functions.sql 六支改寫函式＋mark_no_show_bookings
// 與 20261126100000_bfv2_p1_new_tables.sql（activity_log／class_ledger 只增不改）
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  activityFor,
  admin,
  book,
  getBooking,
  ledgerRows,
  ledgerSum,
  makePurchase,
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

const WEEK_MIN = 7 * 24 * 60
const DAY_MS = 24 * 3600_000

let ctx: Bfv2Ctx
let soloPurchase: string
let groupPurchase: string
let otherGroupPurchase: string

async function slotStart(slotId: string) {
  const { data, error } = await admin
    .from('availability_slots')
    .select('start_at')
    .eq('id', slotId)
    .single()
  if (error) throw new Error(error.message)
  return new Date(data.start_at)
}

async function soloSlot(memberId = ctx.owner.memberId) {
  return makeSlot(ctx, {
    memberId,
    serviceId: ctx.soloServiceId,
    startOffsetMin: uniqueOffset(WEEK_MIN),
  })
}

async function bookSolo(memberId = ctx.owner.memberId) {
  const slotId = await soloSlot(memberId)
  const { bookingId, autoConfirmed } = await book(ctx.customer.client, {
    slotId,
    customerId: ctx.customer.userId,
    purchaseId: soloPurchase,
  })
  expect(autoConfirmed).toBe(true)
  return { slotId, bookingId }
}

async function ledgerOfBooking(purchaseId: string, bookingId: string) {
  return (await ledgerRows(purchaseId))
    .filter((r) => r.booking_id === bookingId)
    .map((r) => ({ delta: r.delta, reason_code: r.reason_code }))
}

async function counts(bookingId: string, purchaseId: string) {
  return {
    activity: (await activityFor(bookingId)).length,
    ledger: (await ledgerRows(purchaseId)).length,
    used: await usedCount(purchaseId),
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

describe('bfv2 P1：歷程與堂數明細', () => {
  beforeAll(async () => {
    ctx = await setupBfv2('history')
    soloPurchase = await makePurchase(ctx, {
      customerId: ctx.customer.userId,
      serviceId: ctx.soloServiceId,
      total: 30,
    })
    groupPurchase = await makePurchase(ctx, {
      customerId: ctx.customer.userId,
      serviceId: ctx.groupServiceId,
      total: 10,
    })
    otherGroupPurchase = await makePurchase(ctx, {
      customerId: ctx.otherCustomer.userId,
      serviceId: ctx.groupServiceId,
      total: 10,
    })
  }, 120_000)

  afterAll(async () => {
    await teardownBfv2(ctx)
  }, 120_000)

  it('T12-1 建立一對一預約：created（學員）＋ confirmed（系統自動）、明細 −1 booking、期限＝開課 − 24 小時', async () => {
    const { slotId, bookingId } = await bookSolo()
    const start = await slotStart(slotId)
    const log = await activityFor(bookingId)
    expect(log.map((a) => a.event).sort()).toEqual(['booking.confirmed', 'booking.created'])

    const created = log.find((a) => a.event === 'booking.created')!
    expect(created.actor_role).toBe('customer')
    expect(created.actor_user_id).toBe(ctx.customer.userId)
    expect(created.detail.cancel_deadline_at).toBeTruthy()
    expect(created.detail.slot_id).toBe(slotId)
    expect(created.detail.purchase_id).toBe(soloPurchase)

    const confirmed = log.find((a) => a.event === 'booking.confirmed')!
    expect(confirmed.actor_role).toBe('system')
    expect(confirmed.actor_user_id).toBeNull()
    expect(confirmed.detail.auto).toBe(true)
    // 「依序」：建立不得晚於確認（同一交易內兩者 created_at 相同，見回報）
    expect(new Date(created.created_at).getTime()).toBeLessThanOrEqual(
      new Date(confirmed.created_at).getTime(),
    )

    expect(await ledgerOfBooking(soloPurchase, bookingId)).toEqual([
      { delta: -1, reason_code: 'booking' },
    ])
    const b = await getBooking(bookingId)
    expect(new Date(b.cancel_deadline_at!).getTime()).toBe(start.getTime() - DAY_MS)
  })

  it('T12-2 教練手動確認（團班第一位）：confirmed、owner、沒有 auto', async () => {
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
    const { error } = await ctx.owner.client.rpc('confirm_booking', { p_booking_id: bookingId })
    expect(error).toBeNull()

    const confirmed = (await activityFor(bookingId)).filter((a) => a.event === 'booking.confirmed')
    expect(confirmed).toHaveLength(1)
    expect(confirmed[0]!.actor_role).toBe('owner')
    expect(confirmed[0]!.actor_user_id).toBe(ctx.owner.userId)
    expect(confirmed[0]!.detail.auto).toBeUndefined()
  })

  it('T12-3 取消且退回：明細 +1 cancel_refund；歷程 cancelled 帶原因與 detail', async () => {
    const { bookingId } = await bookSolo()
    const { error } = await ctx.customer.client.rpc('cancel_booking', {
      p_booking_id: bookingId,
      p_reason: '工作',
    })
    expect(error).toBeNull()

    expect(await ledgerOfBooking(soloPurchase, bookingId)).toEqual([
      { delta: -1, reason_code: 'booking' },
      { delta: 1, reason_code: 'cancel_refund' },
    ])
    const cancelled = (await activityFor(bookingId)).filter((a) => a.event === 'booking.cancelled')
    expect(cancelled).toHaveLength(1)
    expect(cancelled[0]!.reason).toBe('工作')
    expect(cancelled[0]!.actor_role).toBe('customer')
    expect(cancelled[0]!.detail).toMatchObject({
      category: 'customer',
      disposition: 'refunded',
      previous_status: 'confirmed',
      class_returned: true,
    })
    expect(cancelled[0]!.detail.cancel_deadline_at).toBeTruthy()
  })

  it('T12-4 取消且不退回：明細沒有新增；歷程 disposition＝forfeited', async () => {
    const { slotId, bookingId } = await bookSolo()
    const start = await moveSlot(slotId, nearOffset())
    await setBookingDeadline(bookingId, new Date(start.getTime() - DAY_MS))
    const { error } = await ctx.customer.client.rpc('cancel_booking', {
      p_booking_id: bookingId,
      p_reason: '交通',
    })
    expect(error).toBeNull()

    expect(await ledgerOfBooking(soloPurchase, bookingId)).toEqual([
      { delta: -1, reason_code: 'booking' },
    ])
    const cancelled = (await activityFor(bookingId)).find((a) => a.event === 'booking.cancelled')!
    expect(cancelled.detail.disposition).toBe('forfeited')
    expect(cancelled.detail.class_returned).toBe(false)
  })

  it('T12-5 改期：舊預約 rescheduled／transferred、新預約互相連結、明細一對、已用堂數不變', async () => {
    const { bookingId: oldId } = await bookSolo()
    const newSlot = await soloSlot()
    const newStart = await slotStart(newSlot)
    const usedBefore = await usedCount(soloPurchase)

    const { data, error } = await ctx.customer.client.rpc('reschedule_booking', {
      p_old_booking_id: oldId,
      p_new_slot_id: newSlot,
    })
    expect(error).toBeNull()
    const newId = (data as unknown as { id: string }).id

    const old = await getBooking(oldId)
    expect(old.status).toBe('cancelled')
    expect(old.cancel_category).toBe('rescheduled')
    expect(old.class_disposition).toBe('transferred')

    const nb = await getBooking(newId)
    expect(nb.rescheduled_from_booking_id).toBe(oldId)
    expect(nb.slot_id).toBe(newSlot)
    expect(new Date(nb.cancel_deadline_at!).getTime()).toBe(newStart.getTime() - DAY_MS)

    const out = (await activityFor(oldId)).find((a) => a.event === 'booking.rescheduled_out')
    expect(out?.detail.to_booking_id).toBe(newId)
    const into = (await activityFor(newId)).find((a) => a.event === 'booking.rescheduled_in')
    expect(into?.detail.from_booking_id).toBe(oldId)

    expect(await ledgerOfBooking(soloPurchase, oldId)).toEqual([
      { delta: -1, reason_code: 'booking' },
      { delta: 1, reason_code: 'reschedule_out' },
    ])
    expect(await ledgerOfBooking(soloPurchase, newId)).toEqual([
      { delta: -1, reason_code: 'reschedule_in' },
    ])
    expect(await usedCount(soloPurchase)).toBe(usedBefore)
  })

  it('T12-6 改期的防護：SERVICE_MISMATCH、SAME_SLOT、SLOT_PAST、封鎖後改期與預約都是 CUSTOMER_BLOCKED', async () => {
    const { slotId, bookingId } = await bookSolo()
    const usedBefore = await usedCount(soloPurchase)

    const otherSvcSlot = await makeSlot(ctx, {
      memberId: ctx.owner.memberId,
      serviceId: ctx.otherServiceId,
      startOffsetMin: uniqueOffset(WEEK_MIN),
    })
    const pastSlot = await makeSlot(ctx, {
      memberId: ctx.owner.memberId,
      serviceId: ctx.soloServiceId,
      startOffsetMin: uniqueOffset(-30 * 24 * 60),
    })
    const validSlot = await soloSlot()
    const anotherValidSlot = await soloSlot()

    const resched = async (to: string) =>
      (
        await ctx.customer.client.rpc('reschedule_booking', {
          p_old_booking_id: bookingId,
          p_new_slot_id: to,
        })
      ).error?.message ?? null

    const results: Record<string, string | null> = {
      另一個服務: await resched(otherSvcSlot),
      同一個時段: await resched(slotId),
      已過去的時段: await resched(pastSlot),
    }

    const { error: blockErr } = await admin
      .from('tenant_customers')
      .update({ is_blocked: true })
      .eq('tenant_id', ctx.tenantId)
      .eq('customer_id', ctx.customer.userId)
    expect(blockErr).toBeNull()
    try {
      results['封鎖後改期'] = await resched(validSlot)
      const { error: bookErr } = await ctx.customer.client.rpc('book_with_purchase', {
        p_slot_id: anotherValidSlot,
        p_customer_id: ctx.customer.userId,
        p_purchase_id: soloPurchase,
      })
      results['封鎖後預約'] = bookErr?.message ?? null
    } finally {
      await admin
        .from('tenant_customers')
        .update({ is_blocked: false })
        .eq('tenant_id', ctx.tenantId)
        .eq('customer_id', ctx.customer.userId)
    }

    expect(results).toEqual({
      另一個服務: expect.stringContaining('SERVICE_MISMATCH'),
      同一個時段: expect.stringContaining('SAME_SLOT'),
      已過去的時段: expect.stringContaining('SLOT_PAST'),
      封鎖後改期: expect.stringContaining('CUSTOMER_BLOCKED'),
      封鎖後預約: expect.stringContaining('CUSTOMER_BLOCKED'),
    })
    expect((await getBooking(bookingId)).status).toBe('confirmed')
    expect(await usedCount(soloPurchase)).toBe(usedBefore)
  })

  it('T12-7 簽到：checked_in、學員、source＝customer_checkin', async () => {
    const { slotId, bookingId } = await bookSolo(ctx.staffA.memberId)
    await moveSlot(slotId, 10) // 10 分鐘後開課（開課前 30 分鐘起可簽到）
    const { error } = await ctx.customer.client.rpc('checkin_booking', { p_booking_id: bookingId })
    expect(error).toBeNull()

    const ev = (await activityFor(bookingId)).filter((a) => a.event === 'booking.checked_in')
    expect(ev).toHaveLength(1)
    expect(ev[0]!.actor_role).toBe('customer')
    expect(ev[0]!.actor_user_id).toBe(ctx.customer.userId)
    expect(ev[0]!.detail.source).toBe('customer_checkin')
  })

  it('T12-8 系統標為未出席：no_show、歷程 system、明細沒有新增', async () => {
    // mark_no_show_bookings 不分租戶。為了不碰到任何既有預約：
    //   1. 只把回溯區間設成 15 秒，且把本案例時段的結束時間設在「資料庫現在 − 2 秒」
    //   2. 挑資料庫時間秒數（每 30 秒為一輪）落在 18～26 秒時才呼叫，
    //      讓 15 秒的區間不會跨過整分或半分（一般時段的結束時間落在這兩種位置）
    const { slotId, bookingId } = await bookSolo(ctx.staffB.memberId)
    const ledgerBefore = await ledgerOfBooking(soloPurchase, bookingId)

    const { data: probe } = await admin
      .from('availability_slots')
      .update({ status: 'booked' })
      .eq('id', slotId)
      .select('updated_at')
      .single()
    const skew = new Date(probe!.updated_at).getTime() - Date.now()
    const dbNow = () => Date.now() + skew
    for (;;) {
      const sec = Math.floor(dbNow() / 1000) % 30
      if (sec >= 18 && sec <= 26) break
      await sleep(500)
    }
    const end = dbNow() - 2_000
    const { error: moveErr } = await admin
      .from('availability_slots')
      .update({
        start_at: new Date(end - 3600_000).toISOString(),
        end_at: new Date(end).toISOString(),
      })
      .eq('id', slotId)
    expect(moveErr).toBeNull()

    const { data: n, error } = await admin.rpc('mark_no_show_bookings', {
      p_lookback: '15 seconds',
    })
    expect(error).toBeNull()
    if ((n as number) > 1) {
      console.warn(`mark_no_show_bookings 標記了 ${n} 筆（本案例只預期 1 筆）`)
    }
    expect(n as number).toBeGreaterThanOrEqual(1)

    expect((await getBooking(bookingId)).status).toBe('no_show')
    const ev = (await activityFor(bookingId)).filter((a) => a.event === 'booking.no_show')
    expect(ev).toHaveLength(1)
    expect(ev[0]!.actor_role).toBe('system')
    expect(ev[0]!.actor_user_id).toBeNull()
    expect(await ledgerOfBooking(soloPurchase, bookingId)).toEqual(ledgerBefore)
  }, 60_000)

  it('T12-10 只增不改：service role 改 activity_log、class_ledger 都被 APPEND_ONLY 擋下', async () => {
    const { bookingId } = await bookSolo()
    const log = await activityFor(bookingId)
    const ledger = (await ledgerRows(soloPurchase)).filter((r) => r.booking_id === bookingId)
    expect(log.length).toBeGreaterThan(0)
    expect(ledger.length).toBeGreaterThan(0)

    const { error: e1 } = await admin
      .from('activity_log')
      .update({ reason: '竄改' })
      .eq('id', log[0]!.id)
    const { error: e2 } = await admin
      .from('class_ledger')
      .update({ delta: 5 })
      .eq('id', ledger[0]!.id)
    expect([e1?.message ?? null, e2?.message ?? null]).toEqual([
      expect.stringContaining('APPEND_ONLY'),
      expect.stringContaining('APPEND_ONLY'),
    ])
    expect(await activityFor(bookingId)).toEqual(log)
  })

  it('T12-11 失敗不留紀錄：未填原因被擋後，歷程、明細筆數與已用堂數都不變', async () => {
    const { bookingId } = await bookSolo()
    const before = await counts(bookingId, soloPurchase)
    const { error } = await ctx.customer.client.rpc('cancel_booking', { p_booking_id: bookingId })
    expect(error?.message).toContain('REASON_REQUIRED')
    expect(await counts(bookingId, soloPurchase)).toEqual(before)
  })

  it('T12-12 團班成班自動確認：兩筆預約各一筆 confirmed（system、auto），不重複', async () => {
    const slotId = await makeSlot(ctx, {
      memberId: ctx.owner.memberId,
      serviceId: ctx.groupServiceId,
      startOffsetMin: uniqueOffset(WEEK_MIN),
    })
    const first = await book(ctx.customer.client, {
      slotId,
      customerId: ctx.customer.userId,
      purchaseId: groupPurchase,
    })
    expect(first.autoConfirmed).toBe(false)
    const second = await book(ctx.otherCustomer.client, {
      slotId,
      customerId: ctx.otherCustomer.userId,
      purchaseId: otherGroupPurchase,
    })
    expect(second.autoConfirmed).toBe(true)

    for (const id of [first.bookingId, second.bookingId]) {
      const confirmed = (await activityFor(id)).filter((a) => a.event === 'booking.confirmed')
      expect(confirmed).toHaveLength(1)
      expect(confirmed[0]!.actor_role).toBe('system')
      expect(confirmed[0]!.actor_user_id).toBeNull()
      expect(confirmed[0]!.detail.auto).toBe(true)
      expect((await getBooking(id)).status).toBe('confirmed')
    }
  })

  // 放在最後：前面所有案例跑完後檢查
  it('T12-9 不變式：測試租戶內每一筆購買的已用堂數＝−明細加總', async () => {
    const { data, error } = await admin
      .from('customer_purchases')
      .select('id')
      .eq('tenant_id', ctx.tenantId)
    expect(error).toBeNull()
    expect(data!.length).toBeGreaterThanOrEqual(3)
    const rows: Array<{ id: string; used: number; ledger: number }> = []
    for (const p of data!) {
      rows.push({ id: p.id, used: await usedCount(p.id), ledger: -(await ledgerSum(p.id)) })
    }
    expect(rows.filter((r) => r.used !== r.ledger)).toEqual([])
    expect(rows.some((r) => r.used > 0)).toBe(true)
  })
})
