// 行事曆的日期範圍計算（server 與 client 共用）。
// 日期一律以 yyyy-MM-dd 字串（dateKey）傳遞，運算用 Date.UTC，不受執行環境時區影響；
// 要換成時間點時以台灣日界（taipeiDayStart）為準。

import { taipeiDateKey, taipeiDayStart } from '@/lib/taipei-time'

const DAY_MS = 86400000

function parseKey(dateKey: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey)
  if (!m) throw new RangeError('無法辨識的日期')
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  if (toKey(d) !== dateKey) throw new RangeError('無法辨識的日期')
  return d
}

function toKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

function isDateKey(value: string | undefined): value is string {
  if (!value) return false
  try {
    parseKey(value)
    return true
  } catch {
    return false
  }
}

export function addDaysKey(dateKey: string, days: number): string {
  return toKey(new Date(parseKey(dateKey).getTime() + days * DAY_MS))
}

/** weekStartsOn：0=週日、1=週一；回傳該週第一天的 dateKey */
export function weekStartKey(dateKey: string, weekStartsOn: 0 | 1): string {
  const dow = parseKey(dateKey).getUTCDay()
  return addDaysKey(dateKey, -((dow - weekStartsOn + 7) % 7))
}

/** 該月 1 日，例：2026-12-01 */
export function monthStartKey(dateKey: string): string {
  parseKey(dateKey)
  return `${dateKey.slice(0, 7)}-01`
}

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
