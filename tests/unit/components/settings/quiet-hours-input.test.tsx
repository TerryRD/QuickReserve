import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { QuietHoursInput } from '@/components/settings/quiet-hours-input'

describe('QuietHoursInput', () => {
  it('renders enabled toggle, start, end inputs', () => {
    render(<QuietHoursInput start="22:00" end="07:00" onChange={() => {}} />)
    expect(screen.getByLabelText(/勿擾時段/)).toBeChecked()
    expect(screen.getByDisplayValue('22:00')).toBeInTheDocument()
    expect(screen.getByDisplayValue('07:00')).toBeInTheDocument()
  })

  it('shows disabled state when both are null', () => {
    render(<QuietHoursInput start={null} end={null} onChange={() => {}} />)
    expect(screen.getByLabelText(/勿擾時段/)).not.toBeChecked()
  })

  it('calls onChange when start changes', () => {
    const onChange = vi.fn()
    render(<QuietHoursInput start="22:00" end="07:00" onChange={onChange} />)
    fireEvent.change(screen.getByDisplayValue('22:00'), { target: { value: '23:00' } })
    expect(onChange).toHaveBeenCalledWith({ start: '23:00', end: '07:00' })
  })
})
