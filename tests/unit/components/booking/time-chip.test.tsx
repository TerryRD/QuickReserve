import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { TimeChip } from '@/components/booking/time-chip'

describe('TimeChip', () => {
  it('renders time in open state', () => {
    render(<TimeChip time="16:00" state="open" onSelect={() => {}} />)
    expect(screen.getByText('16:00')).toBeInTheDocument()
    expect(screen.getByRole('button')).not.toBeDisabled()
  })

  it('full state is disabled', () => {
    render(<TimeChip time="16:00" state="full" onSelect={() => {}} />)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('group state shows filled/capacity badge', () => {
    render(
      <TimeChip
        time="16:00"
        state="group"
        group={{ filled: 3, capacity: 4 }}
        onSelect={() => {}}
      />,
    )
    expect(screen.getByText('3/4')).toBeInTheDocument()
  })

  it('selected state has aria-pressed=true', () => {
    render(<TimeChip time="16:00" state="selected" onSelect={() => {}} />)
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true')
  })

  it('calls onSelect on click for open state', () => {
    const onSelect = vi.fn()
    render(<TimeChip time="16:00" state="open" onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onSelect).toHaveBeenCalledOnce()
  })
})
