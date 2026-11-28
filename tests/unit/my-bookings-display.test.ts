import { describe, it, expect } from 'vitest'
import {
  canCustomerChangeBooking,
  cancelOutcomeText,
  cancelSummaryLine,
  isLegacyCancel,
  resolveMyBookingsView,
} from '@/app/(customer)/my-bookings/booking-display'
import { FORBIDDEN_TERMS } from '@/lib/booking-terms'

describe('canCustomerChangeBooking', () => {
  const now = new Date('2026-12-01T00:00:00Z')
  it('待確認／已確認且尚未開課才可以', () => {
    expect(canCustomerChangeBooking('pending', '2026-12-01T00:00:01Z', now)).toBe(true)
    expect(canCustomerChangeBooking('confirmed', '2026-12-02T00:00:00Z', now)).toBe(true)
  })
  it('開課時間等於現在或已過、或其他狀態、或沒有時段都不行', () => {
    expect(canCustomerChangeBooking('confirmed', '2026-12-01T00:00:00Z', now)).toBe(false)
    expect(canCustomerChangeBooking('confirmed', '2026-11-30T00:00:00Z', now)).toBe(false)
    expect(canCustomerChangeBooking('cancelled', '2026-12-02T00:00:00Z', now)).toBe(false)
    expect(canCustomerChangeBooking('completed', '2026-12-02T00:00:00Z', now)).toBe(false)
    expect(canCustomerChangeBooking('pending', null, now)).toBe(false)
  })
})

describe('已取消卡片說明', () => {
  const base = { reason: null, actorRole: null, disposition: null }

  it('學員自己取消寫「你取消」並帶原因', () => {
    expect(
      cancelSummaryLine({ ...base, category: 'customer', actorRole: 'customer', reason: '工作' }),
    ).toBe('你取消 · 原因：工作')
  })

  it('教練取消、教練拒絕、人數不足用用語表', () => {
    expect(
      cancelSummaryLine({ ...base, category: 'coach_cancelled', reason: '場地臨時整修' }),
    ).toBe('教練取消 · 原因：場地臨時整修')
    expect(cancelSummaryLine({ ...base, category: 'coach_rejected', reason: '有事' })).toBe(
      '教練拒絕 · 原因：有事',
    )
    expect(cancelSummaryLine({ ...base, category: 'under_min' })).toBe('人數不足')
  })

  it('改期依操作人區分，學員端不出現 Owner／助教', () => {
    expect(cancelSummaryLine({ ...base, category: 'rescheduled', actorRole: 'customer' })).toBe(
      '你改期',
    )
    expect(cancelSummaryLine({ ...base, category: 'rescheduled', actorRole: 'staff' })).toBe(
      '教練改期',
    )
    expect(cancelSummaryLine({ ...base, category: 'rescheduled', actorRole: 'owner' })).toBe(
      '教練改期',
    )
  })

  it('原因只有空白時不顯示「原因：」', () => {
    expect(cancelSummaryLine({ ...base, category: 'coach_cancelled', reason: '  \n ' })).toBe(
      '教練取消',
    )
  })

  it('改版前取消、沒有類別、或無法辨識的類別不顯示說明', () => {
    expect(cancelSummaryLine({ ...base, category: 'legacy', reason: '舊原因' })).toBeNull()
    expect(cancelSummaryLine({ ...base, category: null })).toBeNull()
    expect(cancelSummaryLine({ ...base, category: 'something_else' })).toBeNull()
    expect(isLegacyCancel('legacy')).toBe(true)
    expect(isLegacyCancel(null)).toBe(true)
    expect(isLegacyCancel('customer')).toBe(false)
  })

  it('堂數結果：已退回 1 堂／不退回／已改期；改版前只寫已取消', () => {
    expect(cancelOutcomeText({ category: 'coach_cancelled', disposition: 'refunded' })).toBe(
      '已退回 1 堂',
    )
    expect(cancelOutcomeText({ category: 'customer', disposition: 'forfeited' })).toBe('不退回')
    expect(cancelOutcomeText({ category: 'rescheduled', disposition: 'transferred' })).toBe(
      '已改期',
    )
    expect(cancelOutcomeText({ category: 'legacy', disposition: 'refunded' })).toBe('已取消')
    expect(cancelOutcomeText({ category: null, disposition: null })).toBe('已取消')
  })

  it('產出的文字不含禁用詞與「退還」', () => {
    const texts = [
      cancelSummaryLine({ ...base, category: 'customer' }),
      cancelOutcomeText({ category: 'customer', disposition: 'refunded' }),
      cancelOutcomeText({ category: 'customer', disposition: 'forfeited' }),
    ].join('\n')
    for (const term of [...FORBIDDEN_TERMS, '退還']) expect(texts).not.toContain(term)
  })
})

describe('resolveMyBookingsView', () => {
  const ok = { count: 2, error: null }
  const rows = [{ id: 'a' }]
  it('全部成功：回傳清單與計數（0 也是合法結果）', () => {
    const view = resolveMyBookingsView({
      bookings: { data: rows, error: null },
      pending: ok,
      completed: { count: 0, error: null },
      cancelled: ok,
    })
    expect(view).toEqual({
      ok: true,
      bookings: rows,
      pendingCount: 2,
      completedCount: 0,
      cancelledCount: 2,
    })
  })
  it('沒有預約是合法的空清單', () => {
    const view = resolveMyBookingsView({
      bookings: { data: [], error: null },
      pending: { count: 0, error: null },
      completed: { count: 0, error: null },
      cancelled: { count: 0, error: null },
    })
    expect(view.ok).toBe(true)
  })
  it('主查詢失敗：不得變成空清單', () => {
    const error = { message: 'boom' }
    const view = resolveMyBookingsView({
      bookings: { data: null, error },
      pending: ok,
      completed: ok,
      cancelled: ok,
    })
    expect(view).toEqual({ ok: false, failures: [{ query: 'bookings', error }] })
  })
  it('主查詢有錯誤但仍帶資料，也視為失敗', () => {
    const view = resolveMyBookingsView({
      bookings: { data: rows, error: { message: 'x' } },
      pending: ok,
      completed: ok,
      cancelled: ok,
    })
    expect(view.ok).toBe(false)
  })
  it('任一計數查詢失敗或沒有回傳數字：不得顯示 0', () => {
    for (const key of ['pending', 'completed', 'cancelled'] as const) {
      const failed = {
        ...{ pending: ok, completed: ok, cancelled: ok },
        [key]: { count: null, error: { message: 'x' } },
      }
      const view = resolveMyBookingsView({ bookings: { data: rows, error: null }, ...failed })
      expect(view.ok).toBe(false)
      if (!view.ok) expect(view.failures.map((f) => f.query)).toEqual([`${key} count`])
    }
    const noCount = resolveMyBookingsView({
      bookings: { data: rows, error: null },
      pending: { count: null, error: null },
      completed: ok,
      cancelled: ok,
    })
    expect(noCount.ok).toBe(false)
  })
  it('多個查詢同時失敗時全部列出', () => {
    const view = resolveMyBookingsView({
      bookings: { data: null, error: { message: 'a' } },
      pending: { count: null, error: { message: 'b' } },
      completed: ok,
      cancelled: ok,
    })
    expect(view.ok).toBe(false)
    if (!view.ok) expect(view.failures).toHaveLength(2)
  })
})
