import { describe, expect, it } from 'vitest'
import { isExclusionViolation } from '@/lib/conflicts'

describe('isExclusionViolation', () => {
  it('returns true for Postgres 23P01 errors', () => {
    expect(
      isExclusionViolation({
        code: '23P01',
        message: 'conflicting key value violates exclusion constraint',
      }),
    ).toBe(true)
  })

  it('returns false for other errors', () => {
    expect(isExclusionViolation({ code: '23505', message: 'duplicate key' })).toBe(false)
    expect(isExclusionViolation(null)).toBe(false)
    expect(isExclusionViolation(undefined)).toBe(false)
    expect(isExclusionViolation({ message: 'random' })).toBe(false)
  })
})
