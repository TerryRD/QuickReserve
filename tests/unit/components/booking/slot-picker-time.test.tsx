import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import SlotPicker from '@/app/[tenantSlug]/slot-picker'

const replace = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

const ORIGINAL_TZ = process.env.TZ

// 資料庫存 UTC：2026-12-02T04:00Z = 台灣 12/02 12:00
const SLOT = {
  id: 'slot-1',
  start_at: '2026-12-02T04:00:00.000Z',
  end_at: '2026-12-02T05:00:00.000Z',
  max_capacity: 1,
  current_bookings: 0,
}

function mockFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string) => {
      const url = String(input)
      if (url.startsWith('/api/public/slot-days')) {
        return { ok: true, status: 200, json: async () => ({ days: { '2026-12-02': 1 } }) }
      }
      if (url.startsWith('/api/public/slots')) {
        return { ok: true, status: 200, json: async () => ({ slots: [SLOT] }) }
      }
      return { ok: false, status: 404, json: async () => ({}) }
    }),
  )
}

function renderPicker(initialDate: string) {
  return render(
    <SlotPicker
      tenantSlug="coach"
      tenantId="00000000-0000-0000-0000-000000000001"
      serviceId="00000000-0000-0000-0000-000000000002"
      serviceName="一對一課程"
      serviceDuration={60}
      servicePrice={1200}
      initialDate={initialDate}
      rescheduleFrom={null}
    />,
  )
}

// 每種執行環境時區的實際位移（分鐘，getTimezoneOffset 的正負號與 UTC 位移相反）
const ZONES = [
  { tz: 'Asia/Taipei', offset: -480 },
  { tz: 'UTC', offset: 0 },
] as const

describe.each(ZONES)('公開頁時段選擇器（執行環境時區 $tz）', ({ tz, offset }) => {
  beforeAll(() => {
    process.env.TZ = tz
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.unstubAllGlobals()
    replace.mockReset()
  })

  afterAll(() => {
    if (ORIGINAL_TZ === undefined) delete process.env.TZ
    else process.env.TZ = ORIGINAL_TZ
  })

  it('確實切到這個時區', () => {
    expect(new Date('2026-12-02T04:00:00Z').getTimezoneOffset()).toBe(offset)
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(tz === 'UTC' ? 'UTC' : tz)
  })

  it('時段按鈕與摘要列都以台灣時間顯示 12:00', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-12-01T02:00:00Z'))
    mockFetch()
    renderPicker('2026-12-02')

    const chips = await screen.findAllByRole('button', { name: /^\d\d:\d\d$/ })
    expect(chips.map((c) => c.textContent)).toEqual(['12:00'])
    expect(screen.queryByText('20:00')).not.toBeInTheDocument()

    fireEvent.click(chips[0]!)
    await waitFor(() => expect(screen.getByText('12/2 · 12:00')).toBeInTheDocument())
    expect(screen.queryByText(/20:00/)).not.toBeInTheDocument()
  })

  it('「今天」是台灣的今天：UTC 12/01 20:00 時台灣已是 12/02', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-12-01T20:00:00Z'))
    mockFetch()
    renderPicker('2026-12-05')

    await screen.findByRole('button', { name: /^2026-12-02/ })
    // 台灣 12/01 已過，不能選
    expect(screen.getByRole('button', { name: /^2026-12-01/ })).toBeDisabled()
    // 「今天」標記落在 12/02 那格
    expect(screen.getByRole('button', { name: /^2026-12-02/ })).toHaveTextContent('今天')

    fireEvent.click(screen.getByRole('button', { name: '今天' }))
    expect(replace).toHaveBeenCalledTimes(1)
    expect(replace.mock.calls[0]![0]).toContain('date=2026-12-02')
  })

  it('「今天」跨月：UTC 11/30 20:00 時台灣已是 12/01，跳回的月份是 12 月', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-30T20:00:00Z'))
    mockFetch()
    renderPicker('2027-01-05')

    fireEvent.click(screen.getByRole('button', { name: '今天' }))
    expect(replace.mock.calls[0]![0]).toContain('date=2026-12-01')
    await waitFor(() => expect(screen.getByText('2026 / 12')).toBeInTheDocument())
  })
})
