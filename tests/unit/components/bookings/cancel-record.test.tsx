import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { CancelRecord } from '@/components/bookings/cancel-record'

describe('CancelRecord', () => {
  it('學員端：學員自己取消時取消人寫「你」', () => {
    render(
      <CancelRecord
        viewer="customer"
        category="customer"
        reason="工作"
        actorRole="customer"
        cancelledAt="2026-12-01T13:14:00Z"
        disposition="refunded"
      />,
    )
    expect(screen.getByText('你')).toBeInTheDocument()
    expect(screen.getByText('工作')).toBeInTheDocument()
    expect(screen.getByText('2026/12/01（二）21:14')).toBeInTheDocument()
  })

  it('學員端：助教取消只寫「教練」', () => {
    const { container } = render(
      <CancelRecord
        viewer="customer"
        category="coach_cancelled"
        reason="場地整修"
        actorRole="staff"
        cancelledAt="2026-12-01T13:14:00Z"
        disposition="refunded"
      />,
    )
    expect(screen.getByText('教練')).toBeInTheDocument()
    expect(container.textContent).not.toContain('助教')
    expect(container.textContent).not.toContain('Owner')
  })

  it('學員端：改版前取消只顯示說明', () => {
    const { container } = render(
      <CancelRecord
        viewer="customer"
        category="legacy"
        reason={null}
        actorRole={null}
        cancelledAt="2026-12-01T13:14:00Z"
        disposition={null}
      />,
    )
    expect(container.textContent).toBe('改版前取消，沒有詳細紀錄')
  })

  it('教練端：行為不變（學員取消寫「學員」，legacy 顯示類別與時間）', () => {
    const { container, unmount } = render(
      <CancelRecord
        viewer="tenant"
        category="customer"
        reason="工作"
        actorRole="customer"
        cancelledAt="2026-12-01T13:14:00Z"
        disposition="refunded"
      />,
    )
    expect(screen.getByText('學員')).toBeInTheDocument()
    expect(container.textContent).not.toContain('你')
    unmount()

    render(
      <CancelRecord
        viewer="tenant"
        category="legacy"
        reason={null}
        actorRole={null}
        cancelledAt="2026-12-01T13:14:00Z"
        disposition={null}
      />,
    )
    expect(screen.getByText('舊資料（未分類）')).toBeInTheDocument()
    expect(screen.getByText('2026/12/01（二）21:14')).toBeInTheDocument()
  })

  it('堂數列對齊示意圖：已退回 1 堂／不退回／已轉到新預約', () => {
    const cases = [
      ['refunded', '已退回 1 堂'],
      ['forfeited', '不退回'],
      ['transferred', '已轉到新預約'],
    ] as const
    for (const [disposition, text] of cases) {
      const { unmount } = render(
        <CancelRecord
          viewer="customer"
          category="customer"
          reason="工作"
          actorRole="customer"
          cancelledAt="2026-12-01T13:14:00Z"
          disposition={disposition}
        />,
      )
      expect(screen.getByText('堂數')).toBeInTheDocument()
      expect(screen.getByText(text)).toBeInTheDocument()
      expect(screen.queryByText('堂數處理')).toBeNull()
      unmount()
    }
  })

  it('教練端：有名稱時取消人寫「名稱（身分）」，沒有名稱只寫身分', () => {
    const { unmount } = render(
      <CancelRecord
        viewer="tenant"
        category="coach_cancelled"
        reason="場地整修"
        actorRole="staff"
        cancelledAt="2026-12-01T13:14:00Z"
        disposition="refunded"
        actorName="林助教"
      />,
    )
    expect(screen.getByText('林助教（助教）')).toBeInTheDocument()
    unmount()

    const { unmount: unmount2 } = render(
      <CancelRecord
        viewer="tenant"
        category="coach_cancelled"
        reason="場地整修"
        actorRole="owner"
        cancelledAt="2026-12-01T13:14:00Z"
        disposition="refunded"
        actorName={null}
      />,
    )
    expect(screen.getByText('Owner')).toBeInTheDocument()
    unmount2()

    // 名稱只是身分的備用字（成員沒有可顯示的名稱）時不重複寫
    render(
      <CancelRecord
        viewer="tenant"
        category="coach_cancelled"
        reason="場地整修"
        actorRole="owner"
        cancelledAt="2026-12-01T13:14:00Z"
        disposition="refunded"
        actorName="Owner"
      />,
    )
    expect(screen.getByText('Owner')).toBeInTheDocument()
    expect(screen.queryByText('Owner（Owner）')).toBeNull()
  })

  it('教練端：系統取消不顯示名稱', () => {
    render(
      <CancelRecord
        viewer="tenant"
        category="under_min"
        reason="人數不足"
        actorRole="system"
        cancelledAt="2026-12-01T13:14:00Z"
        disposition="refunded"
        actorName="不該出現"
      />,
    )
    expect(screen.getByText('系統')).toBeInTheDocument()
    expect(screen.queryByText(/不該出現/)).toBeNull()
  })

  it('學員端：一律不顯示名稱', () => {
    const { container, unmount } = render(
      <CancelRecord
        viewer="customer"
        category="coach_cancelled"
        reason="場地整修"
        actorRole="staff"
        cancelledAt="2026-12-01T13:14:00Z"
        disposition="refunded"
        actorName="林助教"
      />,
    )
    expect(screen.getByText('教練')).toBeInTheDocument()
    expect(container.textContent).not.toContain('林助教')
    unmount()

    render(
      <CancelRecord
        viewer="customer"
        category="customer"
        reason="工作"
        actorRole="customer"
        cancelledAt="2026-12-01T13:14:00Z"
        disposition="refunded"
        actorName="王小明"
      />,
    )
    expect(screen.getByText('你')).toBeInTheDocument()
    expect(screen.queryByText(/王小明/)).toBeNull()
  })
})
