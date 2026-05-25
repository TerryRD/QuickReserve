import { describe, it, expect } from 'vitest'
import { isActivePurchase, type CustomerPurchase } from '@/lib/purchases'

const base: CustomerPurchase = {
  id: 'p1',
  approval_status: 'confirmed',
  classes_total: 10,
  classes_used: 0,
  expires_at: null,
}

const now = new Date('2026-06-01T00:00:00Z')

describe('isActivePurchase', () => {
  it('returns true for confirmed + remaining + never expires', () => {
    expect(isActivePurchase(base, now)).toBe(true)
  })

  it('returns false when not yet confirmed', () => {
    expect(isActivePurchase({ ...base, approval_status: 'pending_review' }, now)).toBe(false)
  })

  it('returns false when rejected', () => {
    expect(isActivePurchase({ ...base, approval_status: 'rejected' }, now)).toBe(false)
  })

  it('returns false when classes exhausted', () => {
    expect(isActivePurchase({ ...base, classes_used: 10 }, now)).toBe(false)
  })

  it('returns true when classes partially used but balance remains', () => {
    expect(isActivePurchase({ ...base, classes_used: 3 }, now)).toBe(true)
  })

  it('returns false when expired', () => {
    expect(
      isActivePurchase({ ...base, expires_at: '2026-05-30T00:00:00Z' }, now),
    ).toBe(false)
  })

  it('returns true when expires_at in future', () => {
    expect(
      isActivePurchase({ ...base, expires_at: '2026-06-10T00:00:00Z' }, now),
    ).toBe(true)
  })

  it('returns false at exact expiration moment', () => {
    expect(
      isActivePurchase({ ...base, expires_at: '2026-06-01T00:00:00Z' }, now),
    ).toBe(false)
  })
})
