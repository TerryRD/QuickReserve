import { cleanup, render } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import WeekGrid from '@/app/(tenant)/calendar/week-grid'
import { SLOTS, ZONES } from './fixtures'

vi.mock('@/app/(tenant)/calendar/slot-popover', () => ({
  default: ({ children, timeLabel }: { children: React.ReactNode; timeLabel: string }) => (
    <div data-testid="slot" data-time={timeLabel}>
      {children}
    </div>
  ),
}))

const ORIGINAL_TZ = process.env.TZ

/** 找出「某小時列 × 第幾天欄」那一格 */
function cellAt(container: HTMLElement, hourLabel: string, dayIndex: number) {
  const grid = container.querySelector('.grid')!
  const children = Array.from(grid.children)
  const labelIdx = children.findIndex((c) => c.textContent === hourLabel)
  expect(labelIdx, `找不到 ${hourLabel} 列`).toBeGreaterThan(0)
  return children[labelIdx + 1 + dayIndex]!
}

describe.each(ZONES)('行事曆週檢視（執行環境時區 $tz）', ({ tz, offset }) => {
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

  it('欄位標題是 11/30（週一）起的 7 天', () => {
    const { container } = render(
      <WeekGrid weekStart="2026-11-30" slots={SLOTS} showMemberLabel={false} />,
    )
    const grid = container.querySelector('.grid')!
    const headers = Array.from(grid.children)
      .slice(1, 8)
      .map((c) => c.textContent)
    expect(headers).toEqual([
      'Mon11/30',
      'Tue12/01',
      'Wed12/02',
      'Thu12/03',
      'Fri12/04',
      'Sat12/05',
      'Sun12/06',
    ])
  })

  it('台灣 19:00 的時段落在 12/02 欄的 19:00 列，標籤為 19:00-20:00', () => {
    const { container } = render(
      <WeekGrid weekStart="2026-11-30" slots={SLOTS} showMemberLabel={false} />,
    )
    const night = cellAt(container, '19:00', 2).querySelectorAll('[data-testid="slot"]')
    expect(Array.from(night).map((el) => el.getAttribute('data-time'))).toEqual(['19:00-20:00'])
    const noon = cellAt(container, '12:00', 2).querySelectorAll('[data-testid="slot"]')
    expect(Array.from(noon).map((el) => el.getAttribute('data-time'))).toEqual(['12:00-13:00'])
    // 隔天（12/03）欄不能出現這兩筆
    expect(container.querySelectorAll('[data-testid="slot"]')).toHaveLength(2)
  })
})
