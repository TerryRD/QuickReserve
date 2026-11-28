import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import {
  UnreadBadge,
  bellAriaLabel,
  hasUnread,
  unreadBadgeText,
} from '@/components/notifications/unread-badge'

describe('未讀徽章的顯示規則（鈴鐺與教練端側欄共用）', () => {
  it.each([
    [0, null],
    [null, null],
    [5, '5'],
    [99, '99'],
    [100, '99+'],
    [120, '99+'],
  ] as const)('未讀 %s → 徽章 %s', (unread, text) => {
    expect(unreadBadgeText(unread)).toBe(text)
  })

  it('有沒有未讀：查詢失敗（null）與 0 都當作沒有', () => {
    expect(hasUnread(null)).toBe(false)
    expect(hasUnread(0)).toBe(false)
    expect(hasUnread(1)).toBe(true)
  })

  it('鈴鐺名稱用實際數字', () => {
    expect(bellAriaLabel(120)).toBe('通知，120 則未讀')
    expect(bellAriaLabel(0)).toBe('通知')
    expect(bellAriaLabel(null)).toBe('通知')
  })

  it('徽章為紅底白字；0 或 null 不渲染', () => {
    const { rerender } = render(<UnreadBadge unread={3} />)
    const badge = screen.getByTestId('notification-badge')
    expect(badge).toHaveTextContent('3')
    expect(badge.className).toContain('bg-destructive')
    expect(badge.className).toContain('text-white')
    rerender(<UnreadBadge unread={0} />)
    expect(screen.queryByTestId('notification-badge')).not.toBeInTheDocument()
    rerender(<UnreadBadge unread={null} />)
    expect(screen.queryByTestId('notification-badge')).not.toBeInTheDocument()
  })
})
