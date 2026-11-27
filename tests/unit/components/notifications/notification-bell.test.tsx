import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { NotificationBell } from '@/components/notifications/notification-bell'

describe('NotificationBell', () => {
  it('未讀 0 → 不顯示數字，名稱為「通知」', () => {
    render(<NotificationBell href="/notifications" unread={0} />)
    const link = screen.getByRole('link', { name: '通知' })
    expect(link).toHaveAttribute('href', '/notifications')
    expect(screen.queryByTestId('notification-badge')).not.toBeInTheDocument()
  })

  it('未讀數查詢失敗（null）→ 不顯示數字', () => {
    render(<NotificationBell href="/notifications" unread={null} />)
    expect(screen.getByRole('link', { name: '通知' })).toBeInTheDocument()
    expect(screen.queryByTestId('notification-badge')).not.toBeInTheDocument()
  })

  it('未讀 5 → 顯示 5，名稱含未讀數', () => {
    render(<NotificationBell href="/notifications" unread={5} />)
    expect(screen.getByRole('link', { name: '通知，5 則未讀' })).toBeInTheDocument()
    const badge = screen.getByTestId('notification-badge')
    expect(badge).toHaveTextContent('5')
    // 紅底白字（沿用 destructive 色彩）
    expect(badge.className).toContain('bg-destructive')
    expect(badge.className).toContain('text-white')
  })

  it('未讀 120 → 顯示 99+，名稱仍是實際數字', () => {
    render(<NotificationBell href="/notifications" unread={120} />)
    expect(screen.getByRole('link', { name: '通知，120 則未讀' })).toBeInTheDocument()
    expect(screen.getByTestId('notification-badge')).toHaveTextContent('99+')
  })
})
