import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { NotificationMatrix, type NotificationPrefs } from '@/components/settings/notification-matrix'

const EVENTS = [
  { key: 'booking_created', label: '新預約' },
  { key: 'package_request', label: '套裝申請' },
] as const

const PREFS: NotificationPrefs = {
  web_push: { booking_created: true, package_request: false },
  in_app: { booking_created: true, package_request: true },
}

describe('NotificationMatrix', () => {
  it('renders one row per event and two channel checkboxes per row', () => {
    render(<NotificationMatrix events={[...EVENTS]} prefs={PREFS} onToggle={() => {}} />)
    expect(screen.getByText('新預約')).toBeInTheDocument()
    expect(screen.getByText('套裝申請')).toBeInTheDocument()
    expect(screen.getAllByRole('checkbox')).toHaveLength(EVENTS.length * 2)
  })

  it('reflects prefs values as checkbox state', () => {
    render(<NotificationMatrix events={[...EVENTS]} prefs={PREFS} onToggle={() => {}} />)
    const boxes = screen.getAllByRole('checkbox')
    expect((boxes[0] as HTMLInputElement).checked).toBe(true)  // web_push booking_created
    expect((boxes[1] as HTMLInputElement).checked).toBe(true)  // in_app booking_created
    expect((boxes[2] as HTMLInputElement).checked).toBe(false) // web_push package_request
    expect((boxes[3] as HTMLInputElement).checked).toBe(true)  // in_app package_request
  })

  it('calls onToggle(channel, eventKey, nextValue) on click', () => {
    const onToggle = vi.fn()
    render(<NotificationMatrix events={[...EVENTS]} prefs={PREFS} onToggle={onToggle} />)
    const boxes = screen.getAllByRole('checkbox')
    fireEvent.click(boxes[2]!) // toggle web_push package_request from false → true
    expect(onToggle).toHaveBeenCalledWith('web_push', 'package_request', true)
  })
})
