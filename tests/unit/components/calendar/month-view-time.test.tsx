import { cleanup, render, screen } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import MonthView from '@/app/(tenant)/calendar/month-view'
import { SLOTS, ZONES } from './fixtures'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

const ORIGINAL_TZ = process.env.TZ

describe.each(ZONES)('行事曆月檢視（執行環境時區 $tz）', ({ tz, offset }) => {
  beforeAll(() => {
    process.env.TZ = tz
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  afterAll(() => {
    if (ORIGINAL_TZ === undefined) delete process.env.TZ
    else process.env.TZ = ORIGINAL_TZ
  })

  it('確實切到這個時區', () => {
    expect(new Date('2026-12-02T04:00:00Z').getTimezoneOffset()).toBe(offset)
  })

  it('兩筆時段都算在 12/02，12/03 沒有時段', () => {
    render(<MonthView monthAnchor="2026-12-01" slots={SLOTS} />)
    expect(screen.getByRole('button', { name: '2026-12-02 — 2 個時段' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '2026-12-03 — 0 個時段' })).toBeInTheDocument()
  })

  it('「今天」是台灣的今天：UTC 12/02 10:00（台灣 18:00）標在 12/02', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-12-02T10:00:00Z'))
    render(<MonthView monthAnchor="2026-12-01" slots={SLOTS} />)
    const todayCell = screen.getByRole('button', { name: /^2026-12-02 / })
    const nextCell = screen.getByRole('button', { name: /^2026-12-03 / })
    expect(todayCell.querySelector('.bg-accent')).not.toBeNull()
    expect(nextCell.querySelector('.bg-accent')).toBeNull()
  })
})
