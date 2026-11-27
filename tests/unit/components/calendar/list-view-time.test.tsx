import { cleanup, render } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import CalendarListView from '@/app/(tenant)/calendar/list-view'
import { SLOTS, ZONES } from './fixtures'

vi.mock('@/app/(tenant)/calendar/slot-popover', () => ({
  default: ({ children, timeLabel }: { children: React.ReactNode; timeLabel: string }) => (
    <div data-testid="slot" data-time={timeLabel}>
      {children}
    </div>
  ),
}))

const ORIGINAL_TZ = process.env.TZ

describe.each(ZONES)('行事曆清單檢視（執行環境時區 $tz）', ({ tz, offset }) => {
  beforeAll(() => {
    process.env.TZ = tz
  })

  afterEach(() => cleanup())

  afterAll(() => {
    if (ORIGINAL_TZ === undefined) delete process.env.TZ
    else process.env.TZ = ORIGINAL_TZ
  })

  it('確實切到這個時區', () => {
    expect(new Date('2026-12-02T04:00:00Z').getTimezoneOffset()).toBe(offset)
  })

  it('兩筆都歸在台灣 12/2 那一天，時間以台灣時間顯示', () => {
    const { container } = render(<CalendarListView slots={SLOTS} showMemberLabel={false} />)
    const sections = container.querySelectorAll('section')
    expect(sections).toHaveLength(1)
    expect(sections[0]!.querySelector('header')!.textContent).toMatch(/^12\/2 /)
    const labels = Array.from(sections[0]!.querySelectorAll('[data-testid="slot"]')).map((el) =>
      el.getAttribute('data-time'),
    )
    expect(labels).toEqual(['12:00-13:00', '19:00-20:00'])
  })
})
