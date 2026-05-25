export type Range = { start: Date; end: Date }

export type TemplateWindow = {
  weekday: number // ISO 1=Mon..7=Sun
  start_time: string // 'HH:MM' or 'HH:MM:SS'
  end_time: string
}

export function subtractRanges(base: Range[], cuts: Range[]): Range[] {
  let result = base.slice()
  for (const cut of cuts) {
    const next: Range[] = []
    for (const piece of result) {
      // No overlap
      if (cut.end <= piece.start || cut.start >= piece.end) {
        next.push(piece)
        continue
      }
      // Cut covers entire piece — drop it
      if (cut.start <= piece.start && cut.end >= piece.end) {
        continue
      }
      // Leading portion survives
      if (cut.start > piece.start) {
        next.push({ start: piece.start, end: cut.start })
      }
      // Trailing portion survives
      if (cut.end < piece.end) {
        next.push({ start: cut.end, end: piece.end })
      }
    }
    result = next
  }
  return result
}

function isoWeekday(date: Date, tzOffsetHours: number): number {
  const shifted = new Date(date.getTime() + tzOffsetHours * 3600 * 1000)
  const jsDay = shifted.getUTCDay() // 0=Sun..6=Sat
  return ((jsDay + 6) % 7) + 1 // 1=Mon..7=Sun
}

function localDayStart(date: Date, tzOffsetHours: number): Date {
  const shifted = new Date(date.getTime() + tzOffsetHours * 3600 * 1000)
  const y = shifted.getUTCFullYear()
  const m = shifted.getUTCMonth()
  const d = shifted.getUTCDate()
  // Reconstruct as UTC midnight then shift back by tz offset to get local midnight as UTC
  return new Date(Date.UTC(y, m, d) - tzOffsetHours * 3600 * 1000)
}

function applyWindow(dayStart: Date, time: string): Date {
  const [h, m] = time.split(':').map(Number) as [number, number]
  return new Date(dayStart.getTime() + (h * 60 + m) * 60 * 1000)
}

export function effectiveAvailability(args: {
  date: Date
  activeTemplate: { windows: TemplateWindow[] } | null
  unavailableEvents: Range[]
  tzOffsetHours: number
}): Range[] {
  const { date, activeTemplate, unavailableEvents, tzOffsetHours } = args
  const dayStart = localDayStart(date, tzOffsetHours)
  const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000)

  let base: Range[]
  if (activeTemplate === null) {
    base = [{ start: dayStart, end: dayEnd }]
  } else {
    const weekday = isoWeekday(date, tzOffsetHours)
    base = activeTemplate.windows
      .filter((w) => w.weekday === weekday)
      .map((w) => ({
        start: applyWindow(dayStart, w.start_time),
        end: applyWindow(dayStart, w.end_time),
      }))
      .sort((a, b) => a.start.getTime() - b.start.getTime())
  }

  if (base.length === 0) return []

  const cuts = unavailableEvents
    .filter((e) => e.end > dayStart && e.start < dayEnd)
    .map((e) => ({
      start: e.start < dayStart ? dayStart : e.start,
      end: e.end > dayEnd ? dayEnd : e.end,
    }))

  return subtractRanges(base, cuts)
}
