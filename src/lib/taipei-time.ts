// 台灣時間（UTC+8，無日光節約）的顯示格式。
// 一律以 UTC 欄位換算，不受執行環境（伺服器、瀏覽器）時區影響。

const TAIPEI_OFFSET_MS = 8 * 3600 * 1000
const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六'] as const

export type TaipeiParts = {
  year: number
  /** 1–12 */
  month: number
  day: number
  hour: number
  minute: number
  /** 中文星期一個字，例：「三」 */
  weekday: (typeof WEEKDAY)[number]
}

const pad = (n: number) => String(n).padStart(2, '0')

/** 換算成台灣時間後的年月日時分與星期 */
export function taipeiParts(input: string | Date): TaipeiParts {
  const ms = (typeof input === 'string' ? new Date(input) : input).getTime()
  if (Number.isNaN(ms)) throw new RangeError('無法辨識的時間')
  const d = new Date(ms + TAIPEI_OFFSET_MS)
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    weekday: WEEKDAY[d.getUTCDay()]!,
  }
}

/** 例：19:00 */
export function formatTaipeiTime(input: string | Date): string {
  const p = taipeiParts(input)
  return `${pad(p.hour)}:${pad(p.minute)}`
}

/** 例：12/02（三）19:00；withYear 時為 2026/12/02（三）19:00 */
export function formatTaipeiDateTime(
  input: string | Date,
  options: { withYear?: boolean } = {},
): string {
  const p = taipeiParts(input)
  const date = `${pad(p.month)}/${pad(p.day)}`
  return `${options.withYear ? `${p.year}/` : ''}${date}（${p.weekday}）${pad(p.hour)}:${pad(p.minute)}`
}

/** 例：12/02 19:00（歷程等窄欄位用，不含星期） */
export function formatTaipeiMonthDayTime(input: string | Date): string {
  const p = taipeiParts(input)
  return `${pad(p.month)}/${pad(p.day)} ${pad(p.hour)}:${pad(p.minute)}`
}

/** 例：12/2 19:00（月、日不補零；通知清單等較早的時間用） */
export function formatTaipeiShortMonthDayTime(input: string | Date): string {
  const p = taipeiParts(input)
  return `${p.month}/${p.day} ${pad(p.hour)}:${pad(p.minute)}`
}

/** 時段區間，例：2026/12/06（日）14:00–15:30 */
export function formatTaipeiSlotRange(start: string | Date, end: string | Date): string {
  return `${formatTaipeiDateTime(start, { withYear: true })}–${formatTaipeiTime(end)}`
}
