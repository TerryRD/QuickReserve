// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { cancelSummary, statusLabel } from '@/app/(tenant)/bookings/booking-display'
import { canActOnBooking } from '@/app/(tenant)/bookings/booking-access'

describe('教練端預約顯示規則', () => {
  it('狀態標籤取自用語表，含未出席', () => {
    expect(statusLabel('completed')).toBe('已出席')
    expect(statusLabel('no_show')).toBe('未出席')
    expect(statusLabel('weird')).toBe('其他')
  })

  it('已取消摘要：類別 · 堂數處理 · 原因', () => {
    expect(
      cancelSummary({
        cancel_category: 'coach_cancelled',
        cancel_reason: '場地臨時整修',
        class_disposition: 'refunded',
      }),
    ).toBe('教練取消 · 已退回 1 堂 · 原因：場地臨時整修')
    expect(
      cancelSummary({
        cancel_category: 'customer',
        cancel_reason: '工作',
        class_disposition: 'forfeited',
      }),
    ).toBe('學員取消 · 不退回 · 原因：工作')
    expect(
      cancelSummary({
        cancel_category: 'rescheduled',
        cancel_reason: null,
        class_disposition: 'transferred',
      }),
    ).toBe('改期 · 已轉到新預約')
  })

  it('原因過長時截斷', () => {
    const summary = cancelSummary({
      cancel_category: 'coach_rejected',
      cancel_reason: '長'.repeat(100),
      class_disposition: 'refunded',
    })!
    expect(summary.endsWith('…')).toBe(true)
    expect(summary.length).toBeLessThan(80)
  })

  it('舊資料只寫類別；沒有類別時不顯示', () => {
    expect(
      cancelSummary({ cancel_category: 'legacy', cancel_reason: 'x', class_disposition: null }),
    ).toBe('舊資料（未分類）')
    expect(
      cancelSummary({ cancel_category: null, cancel_reason: null, class_disposition: null }),
    ).toBeNull()
  })
})

describe('canActOnBooking（助教操作範圍）', () => {
  it('Owner 可操作所有時段', () => {
    expect(canActOnBooking({ role: 'tenant_owner', memberId: 'm-owner' }, 'm-other')).toBe(true)
  })
  it('助教只能操作自己的時段', () => {
    expect(canActOnBooking({ role: 'tenant_staff', memberId: 'm-1' }, 'm-1')).toBe(true)
    expect(canActOnBooking({ role: 'tenant_staff', memberId: 'm-1' }, 'm-2')).toBe(false)
    expect(canActOnBooking({ role: 'tenant_staff', memberId: 'm-1' }, null)).toBe(false)
  })
  it('非成員一律不可操作', () => {
    expect(canActOnBooking({ role: 'customer', memberId: null }, null)).toBe(false)
  })
})
