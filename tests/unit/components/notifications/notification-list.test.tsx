import { render, screen, fireEvent } from '@testing-library/react'
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import type { InboxItem } from '@/lib/notifications'

const execute = vi.hoisted(() => vi.fn())
vi.mock('next-safe-action/hooks', () => ({
  useAction: () => ({ execute, isPending: false }),
}))
vi.mock('@/components/notifications/actions', () => ({
  markNotificationReadAction: {},
}))

import {
  NotificationList,
  RELATIVE_TIME_WINDOW_MS,
  formatNotificationTime,
} from '@/components/notifications/notification-list'

function item(overrides: Partial<InboxItem> = {}): InboxItem {
  return {
    id: 'n1',
    type: 'booking_cancelled',
    title: '預約已取消',
    body: '教練取消了您的預約',
    url: '/my-bookings/1',
    sentAt: '2026-12-02T11:00:00Z',
    readAt: null,
    ...overrides,
  }
}

/** 測試用的「現在」：台灣時間 2026-12-02 22:00（UTC 14:00） */
const NOW = new Date('2026-12-02T14:00:00Z')

beforeEach(() => {
  execute.mockReset()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})
afterEach(() => vi.useRealTimers())

describe('NotificationList', () => {
  it('空清單 → 顯示「沒有通知」與說明', () => {
    render(<NotificationList items={[]} />)
    expect(screen.getByText('沒有通知')).toBeInTheDocument()
    expect(screen.getByText('新事件發生時會出現在這裡')).toBeInTheDocument()
  })

  it('顯示標題、內文與時間，不顯示類型代碼與發送狀態', () => {
    // 3 小時前（剛好到分界）→ 台灣時間的月日時分
    const { container } = render(<NotificationList items={[item()]} />)
    expect(screen.getByText('預約已取消')).toBeInTheDocument()
    expect(screen.getByText('教練取消了您的預約')).toBeInTheDocument()
    expect(screen.getByText('12/2 19:00')).toBeInTheDocument()
    expect(container.textContent).not.toMatch(/booking_cancelled|web_push|skipped|sent/)
  })

  it('不到 3 小時 → 相對時間', () => {
    render(<NotificationList items={[item({ sentAt: '2026-12-02T13:55:00Z' })]} />)
    expect(screen.getByText('5 分鐘前')).toBeInTheDocument()
  })

  it('未讀列有左側色條樣式；已讀列淡化', () => {
    render(
      <NotificationList
        items={[
          item({ id: 'a', title: '未讀這則' }),
          item({ id: 'b', title: '已讀這則', readAt: '2026-12-02T12:00:00Z' }),
        ]}
      />,
    )
    const unread = screen.getByText('未讀這則').closest('a')!
    const read = screen.getByText('已讀這則').closest('a')!
    expect(unread).toHaveAttribute('data-unread', 'true')
    expect(unread.className).toContain('before:bg-accent')
    expect(read).toHaveAttribute('data-unread', 'false')
    expect(read.className).toContain('opacity-70')
  })

  it('舊紀錄（沒有標題）顯示類型名稱，而不是類型代碼', () => {
    render(
      <NotificationList
        items={[item({ title: null, body: null, type: 'booking_status', url: null })]}
      />,
    )
    expect(screen.getByText('預約通知')).toBeInTheDocument()
    expect(screen.queryByText('booking_status')).not.toBeInTheDocument()
  })

  it('點未讀且有連結的一則 → 標為已讀，並連到該頁', () => {
    render(<NotificationList items={[item()]} />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/my-bookings/1')
    fireEvent.click(link)
    expect(execute).toHaveBeenCalledWith({ id: 'n1' })
  })

  it('沒有連結的未讀 → 是按鈕，點了只標為已讀', () => {
    render(<NotificationList items={[item({ url: null })]} />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button'))
    expect(execute).toHaveBeenCalledWith({ id: 'n1' })
  })

  it('站外連結當作沒有連結', () => {
    render(<NotificationList items={[item({ url: '//evil.example' })]} />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('已讀且有連結 → 可以點了前往，不再送標為已讀', () => {
    render(<NotificationList items={[item({ readAt: '2026-12-02T12:00:00Z' })]} />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/my-bookings/1')
    fireEvent.click(link)
    expect(execute).not.toHaveBeenCalled()
  })

  it('已讀且沒有連結 → 不可點', () => {
    render(
      <NotificationList items={[item({ url: null, readAt: '2026-12-02T12:00:00Z' })]} />,
    )
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})

describe('formatNotificationTime（3 小時分界）', () => {
  const now = NOW.getTime()
  const ago = (ms: number) => new Date(now - ms).toISOString()

  it('分界常數是 3 小時', () => {
    expect(RELATIVE_TIME_WINDOW_MS).toBe(3 * 60 * 60 * 1000)
  })

  it('差 1 毫秒到 3 小時 → 相對時間', () => {
    expect(formatNotificationTime(ago(RELATIVE_TIME_WINDOW_MS - 1), now)).toBe('大約 3 小時前')
  })

  it('剛好 3 小時 → 台灣時間 M/d HH:mm', () => {
    expect(formatNotificationTime(ago(RELATIVE_TIME_WINDOW_MS), now)).toBe('12/2 19:00')
  })

  it('超過 3 小時、跨日 → 台灣時間 M/d HH:mm', () => {
    expect(formatNotificationTime('2026-11-30T16:05:00Z', now)).toBe('12/1 00:05')
  })

  it('大約 2 小時前', () => {
    expect(formatNotificationTime(ago(2 * 60 * 60 * 1000), now)).toBe('大約 2 小時前')
  })
})
