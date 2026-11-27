import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard' }))

import SidebarNav from '@/app/(tenant)/sidebar-nav'
import MobileSidebar from '@/app/(tenant)/mobile-sidebar'

function notificationsLink() {
  return screen.getByRole('link', { name: /^通知/ })
}

describe('教練端側欄「通知」', () => {
  it('名稱是「通知」（不是「通知設定」），連到 /notifications', () => {
    render(<SidebarNav isOwner unread={0} />)
    expect(notificationsLink()).toHaveAttribute('href', '/notifications')
    expect(screen.queryByText('通知設定')).not.toBeInTheDocument()
  })

  it.each([
    [5, '5'],
    [120, '99+'],
  ] as const)('未讀 %s → 右邊紅底白字徽章顯示 %s', (unread, text) => {
    render(<SidebarNav isOwner={false} unread={unread} />)
    const badge = within(notificationsLink()).getByTestId('notification-badge')
    expect(badge).toHaveTextContent(text)
    expect(badge.className).toContain('bg-destructive')
  })

  it.each([0, null])('未讀 %s → 不顯示徽章', (unread) => {
    render(<SidebarNav isOwner unread={unread} />)
    expect(screen.queryByTestId('notification-badge')).not.toBeInTheDocument()
  })
})

const baseProps = {
  tenantName: '測試教室',
  tenantSlug: 'test',
  roleLabel: 'Owner',
  isOwner: true,
  displayName: null,
  email: null,
}

describe('教練端手機版選單按鈕的小紅點', () => {
  it('有未讀 → 小紅點，按鈕名稱帶「有未讀通知」', () => {
    render(<MobileSidebar {...baseProps} unread={3} />)
    expect(screen.getByRole('button', { name: '選單，有未讀通知' })).toBeInTheDocument()
    expect(screen.getByTestId('menu-unread-dot')).toBeInTheDocument()
  })

  it.each([0, null])('未讀 %s → 沒有小紅點，按鈕名稱是「選單」', (unread) => {
    render(<MobileSidebar {...baseProps} unread={unread} />)
    expect(screen.getByRole('button', { name: '選單' })).toBeInTheDocument()
    expect(screen.queryByTestId('menu-unread-dot')).not.toBeInTheDocument()
  })

  it('打開選單 →「通知」旁有數字', async () => {
    render(<MobileSidebar {...baseProps} unread={7} />)
    fireEvent.click(screen.getByRole('button', { name: '選單，有未讀通知' }))
    const link = await screen.findByRole('link', { name: /^通知/ })
    expect(within(link).getByTestId('notification-badge')).toHaveTextContent('7')
  })
})
