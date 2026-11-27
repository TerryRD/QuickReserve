// 行事曆的日期範圍計算（server 與 client 共用）。
// 日期一律以 yyyy-MM-dd 字串（dateKey）傳遞，運算用 Date.UTC，不受執行環境時區影響；
// 要換成時間點時以台灣日界（taipeiDayStart）為準。

import { addDaysKey, isDateKey, monthStartKey, weekStartKey } from '@/lib/date-key'
import { taipeiDateKey, taipeiDayStart } from '@/lib/taipei-time'

export { addDaysKey, weekStartKey, monthStartKey } from '@/lib/date-key'

export function calendarRange(args: {
  weekParam: string | undefined
  now: Date
  view: 'week' | 'list' | 'month'
}): {
  /** 週一 */
  weekStartKey: string
  /** 週日（weekStart + 6） */
  weekEndKey: string
  /** 錨點所在月的 1 日 */
  monthStartKey: string
  /** 月曆格第一格：monthStart 當天或之前的週日 */
  gridStartKey: string
  prevWeekKey: string
  nextWeekKey: string
  /** 含 */
  fetchStart: Date
  /** 不含 */
  fetchEndExclusive: Date
} {
  const anchor = isDateKey(args.weekParam) ? args.weekParam : taipeiDateKey(args.now)
  const wStart = weekStartKey(anchor, 1)
  const mStart = monthStartKey(anchor)
  // 月曆格是 6 列 × 7 欄，從月初當天或之前的週日開始
  const gridStart = weekStartKey(mStart, 0)
  const isMonth = args.view === 'month'
  return {
    weekStartKey: wStart,
    weekEndKey: addDaysKey(wStart, 6),
    monthStartKey: mStart,
    gridStartKey: gridStart,
    prevWeekKey: addDaysKey(wStart, -7),
    nextWeekKey: addDaysKey(wStart, 7),
    fetchStart: taipeiDayStart(isMonth ? gridStart : wStart),
    fetchEndExclusive: taipeiDayStart(isMonth ? addDaysKey(gridStart, 42) : addDaysKey(wStart, 7)),
  }
}
