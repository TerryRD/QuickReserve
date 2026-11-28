import { describe, expect, it } from 'vitest'
import {
  NOTIFICATION_EVENTS,
  isLatestUnreadOnly,
  notificationLabel,
  toInAppUrl,
} from '@/lib/notification-events'

describe('NOTIFICATION_EVENTS', () => {
  it('鍵不重複', () => {
    const keys = NOTIFICATION_EVENTS.map((e) => e.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('每一筆都有名稱，且至少一個收件對象', () => {
    for (const e of NOTIFICATION_EVENTS) {
      expect(e.label.trim()).not.toBe('')
      expect(e.audience.length).toBeGreaterThan(0)
    }
  })

  it('只有每日提醒與每週摘要是「只留最新一則未讀」', () => {
    const latestOnly = NOTIFICATION_EVENTS.filter((e) => e.latestUnreadOnly).map((e) => e.key)
    expect(latestOnly.sort()).toEqual(['daily_reminder', 'weekly_summary'])
    expect(isLatestUnreadOnly('daily_reminder')).toBe(true)
    expect(isLatestUnreadOnly('weekly_summary')).toBe(true)
    expect(isLatestUnreadOnly('pre_event')).toBe(false)
    expect(isLatestUnreadOnly('booking_status')).toBe(false)
    expect(isLatestUnreadOnly('亂給的')).toBe(false)
  })
})

describe('notificationLabel', () => {
  it('清單內的類型回名稱', () => {
    expect(notificationLabel('package_request')).toBe('購買申請')
    expect(notificationLabel('checkin_done')).toBe('學員已簽到')
  })

  it('改版前的舊類型也查得到名稱', () => {
    expect(notificationLabel('booking_status')).toBe('預約通知')
    expect(notificationLabel('purchase_request')).toBe('購買申請')
    expect(notificationLabel('recovery')).toBe('帳號回復')
  })

  it('亂給的字串回「通知」，不回傳類型代碼', () => {
    expect(notificationLabel('something_weird')).toBe('通知')
    expect(notificationLabel('')).toBe('通知')
    expect(notificationLabel('toString')).toBe('通知')
  })
})

describe('toInAppUrl', () => {
  it.each([
    ['https://x', null],
    ['//x', null],
    ['/\\x', null],
    ['my-bookings', null],
    ['', null],
    [null, null],
    [undefined, null],
    ['/my-bookings/1', '/my-bookings/1'],
    ['/', '/'],
  ])('%s → %s', (input, expected) => {
    expect(toInAppUrl(input)).toBe(expected)
  })
})
