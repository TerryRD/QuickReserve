// src/lib/pre-event-reminder.ts

/** 課前提醒的去重時間：開課時間往前推 minutes 分鐘，回傳 ISO 字串。同一筆預約、同一個提前量永遠得到同一個值。 */
export function preEventScheduledFor(startAt: string, minutes: number): string {
  const startMs = new Date(startAt).getTime()
  if (Number.isNaN(startMs)) {
    throw new Error(`preEventScheduledFor: invalid startAt "${startAt}"`)
  }
  return new Date(startMs - minutes * 60_000).toISOString()
}
