import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { BookingTimeline } from '@/components/bookings/booking-timeline'
import type { TimelineEntry } from '@/lib/activity-log'

const entries: TimelineEntry[] = [
  {
    id: 'a1',
    event: 'booking.created',
    actorRole: 'customer',
    actorName: '陳小明',
    reason: null,
    detail: { purchase_id: 'p1' },
    createdAt: '2026-11-28T02:02:00Z',
  },
  {
    id: 'a2',
    event: 'booking.confirmed',
    actorRole: 'system',
    actorName: null,
    reason: null,
    detail: { auto: true, trigger: 'min_attendance' },
    createdAt: '2026-11-28T02:02:00Z',
  },
  {
    id: 'a3',
    event: 'booking.cancelled',
    actorRole: 'staff',
    actorName: '林助教',
    reason: '場地臨時整修，這堂先取消',
    detail: { category: 'coach_cancelled', disposition: 'refunded', class_returned: true },
    createdAt: '2026-12-01T13:14:00Z',
  },
]

function rowTexts() {
  return screen.getAllByRole('listitem').map((li) => li.textContent ?? '')
}

describe('BookingTimeline', () => {
  it('依時間顯示每一筆，新的在上', () => {
    render(<BookingTimeline entries={entries} viewer="tenant" />)
    const rows = rowTexts()
    expect(rows).toHaveLength(3)
    expect(rows[0]).toContain('取消預約，已退回 1 堂')
    expect(rows[1]).toContain('預約已確認')
    expect(rows[2]).toContain('建立預約，使用 1 堂')
  })

  it('教練端顯示操作人名稱與身分', () => {
    render(<BookingTimeline entries={entries} viewer="tenant" />)
    const rows = rowTexts()
    expect(rows[0]).toContain('林助教（助教）')
    expect(rows[1]).toContain('系統')
    expect(rows[2]).toContain('陳小明（學員）')
  })

  it('學員端不出現 Owner、助教與操作人名稱，只寫「你／教練／系統」', () => {
    const withOwner: TimelineEntry[] = [
      entries[0]!,
      entries[1]!,
      {
        id: 'a4',
        event: 'booking.confirmed',
        actorRole: 'owner',
        actorName: '王教練',
        reason: null,
        detail: {},
        createdAt: '2026-11-29T02:00:00Z',
      },
      entries[2]!,
    ]
    const { container } = render(<BookingTimeline entries={withOwner} viewer="customer" />)
    const text = container.textContent ?? ''
    expect(text).not.toContain('Owner')
    expect(text).not.toContain('助教')
    expect(text).not.toContain('王教練')
    expect(text).not.toContain('陳小明')
    const rows = rowTexts()
    expect(rows[0]).toContain('教練 · 原因：')
    expect(rows[1]).toContain('教練')
    expect(rows[2]).toContain('系統')
    expect(rows[3]).toContain('你')
  })

  it('有原因的列顯示「原因：」', () => {
    render(<BookingTimeline entries={entries} viewer="tenant" />)
    const rows = rowTexts()
    expect(rows[0]).toContain('原因：場地臨時整修，這堂先取消')
    expect(rows[1]).not.toContain('原因：')
  })

  it('空陣列顯示 emptyHint，未指定時顯示「尚無紀錄」', () => {
    const { rerender } = render(<BookingTimeline entries={[]} viewer="tenant" />)
    expect(screen.getByText('尚無紀錄')).toBeInTheDocument()
    rerender(
      <BookingTimeline
        entries={[]}
        viewer="tenant"
        emptyHint="只有這個時段的教練或 Owner 可以查看歷程"
      />,
    )
    expect(screen.getByText('只有這個時段的教練或 Owner 可以查看歷程')).toBeInTheDocument()
  })

  it('未知事件顯示「其他紀錄」而不是事件代碼', () => {
    const { container } = render(
      <BookingTimeline
        entries={[
          {
            id: 'x1',
            event: 'booking.something_new',
            actorRole: 'system',
            actorName: null,
            reason: null,
            detail: {},
            createdAt: '2026-11-28T02:02:00Z',
          },
        ]}
        viewer="tenant"
      />,
    )
    expect(screen.getByText('其他紀錄')).toBeInTheDocument()
    expect(container.textContent).not.toContain('something_new')
  })

  it('取消類別與堂數處理反映在第一行', () => {
    render(
      <BookingTimeline
        entries={[
          {
            id: 'r1',
            event: 'booking.cancelled',
            actorRole: 'owner',
            actorName: null,
            reason: '時段臨時有事',
            detail: { category: 'coach_rejected', disposition: 'refunded', class_returned: true },
            createdAt: '2026-11-28T02:02:00Z',
          },
          {
            id: 'r2',
            event: 'booking.cancelled',
            actorRole: 'customer',
            actorName: null,
            reason: '工作',
            detail: { category: 'customer', disposition: 'forfeited', class_returned: false },
            createdAt: '2026-11-29T02:02:00Z',
          },
        ]}
        viewer="tenant"
      />,
    )
    const rows = rowTexts()
    expect(rows[0]).toContain('取消預約，不退回')
    expect(rows[1]).toContain('拒絕預約，已退回 1 堂')
    expect(rows[1]).toContain('Owner · 原因：時段臨時有事')
  })

  it('時間以台灣時間顯示為 MM/dd HH:mm（不受執行環境時區影響）', () => {
    render(<BookingTimeline entries={entries.slice(0, 1)} viewer="tenant" />)
    const time = screen.getByRole('listitem').querySelector('time')
    expect(time?.textContent).toBe('11/28 10:02')
    expect(time?.getAttribute('dateTime')).toBe('2026-11-28T02:02:00Z')
  })
})
