import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { DateStrip } from '@/components/bookings/date-strip'

describe('DateStrip', () => {
  it('renders group label and eng label for "today"', () => {
    render(<DateStrip groupKey="today" count={3} />)
    expect(screen.getByText('今日')).toBeInTheDocument()
    expect(screen.getByText('TODAY')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('renders correct labels for each group key', () => {
    const { rerender } = render(<DateStrip groupKey="thisWeek" count={5} />)
    expect(screen.getByText('THIS WEEK')).toBeInTheDocument()
    rerender(<DateStrip groupKey="later" count={2} />)
    expect(screen.getByText('LATER')).toBeInTheDocument()
    rerender(<DateStrip groupKey="past" count={10} />)
    expect(screen.getByText('PAST')).toBeInTheDocument()
  })
})
