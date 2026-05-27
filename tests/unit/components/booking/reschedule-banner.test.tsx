import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { RescheduleBanner } from '@/components/booking/reschedule-banner'

describe('RescheduleBanner', () => {
  it('renders booking summary', () => {
    render(
      <RescheduleBanner
        originalSlotLabel="8/19 (二) 16:00"
        serviceName="一對一肌力訓練"
        exitHref="/<slug>"
      />,
    )
    expect(screen.getByText(/改期模式/)).toBeInTheDocument()
    expect(screen.getByText(/8\/19 \(二\) 16:00/)).toBeInTheDocument()
    expect(screen.getByText(/一對一肌力訓練/)).toBeInTheDocument()
  })

  it('renders exit link to exitHref', () => {
    render(
      <RescheduleBanner
        originalSlotLabel="x"
        serviceName="y"
        exitHref="/coach-foo"
      />,
    )
    const link = screen.getByRole('link', { name: /退出改期/ })
    expect(link).toHaveAttribute('href', '/coach-foo')
  })
})
