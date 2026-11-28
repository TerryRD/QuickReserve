import { describe, expect, it } from 'vitest'
import { isWithinCancelDeadline, willCustomerCancelRefund } from '@/lib/cancel-deadline'

const start = '2026-06-13T12:00:00.000Z'

describe('isWithinCancelDeadline', () => {
  it('true well before the cutoff (24h deadline)', () => {
    // cutoff = start - 24h = 2026-06-12T12:00; now earlier => within
    expect(isWithinCancelDeadline(new Date('2026-06-12T08:00:00.000Z'), start, 24)).toBe(true)
  })
  it('true exactly at the cutoff', () => {
    expect(isWithinCancelDeadline(new Date('2026-06-12T12:00:00.000Z'), start, 24)).toBe(true)
  })
  it('false one second after the cutoff', () => {
    expect(isWithinCancelDeadline(new Date('2026-06-12T12:00:01.000Z'), start, 24)).toBe(false)
  })
  it('deadline 0 means refund allowed right up to start', () => {
    expect(isWithinCancelDeadline(new Date('2026-06-13T11:59:59.000Z'), start, 0)).toBe(true)
    expect(isWithinCancelDeadline(new Date('2026-06-13T12:00:01.000Z'), start, 0)).toBe(false)
  })
})

describe('willCustomerCancelRefund', () => {
  // 預約上存的取消期限：開課前 24 小時
  const deadline = '2026-06-12T12:00:00.000Z'

  it('待確認的預約即使已過取消期限也退回', () => {
    const now = new Date('2026-06-13T10:00:00.000Z')
    const b = { status: 'pending', cancelDeadlineAt: deadline, startAt: start, deadlineHours: 24 }
    expect(willCustomerCancelRefund(now, b)).toBe(true)
  })
  it('已確認且剛好等於取消期限 → 退回', () => {
    const b = { status: 'confirmed', cancelDeadlineAt: deadline, startAt: start, deadlineHours: 24 }
    expect(willCustomerCancelRefund(new Date(deadline), b)).toBe(true)
  })
  it('已確認且超過取消期限 1 毫秒 → 不退回', () => {
    const b = { status: 'confirmed', cancelDeadlineAt: deadline, startAt: start, deadlineHours: 24 }
    expect(willCustomerCancelRefund(new Date('2026-06-12T12:00:00.001Z'), b)).toBe(false)
  })
  it('以預約上存的期限為準，不受目前服務時數影響', () => {
    // 服務時數已改成 2 小時，但預約上存的期限仍是開課前 24 小時
    const b = { status: 'confirmed', cancelDeadlineAt: deadline, startAt: start, deadlineHours: 2 }
    expect(willCustomerCancelRefund(new Date('2026-06-13T08:00:00.000Z'), b)).toBe(false)
  })
  it('預約上沒有期限時，用開課時間減時數推算', () => {
    const b = { status: 'confirmed', cancelDeadlineAt: null, startAt: start, deadlineHours: 24 }
    expect(willCustomerCancelRefund(new Date('2026-06-12T12:00:00.000Z'), b)).toBe(true)
    expect(willCustomerCancelRefund(new Date('2026-06-12T12:00:00.001Z'), b)).toBe(false)
  })
})
