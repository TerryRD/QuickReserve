// 日期字串（dateKey，yyyy-MM-dd）的運算（server 與 client 共用）。
// 運算用 Date.UTC，不受執行環境時區影響；要換成時間點時以台灣日界（taipeiDayStart）為準。

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

/** 是否為格式正確且真的存在的日期（2026-02-30 不算） */
export function isDateKey(value: string | undefined): value is string {
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
