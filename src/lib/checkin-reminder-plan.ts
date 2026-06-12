// src/lib/checkin-reminder-plan.ts
export const MISSING_MAX_AGE_MIN = 120

export type ReminderBooking = {
  bookingId: string
  slotId: string
  startAt: string
  checkedInAt: string | null
  status: string
  reminderLeadMin: number | null // tenant checkin_reminder_minutes; null = disabled
}

export type ReminderAction =
  | { kind: 'reminder'; bookingId: string }
  | { kind: 'missing'; bookingId: string }

/** Decide which un-checked-in confirmed bookings need a pre-class reminder or a not-checked-in escalation. */
export function planCheckinReminders(now: Date, bookings: ReminderBooking[]): ReminderAction[] {
  const out: ReminderAction[] = []
  const t = now.getTime()
  for (const b of bookings) {
    if (b.status !== 'confirmed' || b.checkedInAt) continue
    const start = new Date(b.startAt).getTime()
    if (t >= start) {
      if (t - start <= MISSING_MAX_AGE_MIN * 60_000) out.push({ kind: 'missing', bookingId: b.bookingId })
      continue
    }
    if (b.reminderLeadMin != null) {
      const remindFrom = start - b.reminderLeadMin * 60_000
      if (t >= remindFrom) out.push({ kind: 'reminder', bookingId: b.bookingId })
    }
  }
  return out
}
