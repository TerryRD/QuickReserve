import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import type { InboxItem } from '@/lib/notifications'

const execute = vi.hoisted(() => vi.fn())
const listRecentAction = vi.hoisted(() => vi.fn())
vi.mock('next-safe-action/hooks', () => ({
  useAction: () => ({ execute, isPending: false }),
}))
vi.mock('@/components/notifications/actions', () => ({
  markNotificationReadAction: {},
  listRecentAction,
}))

import { NotificationPopover } from '@/components/notifications/notification-popover'

function item(n: number, overrides: Partial<InboxItem> = {}): InboxItem {
  return {
    id: `n${n}`,
    type: 'booking_cancelled',
    title: `通知標題 ${n}`,
    body: `通知內文 ${n}`,
    url: `/my-bookings/${n}`,
    sentAt: '2026-12-02T11:00:00Z',
    readAt: null,
    ...overrides,
  }
}

function openPopover(name = '通知') {
  fireEvent.click(screen.getByRole('button', { name }))
}

beforeEach(() => {
  execute.mockReset()
  listRecentAction.mockReset()
})

describe('NotificationPopover', () => {
  it('鈴鐺按鈕：名稱與徽章和 NotificationBell 一致，並標示會跳出小視窗', () => {
    render(<NotificationPopover href="/my-notifications" unread={120} />)
    const trigger = screen.getByRole('button', { name: '通知，120 則未讀' })
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByTestId('notification-badge')).toHaveTextContent('99+')
  })

  it('未讀數讀不到（null）→ 鈴鐺照樣顯示，不顯示數字', () => {
    render(<NotificationPopover href="/my-notifications" unread={null} />)
    expect(screen.getByRole('button', { name: '通知' })).toBeInTheDocument()
    expect(screen.queryByTestId('notification-badge')).not.toBeInTheDocument()
  })

  it('沒打開前不讀取；打開才讀取，讀取中顯示「讀取中…」', async () => {
    let resolve: (v: unknown) => void = () => {}
    listRecentAction.mockReturnValue(new Promise((r) => (resolve = r)))
    render(<NotificationPopover href="/my-notifications" unread={2} />)
    expect(listRecentAction).not.toHaveBeenCalled()

    openPopover('通知，2 則未讀')
    expect(listRecentAction).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('讀取中…')).toBeInTheDocument()
    expect(screen.getByText('最近的通知')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '通知，2 則未讀' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )

    resolve({ data: { ok: true, items: [item(1)] } })
    expect(await screen.findByText('通知標題 1')).toBeInTheDocument()
    expect(screen.queryByText('讀取中…')).not.toBeInTheDocument()
  })

  it('列出項目（標題＋內文），最多 5 則；「看全部通知」連到指定頁', async () => {
    listRecentAction.mockResolvedValue({
      data: { ok: true, items: [1, 2, 3, 4, 5, 6].map((n) => item(n)) },
    })
    render(<NotificationPopover href="/my-notifications" unread={6} />)
    openPopover('通知，6 則未讀')

    expect(await screen.findByText('通知標題 1')).toBeInTheDocument()
    expect(screen.getByText('通知內文 1')).toBeInTheDocument()
    expect(screen.getByText('通知標題 5')).toBeInTheDocument()
    expect(screen.queryByText('通知標題 6')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: '看全部通知' })).toHaveAttribute(
      'href',
      '/my-notifications',
    )
  })

  it('打開小視窗不會把任何通知標為已讀；點其中一則才標', async () => {
    listRecentAction.mockResolvedValue({ data: { ok: true, items: [item(1), item(2)] } })
    render(<NotificationPopover href="/my-notifications" unread={2} />)
    openPopover('通知，2 則未讀')
    const first = await screen.findByText('通知標題 1')
    expect(execute).not.toHaveBeenCalled()

    const link = first.closest('a')!
    expect(link).toHaveAttribute('href', '/my-bookings/1')
    fireEvent.click(link)
    expect(execute).toHaveBeenCalledTimes(1)
    expect(execute).toHaveBeenCalledWith({ id: 'n1' })
  })

  it('沒有連結的一則 → 點了只標為已讀', async () => {
    listRecentAction.mockResolvedValue({ data: { ok: true, items: [item(1, { url: null })] } })
    render(<NotificationPopover href="/my-notifications" unread={1} />)
    openPopover('通知，1 則未讀')
    const row = (await screen.findByText('通知標題 1')).closest('button')!
    fireEvent.click(row)
    expect(execute).toHaveBeenCalledWith({ id: 'n1' })
  })

  it('沒有通知 → 顯示「沒有通知」', async () => {
    listRecentAction.mockResolvedValue({ data: { ok: true, items: [] } })
    render(<NotificationPopover href="/my-notifications" unread={0} />)
    openPopover()
    expect(await screen.findByText('沒有通知')).toBeInTheDocument()
  })

  it('讀取失敗 → 顯示讀取失敗的訊息，不顯示「沒有通知」；「看全部通知」仍可點', async () => {
    listRecentAction.mockResolvedValue({ data: { ok: false } })
    render(<NotificationPopover href="/my-notifications" unread={3} />)
    openPopover('通知，3 則未讀')
    expect(await screen.findByText('目前無法取得通知，請稍後再試')).toBeInTheDocument()
    expect(screen.queryByText('沒有通知')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: '看全部通知' })).toHaveAttribute(
      'href',
      '/my-notifications',
    )
  })

  it('伺服器端錯誤（沒有回傳資料）或呼叫丟錯 → 一樣顯示讀取失敗', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    listRecentAction.mockResolvedValueOnce({ serverError: { code: 'INTERNAL_ERROR' } })
    const { unmount } = render(<NotificationPopover href="/my-notifications" unread={0} />)
    openPopover()
    expect(await screen.findByText('目前無法取得通知，請稍後再試')).toBeInTheDocument()
    unmount()

    listRecentAction.mockRejectedValueOnce(new Error('network'))
    render(<NotificationPopover href="/my-notifications" unread={0} />)
    openPopover()
    expect(await screen.findByText('目前無法取得通知，請稍後再試')).toBeInTheDocument()
    expect(screen.queryByText('沒有通知')).not.toBeInTheDocument()
    spy.mockRestore()
  })

  it('按 Esc 關閉小視窗', async () => {
    listRecentAction.mockResolvedValue({ data: { ok: true, items: [] } })
    render(<NotificationPopover href="/my-notifications" unread={0} />)
    openPopover()
    expect(await screen.findByText('最近的通知')).toBeInTheDocument()
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '通知' })).toHaveAttribute(
        'aria-expanded',
        'false',
      ),
    )
  })
})
