import { describe, it, expect } from 'vitest'
import { subtractRanges, type Range } from '@/lib/availability'

const r = (start: string, end: string): Range => ({
  start: new Date(start),
  end: new Date(end),
})

describe('subtractRanges', () => {
  it('returns base when no cuts', () => {
    const base = [r('2026-05-25T09:00:00Z', '2026-05-25T17:00:00Z')]
    expect(subtractRanges(base, [])).toEqual(base)
  })

  it('returns [] when cut fully covers base', () => {
    const base = [r('2026-05-25T09:00:00Z', '2026-05-25T17:00:00Z')]
    const cuts = [r('2026-05-25T08:00:00Z', '2026-05-25T18:00:00Z')]
    expect(subtractRanges(base, cuts)).toEqual([])
  })

  it('cuts middle of base into two ranges', () => {
    const base = [r('2026-05-25T09:00:00Z', '2026-05-25T17:00:00Z')]
    const cuts = [r('2026-05-25T12:00:00Z', '2026-05-25T13:00:00Z')]
    expect(subtractRanges(base, cuts)).toEqual([
      r('2026-05-25T09:00:00Z', '2026-05-25T12:00:00Z'),
      r('2026-05-25T13:00:00Z', '2026-05-25T17:00:00Z'),
    ])
  })

  it('clips leading edge', () => {
    const base = [r('2026-05-25T09:00:00Z', '2026-05-25T17:00:00Z')]
    const cuts = [r('2026-05-25T08:00:00Z', '2026-05-25T10:00:00Z')]
    expect(subtractRanges(base, cuts)).toEqual([r('2026-05-25T10:00:00Z', '2026-05-25T17:00:00Z')])
  })

  it('clips trailing edge', () => {
    const base = [r('2026-05-25T09:00:00Z', '2026-05-25T17:00:00Z')]
    const cuts = [r('2026-05-25T16:00:00Z', '2026-05-25T18:00:00Z')]
    expect(subtractRanges(base, cuts)).toEqual([r('2026-05-25T09:00:00Z', '2026-05-25T16:00:00Z')])
  })

  it('handles multiple cuts in sequence', () => {
    const base = [r('2026-05-25T09:00:00Z', '2026-05-25T17:00:00Z')]
    const cuts = [
      r('2026-05-25T10:00:00Z', '2026-05-25T11:00:00Z'),
      r('2026-05-25T14:00:00Z', '2026-05-25T15:00:00Z'),
    ]
    expect(subtractRanges(base, cuts)).toEqual([
      r('2026-05-25T09:00:00Z', '2026-05-25T10:00:00Z'),
      r('2026-05-25T11:00:00Z', '2026-05-25T14:00:00Z'),
      r('2026-05-25T15:00:00Z', '2026-05-25T17:00:00Z'),
    ])
  })

  it('handles two separate base windows', () => {
    const base = [
      r('2026-05-25T09:00:00Z', '2026-05-25T12:00:00Z'),
      r('2026-05-25T14:00:00Z', '2026-05-25T17:00:00Z'),
    ]
    const cuts = [r('2026-05-25T10:00:00Z', '2026-05-25T15:00:00Z')]
    expect(subtractRanges(base, cuts)).toEqual([
      r('2026-05-25T09:00:00Z', '2026-05-25T10:00:00Z'),
      r('2026-05-25T15:00:00Z', '2026-05-25T17:00:00Z'),
    ])
  })

  it('non-overlapping cut leaves base intact', () => {
    const base = [r('2026-05-25T09:00:00Z', '2026-05-25T12:00:00Z')]
    const cuts = [r('2026-05-25T14:00:00Z', '2026-05-25T15:00:00Z')]
    expect(subtractRanges(base, cuts)).toEqual(base)
  })
})
