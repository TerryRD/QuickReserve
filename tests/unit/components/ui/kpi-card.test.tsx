import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Clock } from 'lucide-react'
import { KpiCard } from '@/components/ui/kpi-card'

describe('KpiCard', () => {
  it('renders label / value / optional unit and hint', () => {
    render(
      <KpiCard
        label="本週待確認"
        value={5}
        unit="筆"
        hint="教練核可中"
        icon={<Clock data-testid="kpi-icon" />}
      />,
    )
    expect(screen.getByText('本週待確認')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('筆')).toBeInTheDocument()
    expect(screen.getByText('教練核可中')).toBeInTheDocument()
    expect(screen.getByTestId('kpi-icon')).toBeInTheDocument()
  })

  it('applies accent border when accent prop true', () => {
    const { container } = render(<KpiCard label="x" value={1} accent />)
    expect(container.firstChild).toHaveClass('border-accent')
  })
})
