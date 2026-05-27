import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { DateRibbon } from '@/components/booking/date-ribbon'

const DATES = ['2026-05-27', '2026-05-28', '2026-05-29']

describe('DateRibbon', () => {
  it('renders all dates as buttons', () => {
    render(
      <DateRibbon
        dates={DATES}
        selected="2026-05-27"
        onSelect={() => {}}
        slotCountByDate={{ '2026-05-27': 5, '2026-05-28': 0, '2026-05-29': 3 }}
      />,
    )
    expect(screen.getAllByRole('button')).toHaveLength(3)
  })

  it('marks selected date with aria-pressed', () => {
    render(
      <DateRibbon
        dates={DATES}
        selected="2026-05-28"
        onSelect={() => {}}
        slotCountByDate={{}}
      />,
    )
    const sel = screen.getAllByRole('button').find((b) => b.getAttribute('aria-pressed') === 'true')
    expect(sel).toBeDefined()
    expect(sel).toHaveTextContent('28')
  })

  it('calls onSelect with date on click', () => {
    const onSelect = vi.fn()
    render(
      <DateRibbon
        dates={DATES}
        selected="2026-05-27"
        onSelect={onSelect}
        slotCountByDate={{}}
      />,
    )
    fireEvent.click(screen.getAllByRole('button')[1]!)
    expect(onSelect).toHaveBeenCalledWith('2026-05-28')
  })

  it('shows slot count when > 0', () => {
    render(
      <DateRibbon
        dates={DATES}
        selected="2026-05-27"
        onSelect={() => {}}
        slotCountByDate={{ '2026-05-27': 5 }}
      />,
    )
    expect(screen.getByText('5')).toBeInTheDocument()
  })
})
