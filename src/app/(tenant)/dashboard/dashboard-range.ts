import { taipeiDateKey, taipeiDayStart } from '@/lib/taipei-time'

const DAY_MS = 86400000

/** 儀表板統計用的時間範圍，一律以台灣日界為準 */
export function dashboardRange(now: Date): {
  todayStart: string
  tomorrowStart: string
  weekEnd: string
  monthStart: string
} {
  const todayKey = taipeiDateKey(now)
  const todayMs = taipeiDayStart(todayKey).getTime()
  return {
    todayStart: new Date(todayMs).toISOString(),
    tomorrowStart: new Date(todayMs + DAY_MS).toISOString(),
    weekEnd: new Date(todayMs + 7 * DAY_MS).toISOString(),
    monthStart: taipeiDayStart(`${todayKey.slice(0, 7)}-01`).toISOString(),
  }
}
