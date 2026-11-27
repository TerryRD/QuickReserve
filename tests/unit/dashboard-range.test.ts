import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { dashboardRange } from '@/app/(tenant)/dashboard/dashboard-range'

const ORIGINAL_TZ = process.env.TZ

// 每種執行環境時區的實際位移（分鐘，getTimezoneOffset 的正負號與 UTC 位移相反）
const ZONES = [
  { tz: 'Asia/Taipei', offset: -480 },
  { tz: 'UTC', offset: 0 },
] as const

describe.each(ZONES)('儀表板統計範圍（執行環境時區 $tz）', ({ tz, offset }) => {
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

  it('台灣 12/01 00:30（UTC 還是 11/30）算的是台灣的今天與本月', () => {
    const r = dashboardRange(new Date('2026-11-30T16:30:00Z'))
    expect(r.todayStart).toBe('2026-11-30T16:00:00.000Z')
    expect(r.tomorrowStart).toBe('2026-12-01T16:00:00.000Z')
    expect(r.weekEnd).toBe('2026-12-07T16:00:00.000Z')
    expect(r.monthStart).toBe('2026-11-30T16:00:00.000Z')
  })

  it('台灣 11/30 23:59 仍算 11 月', () => {
    const r = dashboardRange(new Date('2026-11-30T15:59:00Z'))
    expect(r.todayStart).toBe('2026-11-29T16:00:00.000Z')
    expect(r.monthStart).toBe('2026-10-31T16:00:00.000Z')
  })

  it('跨年：台灣 2027/01/01 00:30 算的是 2027 年 1 月', () => {
    const r = dashboardRange(new Date('2026-12-31T16:30:00Z'))
    expect(r.todayStart).toBe('2026-12-31T16:00:00.000Z')
    expect(r.tomorrowStart).toBe('2027-01-01T16:00:00.000Z')
    expect(r.weekEnd).toBe('2027-01-07T16:00:00.000Z')
    expect(r.monthStart).toBe('2026-12-31T16:00:00.000Z')
  })
})
