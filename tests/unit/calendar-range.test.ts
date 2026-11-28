import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  addDaysKey,
  calendarRange,
  monthStartKey,
  weekStartKey,
} from '@/app/(tenant)/calendar/calendar-range'

const ORIGINAL_TZ = process.env.TZ

// 每種執行環境時區的實際位移（分鐘，getTimezoneOffset 的正負號與 UTC 位移相反）
const ZONES = [
  { tz: 'Asia/Taipei', offset: -480 },
  { tz: 'UTC', offset: 0 },
] as const

describe.each(ZONES)('行事曆日期範圍（執行環境時區 $tz）', ({ tz, offset }) => {
  beforeAll(() => {
    process.env.TZ = tz
  })

  afterAll(() => {
    if (ORIGINAL_TZ === undefined) delete process.env.TZ
    else process.env.TZ = ORIGINAL_TZ
  })

  it('確實切到這個時區', () => {
    expect(new Date('2026-12-02T04:00:00Z').getTimezoneOffset()).toBe(offset)
  })

  it('加減天數：跨月、跨年、閏年', () => {
    expect(addDaysKey('2026-11-30', 1)).toBe('2026-12-01')
    expect(addDaysKey('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDaysKey('2027-01-01', -1)).toBe('2026-12-31')
    expect(addDaysKey('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDaysKey('2026-12-02', 0)).toBe('2026-12-02')
    expect(addDaysKey('2026-11-29', 42)).toBe('2027-01-10')
  })

  it('週的第一天：週一或週日起算', () => {
    // 2026-12-02 是週三
    expect(weekStartKey('2026-12-02', 1)).toBe('2026-11-30')
    expect(weekStartKey('2026-12-02', 0)).toBe('2026-11-29')
    // 週日本身：週一起算要退回前一個週一
    expect(weekStartKey('2026-12-06', 1)).toBe('2026-11-30')
    expect(weekStartKey('2026-12-06', 0)).toBe('2026-12-06')
    // 週一本身
    expect(weekStartKey('2026-11-30', 1)).toBe('2026-11-30')
    // 跨年
    expect(weekStartKey('2027-01-01', 1)).toBe('2026-12-28')
  })

  it('月的第一天', () => {
    expect(monthStartKey('2026-12-31')).toBe('2026-12-01')
    expect(monthStartKey('2027-01-01')).toBe('2027-01-01')
  })

  it('台灣週一 00:30（UTC 還是週日）算的是台灣這一週', () => {
    const r = calendarRange({
      weekParam: undefined,
      now: new Date('2026-11-29T16:30:00Z'),
      view: 'week',
    })
    expect(r.weekStartKey).toBe('2026-11-30')
    expect(r.weekEndKey).toBe('2026-12-06')
    expect(r.prevWeekKey).toBe('2026-11-23')
    expect(r.nextWeekKey).toBe('2026-12-07')
    expect(r.monthStartKey).toBe('2026-11-01')
    expect(r.fetchStart.toISOString()).toBe('2026-11-29T16:00:00.000Z')
    expect(r.fetchEndExclusive.toISOString()).toBe('2026-12-06T16:00:00.000Z')
  })

  it('清單檢視與週檢視抓同一週', () => {
    const r = calendarRange({
      weekParam: '2026-12-02',
      now: new Date('2026-01-01T00:00:00Z'),
      view: 'list',
    })
    expect(r.weekStartKey).toBe('2026-11-30')
    expect(r.fetchStart.toISOString()).toBe('2026-11-29T16:00:00.000Z')
    expect(r.fetchEndExclusive.toISOString()).toBe('2026-12-06T16:00:00.000Z')
  })

  it('月檢視：從月初當天或之前的週日起，抓滿 42 天', () => {
    const r = calendarRange({ weekParam: '2026-12-15', now: new Date(), view: 'month' })
    expect(r.monthStartKey).toBe('2026-12-01')
    // 2026-12-01 是週二 → 格子從 11/29（日）開始
    expect(r.gridStartKey).toBe('2026-11-29')
    expect(r.fetchStart.toISOString()).toBe('2026-11-28T16:00:00.000Z')
    // 11/29 + 42 天 = 2027-01-10
    expect(r.fetchEndExclusive.toISOString()).toBe('2027-01-09T16:00:00.000Z')
    expect(r.fetchEndExclusive.getTime() - r.fetchStart.getTime()).toBe(42 * 86400000)
  })

  it('月初剛好是週日時，格子就從月初開始', () => {
    // 2026-11-01 是週日
    const r = calendarRange({ weekParam: '2026-11-20', now: new Date(), view: 'month' })
    expect(r.gridStartKey).toBe('2026-11-01')
  })

  it('台灣月初 00:30 的月檢視算的是台灣這個月', () => {
    const r = calendarRange({
      weekParam: undefined,
      now: new Date('2026-11-30T16:30:00Z'), // 台灣 12/01 00:30
      view: 'month',
    })
    expect(r.monthStartKey).toBe('2026-12-01')
  })

  it('週參數不合法或沒給時，退回台灣的今天', () => {
    const now = new Date('2026-12-01T20:00:00Z') // 台灣 12/02（三）04:00
    for (const weekParam of [undefined, '', '2026-13-40', '2026-02-30', 'abc', '2026-12-2']) {
      const r = calendarRange({ weekParam, now, view: 'week' })
      expect(r.weekStartKey, String(weekParam)).toBe('2026-11-30')
    }
  })
})
