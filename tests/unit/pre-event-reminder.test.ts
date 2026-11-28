import { describe, expect, it } from 'vitest'
import { preEventScheduledFor } from '@/lib/pre-event-reminder'

describe('preEventScheduledFor', () => {
  it('回傳合法時間且為 ISO 格式', () => {
    const x = preEventScheduledFor('2026-11-26T10:00:00+00:00', 30)
    expect(Number.isNaN(new Date(x).getTime())).toBe(false)
    expect(new Date(x).toISOString()).toBe(x)
  })
  it('開課時間往前推提前量分鐘', () => {
    expect(preEventScheduledFor('2026-11-26T10:00:00+00:00', 30)).toBe('2026-11-26T09:30:00.000Z')
  })
  it('同一開課時間、不同提前量得到不同值', () => {
    const start = '2026-11-26T10:00:00+00:00'
    expect(preEventScheduledFor(start, 30)).not.toBe(preEventScheduledFor(start, 60))
  })
  it('同一輸入呼叫兩次得到相同值（排程連續幾分鐘都算到同一個值，去重才會命中）', () => {
    const start = '2026-11-26T10:00:00+00:00'
    expect(preEventScheduledFor(start, 30)).toBe(preEventScheduledFor(start, 30))
  })
  it('開課時間不是合法時間時 throw', () => {
    expect(() => preEventScheduledFor('not-a-date', 30)).toThrow()
  })
})
