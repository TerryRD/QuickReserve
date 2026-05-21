import { describe, expect, it } from 'vitest'
import { computeOccurrences, type RecurringRuleInput } from '@/lib/recurrence'

// Helper to build occurrences in zh-TW (UTC+8) and compare against expected dates
function localToIso(date: string, time: string): string {
  return new Date(`${date}T${time}+08:00`).toISOString()
}

describe('computeOccurrences - daily', () => {
  it('emits daily occurrences within window', () => {
    const rule: RecurringRuleInput = {
      freq: 'daily',
      interval_n: 1,
      by_weekday: null,
      by_month_day: null,
      start_date: '2026-06-01',
      start_time: '19:00:00',
      end_time: '20:00:00',
      end_condition: 'count',
      end_count: 3,
      end_until: null,
    }
    const result = computeOccurrences(rule, new Date('2026-06-01T00:00:00+08:00'), new Date('2026-06-10T00:00:00+08:00'))
    expect(result).toHaveLength(3)
    expect(result.map((o) => o.startAt)).toEqual([
      localToIso('2026-06-01', '19:00:00'),
      localToIso('2026-06-02', '19:00:00'),
      localToIso('2026-06-03', '19:00:00'),
    ])
  })

  it('honors interval_n (every 3 days)', () => {
    const rule: RecurringRuleInput = {
      freq: 'every_n_days',
      interval_n: 3,
      by_weekday: null,
      by_month_day: null,
      start_date: '2026-06-01',
      start_time: '09:00:00',
      end_time: '10:00:00',
      end_condition: 'count',
      end_count: 3,
      end_until: null,
    }
    const result = computeOccurrences(rule, new Date('2026-06-01T00:00:00+08:00'), new Date('2026-06-30T00:00:00+08:00'))
    expect(result.map((o) => o.startAt)).toEqual([
      localToIso('2026-06-01', '09:00:00'),
      localToIso('2026-06-04', '09:00:00'),
      localToIso('2026-06-07', '09:00:00'),
    ])
  })
})

describe('computeOccurrences - weekly', () => {
  it('emits on selected weekdays only', () => {
    // 2026-06-01 is a Monday (ISO 1)
    const rule: RecurringRuleInput = {
      freq: 'weekly',
      interval_n: 1,
      by_weekday: [2, 4], // Tue, Thu
      by_month_day: null,
      start_date: '2026-06-01',
      start_time: '19:00:00',
      end_time: '21:00:00',
      end_condition: 'count',
      end_count: 4,
      end_until: null,
    }
    const result = computeOccurrences(rule, new Date('2026-06-01T00:00:00+08:00'), new Date('2026-06-30T00:00:00+08:00'))
    expect(result.map((o) => o.startAt)).toEqual([
      localToIso('2026-06-02', '19:00:00'), // Tue
      localToIso('2026-06-04', '19:00:00'), // Thu
      localToIso('2026-06-09', '19:00:00'), // Tue
      localToIso('2026-06-11', '19:00:00'), // Thu
    ])
  })

  it('honors interval_n (every 2 weeks)', () => {
    const rule: RecurringRuleInput = {
      freq: 'weekly',
      interval_n: 2,
      by_weekday: [6], // Sat
      by_month_day: null,
      start_date: '2026-06-01',
      start_time: '14:00:00',
      end_time: '16:00:00',
      end_condition: 'count',
      end_count: 3,
      end_until: null,
    }
    // Week containing 2026-06-01 is week 0; Saturday is 2026-06-06
    // Next Saturday in 2 weeks: 2026-06-20, then 2026-07-04
    const result = computeOccurrences(rule, new Date('2026-06-01T00:00:00+08:00'), new Date('2026-08-01T00:00:00+08:00'))
    expect(result.map((o) => o.startAt)).toEqual([
      localToIso('2026-06-06', '14:00:00'),
      localToIso('2026-06-20', '14:00:00'),
      localToIso('2026-07-04', '14:00:00'),
    ])
  })
})

describe('computeOccurrences - monthly', () => {
  it('emits on specified day of month', () => {
    const rule: RecurringRuleInput = {
      freq: 'monthly',
      interval_n: 1,
      by_weekday: null,
      by_month_day: 15,
      start_date: '2026-06-01',
      start_time: '10:00:00',
      end_time: '11:00:00',
      end_condition: 'count',
      end_count: 3,
      end_until: null,
    }
    const result = computeOccurrences(rule, new Date('2026-06-01T00:00:00+08:00'), new Date('2026-12-31T00:00:00+08:00'))
    expect(result.map((o) => o.startAt)).toEqual([
      localToIso('2026-06-15', '10:00:00'),
      localToIso('2026-07-15', '10:00:00'),
      localToIso('2026-08-15', '10:00:00'),
    ])
  })

  it('skips months where day-of-month is invalid (Feb 30)', () => {
    const rule: RecurringRuleInput = {
      freq: 'monthly',
      interval_n: 1,
      by_weekday: null,
      by_month_day: 30,
      start_date: '2026-01-01',
      start_time: '10:00:00',
      end_time: '11:00:00',
      end_condition: 'count',
      end_count: 3,
      end_until: null,
    }
    const result = computeOccurrences(rule, new Date('2026-01-01T00:00:00+08:00'), new Date('2026-12-31T00:00:00+08:00'))
    // Jan 30, [skip Feb], Mar 30, Apr 30 → first 3 occurrences
    expect(result.map((o) => o.startAt)).toEqual([
      localToIso('2026-01-30', '10:00:00'),
      localToIso('2026-03-30', '10:00:00'),
      localToIso('2026-04-30', '10:00:00'),
    ])
  })
})

describe('computeOccurrences - end conditions', () => {
  it('honors end_condition=until', () => {
    const rule: RecurringRuleInput = {
      freq: 'daily',
      interval_n: 1,
      by_weekday: null,
      by_month_day: null,
      start_date: '2026-06-01',
      start_time: '08:00:00',
      end_time: '09:00:00',
      end_condition: 'until',
      end_count: null,
      end_until: '2026-06-03',
    }
    const result = computeOccurrences(rule, new Date('2026-06-01T00:00:00+08:00'), new Date('2026-06-30T00:00:00+08:00'))
    expect(result).toHaveLength(3) // Jun 1, 2, 3
  })

  it('honors end_condition=none and clips by window', () => {
    const rule: RecurringRuleInput = {
      freq: 'daily',
      interval_n: 1,
      by_weekday: null,
      by_month_day: null,
      start_date: '2026-06-01',
      start_time: '08:00:00',
      end_time: '09:00:00',
      end_condition: 'none',
      end_count: null,
      end_until: null,
    }
    const result = computeOccurrences(rule, new Date('2026-06-01T00:00:00+08:00'), new Date('2026-06-05T00:00:00+08:00'))
    expect(result).toHaveLength(5) // Jun 1, 2, 3, 4, 5
  })
})
