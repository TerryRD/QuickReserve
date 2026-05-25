import { describe, it, expect } from 'vitest'
import { subtractRanges, effectiveAvailability, type Range } from '@/lib/availability'

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

const TZ_OFFSET_HOURS = 8

// helper: build a Date at given Taipei local time
const tpe = (yyyymmdd: string, hhmm: string): Date => {
  return new Date(`${yyyymmdd}T${hhmm}:00+08:00`)
}

describe('effectiveAvailability', () => {
  it('returns full day when no active template', () => {
    const date = tpe('2026-05-25', '12:00') // 2026-05-25 (Mon) in Taipei
    const result = effectiveAvailability({
      date,
      activeTemplate: null,
      unavailableEvents: [],
      tzOffsetHours: TZ_OFFSET_HOURS,
    })
    expect(result).toHaveLength(1)
    expect(result[0]!.start.toISOString()).toBe('2026-05-24T16:00:00.000Z') // Taipei 00:00 = UTC 16:00 previous day
    expect(result[0]!.end.toISOString()).toBe('2026-05-25T16:00:00.000Z')
  })

  it('uses windows matching weekday from template', () => {
    const date = tpe('2026-05-25', '12:00') // Mon
    const result = effectiveAvailability({
      date,
      activeTemplate: {
        windows: [
          { weekday: 1, start_time: '09:00', end_time: '12:00' },
          { weekday: 1, start_time: '14:00', end_time: '17:00' },
          { weekday: 2, start_time: '09:00', end_time: '17:00' }, // Tue — should be ignored
        ],
      },
      unavailableEvents: [],
      tzOffsetHours: TZ_OFFSET_HOURS,
    })
    expect(result).toHaveLength(2)
    expect(result[0]!.start).toEqual(tpe('2026-05-25', '09:00'))
    expect(result[0]!.end).toEqual(tpe('2026-05-25', '12:00'))
    expect(result[1]!.start).toEqual(tpe('2026-05-25', '14:00'))
    expect(result[1]!.end).toEqual(tpe('2026-05-25', '17:00'))
  })

  it('returns empty array when weekday has no windows', () => {
    const date = tpe('2026-05-30', '12:00') // Sat (ISO weekday 6)
    const result = effectiveAvailability({
      date,
      activeTemplate: {
        windows: [{ weekday: 1, start_time: '09:00', end_time: '17:00' }],
      },
      unavailableEvents: [],
      tzOffsetHours: TZ_OFFSET_HOURS,
    })
    expect(result).toEqual([])
  })

  it('subtracts unavailable events from template windows', () => {
    const date = tpe('2026-05-25', '12:00') // Mon
    const result = effectiveAvailability({
      date,
      activeTemplate: {
        windows: [{ weekday: 1, start_time: '09:00', end_time: '17:00' }],
      },
      unavailableEvents: [
        { start: tpe('2026-05-25', '14:00'), end: tpe('2026-05-25', '15:00') },
      ],
      tzOffsetHours: TZ_OFFSET_HOURS,
    })
    expect(result).toEqual([
      { start: tpe('2026-05-25', '09:00'), end: tpe('2026-05-25', '14:00') },
      { start: tpe('2026-05-25', '15:00'), end: tpe('2026-05-25', '17:00') },
    ])
  })

  it('handles ISO weekday 7 (Sunday)', () => {
    const date = tpe('2026-05-31', '12:00') // Sun
    const result = effectiveAvailability({
      date,
      activeTemplate: {
        windows: [{ weekday: 7, start_time: '10:00', end_time: '14:00' }],
      },
      unavailableEvents: [],
      tzOffsetHours: TZ_OFFSET_HOURS,
    })
    expect(result).toHaveLength(1)
    expect(result[0]!.start).toEqual(tpe('2026-05-31', '10:00'))
    expect(result[0]!.end).toEqual(tpe('2026-05-31', '14:00'))
  })

  it('event spanning past midnight is clipped to current day only', () => {
    const date = tpe('2026-05-25', '12:00')
    const result = effectiveAvailability({
      date,
      activeTemplate: {
        windows: [{ weekday: 1, start_time: '00:00', end_time: '23:59' }],
      },
      unavailableEvents: [
        // Sunday 22:00 → Monday 02:00 — should only cut Mon 00:00 → 02:00
        { start: tpe('2026-05-24', '22:00'), end: tpe('2026-05-25', '02:00') },
      ],
      tzOffsetHours: TZ_OFFSET_HOURS,
    })
    // First survivor starts at Monday 02:00
    expect(result[0]!.start).toEqual(tpe('2026-05-25', '02:00'))
  })
})
