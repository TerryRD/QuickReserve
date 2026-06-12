// src/lib/checkin-window.ts
export const CHECKIN_OPEN_BEFORE_MIN = 30

/** True when `now` is within [start - 30min, end] — the student-self-checkin window. */
export function canCheckIn(now: Date, startAt: string, endAt: string): boolean {
  const start = new Date(startAt).getTime()
  const end = new Date(endAt).getTime()
  const openFrom = start - CHECKIN_OPEN_BEFORE_MIN * 60_000
  const t = now.getTime()
  return t >= openFrom && t <= end
}
