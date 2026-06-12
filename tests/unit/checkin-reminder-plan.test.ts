import { describe, expect, it } from 'vitest'
import { planCheckinReminders, type ReminderBooking } from '@/lib/checkin-reminder-plan'

const now = new Date('2026-06-13T10:00:00.000Z')
function bk(over: Partial<ReminderBooking>): ReminderBooking {
  return {
    bookingId: 'b1', slotId: 's1', startAt: '2026-06-13T10:10:00.000Z',
    checkedInAt: null, status: 'confirmed', reminderLeadMin: 15, ...over,
  }
}

describe('planCheckinReminders', () => {
  it('emits reminder inside the lead window before start', () => {
    // start 10:10, lead 15 -> window opens 09:55; now 10:00 is inside
    expect(planCheckinReminders(now, [bk({})])).toEqual([{ kind: 'reminder', bookingId: 'b1' }])
  })
  it('no reminder before the lead window opens', () => {
    expect(planCheckinReminders(now, [bk({ startAt: '2026-06-13T10:30:00.000Z' })])).toEqual([])
  })
  it('no reminder when tenant lead is disabled (null)', () => {
    expect(planCheckinReminders(now, [bk({ reminderLeadMin: null })])).toEqual([])
  })
  it('emits missing when start has passed and not checked in', () => {
    expect(planCheckinReminders(now, [bk({ startAt: '2026-06-13T09:59:00.000Z' })])).toEqual([
      { kind: 'missing', bookingId: 'b1' },
    ])
  })
  it('skips checked-in bookings', () => {
    expect(planCheckinReminders(now, [bk({ startAt: '2026-06-13T09:59:00.000Z', checkedInAt: '2026-06-13T09:58:00.000Z' })])).toEqual([])
  })
  it('skips non-confirmed bookings', () => {
    expect(planCheckinReminders(now, [bk({ status: 'pending', startAt: '2026-06-13T09:59:00.000Z' })])).toEqual([])
  })
  it('skips stale missing (> 120 min past start)', () => {
    expect(planCheckinReminders(now, [bk({ startAt: '2026-06-13T07:30:00.000Z' })])).toEqual([])
  })
})
