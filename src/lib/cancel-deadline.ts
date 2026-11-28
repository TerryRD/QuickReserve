// src/lib/cancel-deadline.ts
/** True when `now` is at or before (start − deadlineHours) — i.e. a customer cancel still earns a refund. */
export function isWithinCancelDeadline(now: Date, startAt: string, deadlineHours: number): boolean {
  const cutoff = new Date(startAt).getTime() - deadlineHours * 3600_000
  return now.getTime() <= cutoff
}

/** 學員現在取消會不會退回。待確認一律退回；已確認看預約上的取消期限（沒有值時用開課時間與時數推算）。 */
export function willCustomerCancelRefund(
  now: Date,
  b: { status: string; cancelDeadlineAt: string | null; startAt: string; deadlineHours: number },
): boolean {
  if (b.status === 'pending') return true
  if (b.cancelDeadlineAt) return now.getTime() <= new Date(b.cancelDeadlineAt).getTime()
  return isWithinCancelDeadline(now, b.startAt, b.deadlineHours)
}
