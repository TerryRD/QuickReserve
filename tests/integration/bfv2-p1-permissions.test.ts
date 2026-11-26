// @vitest-environment node
// 任務 11：權限（設計文件 §12）與讀取範圍（T11-1 ～ T11-12）
// 對應 supabase/migrations/20261126100000_bfv2_p1_new_tables.sql（三張新表的 RLS 與權限）
// 與 20261126100300_bfv2_p1_functions.sql（confirm／cancel／reschedule 的身分判斷、輔助函式權限）
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import {
  activityFor,
  admin,
  book,
  getBooking,
  ledgerRows,
  makeOwnerOfNewTenant,
  makePurchase,
  makeSlot,
  setupBfv2,
  teardownBfv2,
  uniqueOffset,
  type Bfv2Ctx,
} from './helpers/bfv2-fixture'

const WEEK_MIN = 7 * 24 * 60

let ctx: Bfv2Ctx
let custGroupPurchase: string
let custSoloPurchase: string
let otherGroupPurchase: string
let otherSoloPurchase: string
let otherTenantOwner: SupabaseClient<Database>

type RpcResult = { data: unknown; error: { message: string; code: string } | null }
/** 呼叫型別檔沒有列出的函式（輔助函式刻意不開放，型別檔也沒有） */
function rawRpc(client: SupabaseClient<Database>) {
  return client.rpc.bind(client) as unknown as (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<RpcResult>
}

async function slotOf(memberId: string, serviceId: string) {
  return makeSlot(ctx, { memberId, serviceId, startOffsetMin: uniqueOffset(WEEK_MIN) })
}

/** 學員在指定成員的團班時段報名（第一位 → 待確認） */
async function pendingOn(memberId: string, who: 'customer' | 'otherCustomer' = 'customer') {
  const slotId = await slotOf(memberId, ctx.groupServiceId)
  const user = who === 'customer' ? ctx.customer : ctx.otherCustomer
  const { bookingId, autoConfirmed } = await book(user.client, {
    slotId,
    customerId: user.userId,
    purchaseId: who === 'customer' ? custGroupPurchase : otherGroupPurchase,
  })
  expect(autoConfirmed).toBe(false)
  return { slotId, bookingId }
}

describe('bfv2 P1：權限與讀取範圍', () => {
  beforeAll(async () => {
    ctx = await setupBfv2('perm')
    custGroupPurchase = await makePurchase(ctx, {
      customerId: ctx.customer.userId,
      serviceId: ctx.groupServiceId,
      total: 30,
    })
    custSoloPurchase = await makePurchase(ctx, {
      customerId: ctx.customer.userId,
      serviceId: ctx.soloServiceId,
      total: 10,
    })
    otherGroupPurchase = await makePurchase(ctx, {
      customerId: ctx.otherCustomer.userId,
      serviceId: ctx.groupServiceId,
      total: 10,
    })
    otherSoloPurchase = await makePurchase(ctx, {
      customerId: ctx.otherCustomer.userId,
      serviceId: ctx.soloServiceId,
      total: 10,
    })
    otherTenantOwner = (await makeOwnerOfNewTenant(ctx, '-other')).owner.client
  }, 120_000)

  afterAll(async () => {
    await teardownBfv2(ctx)
  }, 120_000)

  it('T11-1 助教 A 取消、確認助教 B 時段的預約：FORBIDDEN，預約不變', async () => {
    const { bookingId } = await pendingOn(ctx.staffB.memberId)
    const { error: cancelErr } = await ctx.staffA.client.rpc('cancel_booking', {
      p_booking_id: bookingId,
      p_reason: '測試',
    })
    expect(cancelErr?.message).toContain('FORBIDDEN')
    const { error: confirmErr } = await ctx.staffA.client.rpc('confirm_booking', {
      p_booking_id: bookingId,
    })
    expect(confirmErr?.message).toContain('FORBIDDEN')
    const b = await getBooking(bookingId)
    expect(b.status).toBe('pending')
    expect(b.cancel_category).toBeNull()
  })

  it('T11-2 助教 A 確認、取消自己時段的預約：成功，取消人身分與歷程皆為 staff', async () => {
    const { bookingId: toConfirm } = await pendingOn(ctx.staffA.memberId)
    const { error: confirmErr } = await ctx.staffA.client.rpc('confirm_booking', {
      p_booking_id: toConfirm,
    })
    expect(confirmErr).toBeNull()
    expect((await getBooking(toConfirm)).status).toBe('confirmed')
    const confirmed = (await activityFor(toConfirm)).find((a) => a.event === 'booking.confirmed')
    expect(confirmed?.actor_role).toBe('staff')
    expect(confirmed?.actor_user_id).toBe(ctx.staffA.userId)

    const { error: cancelErr } = await ctx.staffA.client.rpc('cancel_booking', {
      p_booking_id: toConfirm,
      p_reason: '助教臨時有事',
    })
    expect(cancelErr).toBeNull()
    const b = await getBooking(toConfirm)
    expect(b.status).toBe('cancelled')
    expect(b.cancel_actor_role).toBe('staff')
    const cancelled = (await activityFor(toConfirm)).find((a) => a.event === 'booking.cancelled')
    expect(cancelled?.actor_role).toBe('staff')
    expect(cancelled?.actor_user_id).toBe(ctx.staffA.userId)
  })

  it('T11-3 Owner 確認、取消助教 A 時段的預約：成功，取消人身分為 owner', async () => {
    const { bookingId } = await pendingOn(ctx.staffA.memberId)
    const { error: confirmErr } = await ctx.owner.client.rpc('confirm_booking', {
      p_booking_id: bookingId,
    })
    expect(confirmErr).toBeNull()
    const confirmed = (await activityFor(bookingId)).find((a) => a.event === 'booking.confirmed')
    expect(confirmed?.actor_role).toBe('owner')

    const { error: cancelErr } = await ctx.owner.client.rpc('cancel_booking', {
      p_booking_id: bookingId,
      p_reason: 'Owner 取消',
    })
    expect(cancelErr).toBeNull()
    const b = await getBooking(bookingId)
    expect(b.status).toBe('cancelled')
    expect(b.cancel_actor_role).toBe('owner')
  })

  it('T11-4 平台管理員呼叫 confirm／cancel／reschedule：都是 FORBIDDEN', async () => {
    const { bookingId } = await pendingOn(ctx.owner.memberId)
    const target = await slotOf(ctx.owner.memberId, ctx.groupServiceId)
    const pa = ctx.platformAdmin.client
    const { error: e1 } = await pa.rpc('confirm_booking', { p_booking_id: bookingId })
    const { error: e2 } = await pa.rpc('cancel_booking', {
      p_booking_id: bookingId,
      p_reason: '平台代取消',
    })
    const { error: e3 } = await pa.rpc('reschedule_booking', {
      p_old_booking_id: bookingId,
      p_new_slot_id: target,
      p_reason: '平台代改期',
    })
    expect([e1?.message, e2?.message, e3?.message]).toEqual([
      expect.stringContaining('FORBIDDEN'),
      expect.stringContaining('FORBIDDEN'),
      expect.stringContaining('FORBIDDEN'),
    ])
    expect((await getBooking(bookingId)).status).toBe('pending')
  })

  it('T11-5 別的學員取消、改期這筆預約：FORBIDDEN', async () => {
    const { bookingId } = await pendingOn(ctx.owner.memberId)
    const target = await slotOf(ctx.owner.memberId, ctx.groupServiceId)
    const oc = ctx.otherCustomer.client
    const { error: e1 } = await oc.rpc('cancel_booking', {
      p_booking_id: bookingId,
      p_reason: '不是我的',
    })
    const { error: e2 } = await oc.rpc('reschedule_booking', {
      p_old_booking_id: bookingId,
      p_new_slot_id: target,
    })
    expect(e1?.message).toContain('FORBIDDEN')
    expect(e2?.message).toContain('FORBIDDEN')
    expect((await getBooking(bookingId)).status).toBe('pending')
  })

  it('T11-6 助教代改期以舊時段為準：舊時段是助教 B 的 → FORBIDDEN；舊時段是自己的、新時段是助教 B 的 → 成功', async () => {
    const { bookingId: onB } = await pendingOn(ctx.staffB.memberId)
    const toA = await slotOf(ctx.staffA.memberId, ctx.groupServiceId)
    const { error: forbidden } = await ctx.staffA.client.rpc('reschedule_booking', {
      p_old_booking_id: onB,
      p_new_slot_id: toA,
      p_reason: '幫學員改時間',
    })
    expect(forbidden?.message).toContain('FORBIDDEN')
    expect((await getBooking(onB)).status).toBe('pending')

    const { bookingId: onA } = await pendingOn(ctx.staffA.memberId)
    const toB = await slotOf(ctx.staffB.memberId, ctx.groupServiceId)
    const { data, error } = await ctx.staffA.client.rpc('reschedule_booking', {
      p_old_booking_id: onA,
      p_new_slot_id: toB,
      p_reason: '幫學員改時間',
    })
    expect(error).toBeNull()
    const newBooking = data as unknown as { id: string; slot_id: string }
    expect(newBooking.slot_id).toBe(toB)
    const old = await getBooking(onA)
    expect(old.cancel_category).toBe('rescheduled')
    expect(old.cancel_actor_role).toBe('staff')
    expect(old.cancel_reason).toBe('幫學員改時間')
  })

  it('T11-7 教練代改期未填原因 → REASON_REQUIRED；學員自己改期未填原因 → 成功', async () => {
    const { bookingId } = await pendingOn(ctx.owner.memberId)
    const target = await slotOf(ctx.owner.memberId, ctx.groupServiceId)
    const { error: ownerErr } = await ctx.owner.client.rpc('reschedule_booking', {
      p_old_booking_id: bookingId,
      p_new_slot_id: target,
    })
    expect(ownerErr?.message).toContain('REASON_REQUIRED')
    expect((await getBooking(bookingId)).status).toBe('pending')

    const { error: custErr } = await ctx.customer.client.rpc('reschedule_booking', {
      p_old_booking_id: bookingId,
      p_new_slot_id: target,
    })
    expect(custErr).toBeNull()
    const old = await getBooking(bookingId)
    expect(old.cancel_category).toBe('rescheduled')
    expect(old.cancel_actor_role).toBe('customer')
    expect(old.cancel_reason).toBeNull()
  })

  it('T11-8 service role 呼叫 cancel／confirm／reschedule：都是 FORBIDDEN', async () => {
    const { bookingId } = await pendingOn(ctx.owner.memberId)
    const target = await slotOf(ctx.owner.memberId, ctx.groupServiceId)
    const { error: e1 } = await admin.rpc('cancel_booking', {
      p_booking_id: bookingId,
      p_reason: '系統',
    })
    const { error: e2 } = await admin.rpc('confirm_booking', { p_booking_id: bookingId })
    const { error: e3 } = await admin.rpc('reschedule_booking', {
      p_old_booking_id: bookingId,
      p_new_slot_id: target,
      p_reason: '系統',
    })
    expect([e1?.message, e2?.message, e3?.message]).toEqual([
      expect.stringContaining('FORBIDDEN'),
      expect.stringContaining('FORBIDDEN'),
      expect.stringContaining('FORBIDDEN'),
    ])
    expect((await getBooking(bookingId)).status).toBe('pending')
  })

  describe('T11-9 歷程的讀取範圍', () => {
    let bookingA: string // 學員在助教 A 的時段
    let bookingB: string // 別的學員在助教 B 的時段
    let closedSlot: string // Owner 的團班時段，被系統以人數不足關閉

    async function visible(client: SupabaseClient<Database>) {
      const { data, error } = await client
        .from('activity_log')
        .select('booking_id, subject_type, subject_id')
        .in('subject_id', [bookingA, bookingB, closedSlot])
      expect(error).toBeNull()
      return {
        A: data!.some((r) => r.booking_id === bookingA),
        B: data!.some((r) => r.booking_id === bookingB),
        slotClosed: data!.some((r) => r.subject_type === 'slot' && r.subject_id === closedSlot),
      }
    }

    beforeAll(async () => {
      const slotA = await slotOf(ctx.staffA.memberId, ctx.soloServiceId)
      bookingA = (
        await book(ctx.customer.client, {
          slotId: slotA,
          customerId: ctx.customer.userId,
          purchaseId: custSoloPurchase,
        })
      ).bookingId
      const slotB = await slotOf(ctx.staffB.memberId, ctx.soloServiceId)
      bookingB = (
        await book(ctx.otherCustomer.client, {
          slotId: slotB,
          customerId: ctx.otherCustomer.userId,
          purchaseId: otherSoloPurchase,
        })
      ).bookingId
      closedSlot = (await pendingOn(ctx.owner.memberId)).slotId
      const { error } = await admin.rpc('auto_cancel_group_slot', { p_slot_id: closedSlot })
      expect(error).toBeNull()
      // 用 service role 確認三者確實都有歷程，下面「查不到」才有意義
      const { data: all } = await admin
        .from('activity_log')
        .select('booking_id, subject_type, subject_id')
        .in('subject_id', [bookingA, bookingB, closedSlot])
      expect(all!.some((r) => r.booking_id === bookingA)).toBe(true)
      expect(all!.some((r) => r.booking_id === bookingB)).toBe(true)
      expect(all!.some((r) => r.subject_type === 'slot' && r.subject_id === closedSlot)).toBe(true)
    }, 60_000)

    it('學員只看得到自己那筆；別的學員看不到', async () => {
      expect(await visible(ctx.customer.client)).toEqual({ A: true, B: false, slotClosed: false })
      expect((await visible(ctx.otherCustomer.client)).A).toBe(false)
    })

    it('助教 A 只看得到自己時段那筆', async () => {
      expect(await visible(ctx.staffA.client)).toEqual({ A: true, B: false, slotClosed: false })
    })

    it('Owner 兩筆都看得到，包含時段關閉紀錄', async () => {
      expect(await visible(ctx.owner.client)).toEqual({ A: true, B: true, slotClosed: true })
    })

    it('平台管理員都看得到（唯讀）', async () => {
      expect(await visible(ctx.platformAdmin.client)).toEqual({
        A: true,
        B: true,
        slotClosed: true,
      })
    })

    it('另一個租戶的 Owner 都看不到', async () => {
      expect(await visible(otherTenantOwner)).toEqual({ A: false, B: false, slotClosed: false })
    })
  })

  it('T11-10 三張新表都不能由登入者寫入（失敗或影響 0 列，且資料不變）', async () => {
    const slotId = await slotOf(ctx.owner.memberId, ctx.soloServiceId)
    const { bookingId } = await book(ctx.customer.client, {
      slotId,
      customerId: ctx.customer.userId,
      purchaseId: custSoloPurchase,
    })
    const activityBefore = await activityFor(bookingId)
    const ledgerBefore = await ledgerRows(custSoloPurchase)
    const { data: settingBefore } = await admin
      .from('platform_settings')
      .select('value, updated_at')
      .eq('key', 'customer_cancel_reasons')
      .single()

    /** 寫入被擋＝有錯誤，或沒有任何一列被影響 */
    const blocked = (r: { data: unknown; error: unknown }) =>
      r.error !== null || (Array.isArray(r.data) && r.data.length === 0)

    const outcomes: Record<string, boolean> = {}
    for (const [who, client] of [
      ['學員', ctx.customer.client],
      ['Owner', ctx.owner.client],
    ] as const) {
      outcomes[`${who} activity_log insert`] = blocked(
        await client
          .from('activity_log')
          .insert({
            tenant_id: ctx.tenantId,
            subject_type: 'booking',
            subject_id: bookingId,
            booking_id: bookingId,
            customer_id: ctx.customer.userId,
            event: 'booking.cancelled',
            actor_role: 'owner',
          })
          .select(),
      )
      outcomes[`${who} activity_log update`] = blocked(
        await client
          .from('activity_log')
          .update({ reason: '竄改' })
          .eq('booking_id', bookingId)
          .select(),
      )
      outcomes[`${who} activity_log delete`] = blocked(
        await client.from('activity_log').delete().eq('booking_id', bookingId).select(),
      )
      outcomes[`${who} class_ledger insert`] = blocked(
        await client
          .from('class_ledger')
          .insert({ purchase_id: custSoloPurchase, delta: 5, reason_code: 'booking' })
          .select(),
      )
      outcomes[`${who} class_ledger update`] = blocked(
        await client
          .from('class_ledger')
          .update({ delta: 5 })
          .eq('purchase_id', custSoloPurchase)
          .select(),
      )
      outcomes[`${who} class_ledger delete`] = blocked(
        await client.from('class_ledger').delete().eq('purchase_id', custSoloPurchase).select(),
      )
      // 寫回同樣的值：萬一真的寫得進去，也不會改變平台設定的內容
      outcomes[`${who} platform_settings update`] = blocked(
        await client
          .from('platform_settings')
          .update({ value: settingBefore!.value })
          .eq('key', 'customer_cancel_reasons')
          .select(),
      )
    }
    expect(Object.entries(outcomes).filter(([, ok]) => !ok)).toEqual([])

    expect(await activityFor(bookingId)).toEqual(activityBefore)
    expect(await ledgerRows(custSoloPurchase)).toEqual(ledgerBefore)
    const { data: settingAfter } = await admin
      .from('platform_settings')
      .select('value, updated_at')
      .eq('key', 'customer_cancel_reasons')
      .single()
    expect(settingAfter).toEqual(settingBefore)
  })

  it('T11-11 輔助函式不可由登入者直接呼叫：權限錯誤，且沒有副作用', async () => {
    const slotId = await slotOf(ctx.owner.memberId, ctx.groupServiceId)
    const { bookingId } = await book(ctx.customer.client, {
      slotId,
      customerId: ctx.customer.userId,
      purchaseId: custGroupPurchase,
    })
    const ledgerBefore = await ledgerRows(custGroupPurchase)
    const activityBefore = await activityFor(bookingId)
    const rpc = rawRpc(ctx.customer.client)

    const results = {
      apply_class_delta: await rpc('apply_class_delta', {
        p_purchase_id: custGroupPurchase,
        p_booking_id: bookingId,
        p_delta: 1,
        p_reason_code: 'cancel_refund',
        p_actor_user_id: ctx.customer.userId,
      }),
      log_activity: await rpc('log_activity', {
        p_tenant_id: ctx.tenantId,
        p_subject_type: 'booking',
        p_subject_id: bookingId,
        p_booking_id: bookingId,
        p_customer_id: ctx.customer.userId,
        p_event: 'booking.cancelled',
        p_actor_user_id: ctx.customer.userId,
        p_actor_role: 'owner',
      }),
      // 回溯區間 0 秒：萬一權限沒關，也不會標記到任何預約
      mark_no_show_bookings: await rpc('mark_no_show_bookings', { p_lookback: '0 seconds' }),
      auto_cancel_group_slot: await rpc('auto_cancel_group_slot', { p_slot_id: slotId }),
    }
    const codes = Object.fromEntries(
      Object.entries(results).map(([fn, r]) => [fn, r.error?.code ?? null]),
    )
    expect(codes).toEqual({
      apply_class_delta: '42501',
      log_activity: '42501',
      mark_no_show_bookings: '42501',
      auto_cancel_group_slot: '42501',
    })

    expect(await ledgerRows(custGroupPurchase)).toEqual(ledgerBefore)
    expect(await activityFor(bookingId)).toEqual(activityBefore)
    expect((await getBooking(bookingId)).status).toBe('pending')
  })

  it('T11-12 平台設定可讀：學員讀得到五個常用取消原因', async () => {
    const { data, error } = await ctx.customer.client
      .from('platform_settings')
      .select('value')
      .eq('key', 'customer_cancel_reasons')
      .single()
    expect(error).toBeNull()
    const reasons = data!.value as unknown
    expect(Array.isArray(reasons)).toBe(true)
    expect(reasons as unknown[]).toHaveLength(5)
    expect((reasons as unknown[]).every((r) => typeof r === 'string' && r.length > 0)).toBe(true)
  })
})
