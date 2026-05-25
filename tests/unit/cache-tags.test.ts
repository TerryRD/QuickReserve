import { describe, it, expect } from 'vitest'
import { publicSlotsTag } from '@/lib/cache-tags'

describe('publicSlotsTag', () => {
  it('returns deterministic tag for tenantId', () => {
    expect(publicSlotsTag('abc')).toBe('public-slots-abc')
  })

  it('does not lowercase or sanitize — tenantId is already a UUID', () => {
    expect(publicSlotsTag('AbC-123')).toBe('public-slots-AbC-123')
  })

  it('throws on empty tenantId', () => {
    expect(() => publicSlotsTag('')).toThrow(/tenantId/)
  })
})
