import { describe, expect, it } from 'vitest'
import { isWithinCancelDeadline } from '@/lib/cancel-deadline'

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
