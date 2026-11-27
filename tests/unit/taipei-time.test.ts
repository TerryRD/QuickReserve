import { afterAll, describe, expect, it } from 'vitest'
import {
  formatTaipeiDate,
  formatTaipeiDateTime,
  formatTaipeiMonthDayTime,
  formatTaipeiShortMonthDayTime,
  formatTaipeiSlotRange,
  formatTaipeiTime,
  taipeiDateKey,
  taipeiDayStart,
  taipeiParts,
} from '@/lib/taipei-time'

const ORIGINAL_TZ = process.env.TZ

function allFormats() {
  return [
    formatTaipeiDateTime('2026-12-03T11:00:00Z'),
    formatTaipeiDateTime('2026-12-03T11:00:00Z', { withYear: true }),
    formatTaipeiMonthDayTime('2026-12-01T16:05:00Z'),
    formatTaipeiShortMonthDayTime('2026-12-01T16:05:00Z'),
    formatTaipeiTime('2026-12-01T16:05:00Z'),
    formatTaipeiSlotRange('2026-12-06T06:00:00Z', '2026-12-06T07:30:00Z'),
  ]
}

describe('台灣時間格式', () => {
  afterAll(() => {
    if (ORIGINAL_TZ === undefined) delete process.env.TZ
    else process.env.TZ = ORIGINAL_TZ
  })

  it('日期時間：例 12/03（四）19:00，可加年份', () => {
    // 2026-12-03 11:00Z = 台灣 12/03（四）19:00
    expect(formatTaipeiDateTime('2026-12-03T11:00:00Z')).toBe('12/03（四）19:00')
    expect(formatTaipeiDateTime('2026-12-03T11:00:00Z', { withYear: true })).toBe(
      '2026/12/03（四）19:00',
    )
    expect(formatTaipeiDateTime('2026-12-01T13:14:00Z', { withYear: true })).toBe(
      '2026/12/01（二）21:14',
    )
  })

  it('跨日、跨年：UTC 前一天 16:00 是台灣隔天 00:00', () => {
    expect(formatTaipeiDateTime('2026-12-01T16:00:00Z')).toBe('12/02（三）00:00')
    expect(formatTaipeiDateTime('2026-12-31T16:00:00Z', { withYear: true })).toBe(
      '2027/01/01（五）00:00',
    )
  })

  it('時分、月日時分', () => {
    expect(formatTaipeiTime('2026-12-01T16:05:00Z')).toBe('00:05')
    expect(formatTaipeiMonthDayTime('2026-11-28T02:02:00Z')).toBe('11/28 10:02')
  })

  it('月日不補零的月日時分：例 12/2 19:00', () => {
    expect(formatTaipeiShortMonthDayTime('2026-12-02T11:00:00Z')).toBe('12/2 19:00')
    // 台灣已跨日：UTC 16:05 是隔天 00:05
    expect(formatTaipeiShortMonthDayTime('2026-01-04T16:05:00Z')).toBe('1/5 00:05')
  })

  it('時段區間：例 2026/12/06（日）14:00–15:30', () => {
    expect(formatTaipeiSlotRange('2026-12-06T06:00:00Z', '2026-12-06T07:30:00Z')).toBe(
      '2026/12/06（日）14:00–15:30',
    )
  })

  it('拆出年月日時分與星期', () => {
    expect(taipeiParts('2026-12-01T16:05:00Z')).toEqual({
      year: 2026,
      month: 12,
      day: 2,
      hour: 0,
      minute: 5,
      weekday: '三',
    })
    expect(taipeiParts(new Date('2026-12-03T11:00:00Z')).weekday).toBe('四')
  })

  it('無法辨識的時間丟出錯誤，不回傳假的時間', () => {
    expect(() => formatTaipeiDateTime('not-a-date')).toThrow(RangeError)
  })

  it('不論執行環境的時區為何，結果都相同', () => {
    const expected = [
      '12/03（四）19:00',
      '2026/12/03（四）19:00',
      '12/02 00:05',
      '12/2 00:05',
      '00:05',
      '2026/12/06（日）14:00–15:30',
    ]
    for (const tz of ['Asia/Taipei', 'UTC', 'America/New_York', 'Pacific/Kiritimati']) {
      process.env.TZ = tz
      expect(allFormats(), tz).toEqual(expected)
    }
  })
})

describe('台灣日期與日界', () => {
  afterAll(() => {
    if (ORIGINAL_TZ === undefined) delete process.env.TZ
    else process.env.TZ = ORIGINAL_TZ
  })

  it('台灣日期：UTC 前一天 16:00 起算是台灣隔天', () => {
    expect(taipeiDateKey('2026-12-01T16:00:00Z')).toBe('2026-12-02')
    expect(taipeiDateKey('2026-12-01T15:59:59Z')).toBe('2026-12-01')
    expect(taipeiDateKey(new Date('2026-12-31T16:00:00Z'))).toBe('2027-01-01')
  })

  it('台灣該日 00:00 的時間點', () => {
    expect(taipeiDayStart('2026-12-02')).toEqual(new Date('2026-12-01T16:00:00.000Z'))
    expect(taipeiDayStart('2027-01-01')).toEqual(new Date('2026-12-31T16:00:00.000Z'))
    expect(taipeiDayStart('2028-02-29')).toEqual(new Date('2028-02-28T16:00:00.000Z'))
  })

  it('日期格式不對或日期不存在時丟出錯誤', () => {
    for (const bad of ['2026-02-30', '2026-13-40', '2026-12-2', '2026/12/02', '', 'abc']) {
      expect(() => taipeiDayStart(bad), bad).toThrow(RangeError)
    }
    expect(() => taipeiDateKey('not-a-date')).toThrow(RangeError)
    expect(() => formatTaipeiDate('not-a-date')).toThrow(RangeError)
  })

  it('只有日期：例 2026/12/02', () => {
    expect(formatTaipeiDate('2026-12-01T16:00:00Z')).toBe('2026/12/02')
    expect(formatTaipeiDate(new Date('2026-12-01T15:59:59Z'))).toBe('2026/12/01')
  })

  it('不論執行環境的時區為何，結果都相同', () => {
    for (const tz of ['Asia/Taipei', 'UTC', 'America/New_York', 'Pacific/Kiritimati']) {
      process.env.TZ = tz
      expect(
        [
          taipeiDateKey('2026-12-01T16:00:00Z'),
          taipeiDateKey('2026-12-01T15:59:59Z'),
          taipeiDayStart('2026-12-02').toISOString(),
          formatTaipeiDate('2026-12-01T16:00:00Z'),
        ],
        tz,
      ).toEqual(['2026-12-02', '2026-12-01', '2026-12-01T16:00:00.000Z', '2026/12/02'])
    }
  })
})
