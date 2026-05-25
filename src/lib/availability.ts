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
