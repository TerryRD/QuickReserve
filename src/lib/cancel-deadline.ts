// src/lib/cancel-deadline.ts
/** True when `now` is at or before (start − deadlineHours) — i.e. a customer cancel still earns a refund. */
export function isWithinCancelDeadline(now: Date, startAt: string, deadlineHours: number): boolean {
  const cutoff = new Date(startAt).getTime() - deadlineHours * 3600_000
  return now.getTime() <= cutoff
}
