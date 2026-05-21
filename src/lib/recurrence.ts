/**
 * Recurrence computation: turn a recurring_rules row into concrete occurrences
 * inside a [from, to] window. All times computed in Asia/Taipei (UTC+8) and
 * returned as ISO UTC strings.
 */

export type RecurringRuleInput = {
  freq: 'daily' | 'weekly' | 'monthly' | 'every_n_days'
  interval_n: number
  by_weekday: number[] | null // ISO: 1=Mon..7=Sun
  by_month_day: number | null // 1..31
  start_date: string // 'YYYY-MM-DD'
  start_time: string // 'HH:MM:SS' or 'HH:MM'
  end_time: string
  end_condition: 'count' | 'until' | 'none'
  end_count: number | null
  end_until: string | null // 'YYYY-MM-DD'
}

export type Occurrence = {
  startAt: string // ISO UTC
  endAt: string // ISO UTC
}

const TZ_OFFSET = '+08:00' // Asia/Taipei

function localToIso(date: string, time: string): string {
  const t = time.length === 5 ? `${time}:00` : time
  return new Date(`${date}T${t}${TZ_OFFSET}`).toISOString()
}

function dateOnly(date: Date): string {
  // Convert Date in local TZ to 'YYYY-MM-DD' in UTC+8
  const utcMs = date.getTime()
  const taipeiMs = utcMs + 8 * 3600 * 1000
  return new Date(taipeiMs).toISOString().slice(0, 10)
}

function parseDateParts(dateStr: string): [number, number, number] {
  const parts = dateStr.split('-').map(Number)
  return [parts[0]!, parts[1]!, parts[2]!]
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = parseDateParts(dateStr)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().slice(0, 10)
}

function addMonths(dateStr: string, months: number): string {
  const [y, m] = parseDateParts(dateStr)
  const dt = new Date(Date.UTC(y, m - 1 + months, 1))
  return dt.toISOString().slice(0, 10)
}

function isoWeekday(dateStr: string): number {
  const [y, m, d] = parseDateParts(dateStr)
  const jsDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0=Sun..6=Sat
  return ((jsDay + 6) % 7) + 1
}

function isValidDayOfMonth(year: number, month: number, day: number): boolean {
  // month: 1..12, day: 1..31
  const d = new Date(Date.UTC(year, month - 1, day))
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day
}

export function computeOccurrences(
  rule: RecurringRuleInput,
  windowStart: Date,
  windowEnd: Date,
): Occurrence[] {
  const windowStartDay = dateOnly(windowStart)
  const windowEndDay = dateOnly(windowEnd)

  const cursor = rule.start_date
  const occurrences: Occurrence[] = []
  const cap = rule.end_condition === 'count' ? (rule.end_count ?? 0) : Number.POSITIVE_INFINITY
  const untilDay =
    rule.end_condition === 'until' && rule.end_until ? rule.end_until : '9999-12-31'

  // Generate up to a soft upper bound to prevent infinite loops on misconfigured rules
  const SAFETY_CAP = 5000

  if (rule.freq === 'daily' || rule.freq === 'every_n_days') {
    const step = Math.max(1, rule.interval_n)
    let day = cursor
    let emittedTotal = 0
    let i = 0
    while (i++ < SAFETY_CAP && emittedTotal < cap && day <= untilDay && day <= windowEndDay) {
      if (day >= windowStartDay) {
        occurrences.push({
          startAt: localToIso(day, rule.start_time),
          endAt: localToIso(day, rule.end_time),
        })
      }
      emittedTotal++
      day = addDays(day, step)
    }
    return occurrences
  }

  if (rule.freq === 'weekly') {
    const step = Math.max(1, rule.interval_n) * 7
    const weekdays = (rule.by_weekday ?? []).slice().sort((a, b) => a - b)
    if (weekdays.length === 0) return []
    // Find the Monday of the week containing start_date
    const startISO = isoWeekday(cursor) // 1..7
    const mondayOfStart = addDays(cursor, -(startISO - 1))

    let weekMonday = mondayOfStart
    let emittedTotal = 0
    let i = 0
    while (i++ < SAFETY_CAP && emittedTotal < cap && weekMonday <= untilDay && weekMonday <= windowEndDay) {
      for (const wd of weekdays) {
        const day = addDays(weekMonday, wd - 1)
        if (day < cursor) continue // before rule start
        if (day > untilDay) break
        if (day > windowEndDay) break
        if (emittedTotal >= cap) break
        if (day >= windowStartDay) {
          occurrences.push({
            startAt: localToIso(day, rule.start_time),
            endAt: localToIso(day, rule.end_time),
          })
        }
        emittedTotal++
      }
      weekMonday = addDays(weekMonday, step)
    }
    return occurrences
  }

  if (rule.freq === 'monthly') {
    const dom = rule.by_month_day
    if (!dom) return []
    const step = Math.max(1, rule.interval_n)
    let monthCursor = cursor.slice(0, 7) + '-01' // first of month
    let emittedTotal = 0
    let i = 0
    while (i++ < SAFETY_CAP && emittedTotal < cap && monthCursor <= untilDay && monthCursor <= windowEndDay) {
      const parts = monthCursor.split('-').map(Number)
      const y = parts[0]!
      const m = parts[1]!
      if (isValidDayOfMonth(y, m, dom)) {
        const day = `${y}-${String(m).padStart(2, '0')}-${String(dom).padStart(2, '0')}`
        if (day >= cursor && day <= untilDay && day <= windowEndDay) {
          if (day >= windowStartDay) {
            occurrences.push({
              startAt: localToIso(day, rule.start_time),
              endAt: localToIso(day, rule.end_time),
            })
          }
          emittedTotal++
        }
      }
      monthCursor = addMonths(monthCursor, step)
    }
    return occurrences
  }

  return occurrences
}
