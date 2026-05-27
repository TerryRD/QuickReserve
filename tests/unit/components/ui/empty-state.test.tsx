import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Calendar } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'

describe('EmptyState', () => {
  it('renders title and optional hint', () => {
    render(
      <EmptyState
        icon={<Calendar data-testid="es-icon" />}
        title="NO BOOKINGS"
        hint="尚無預約"
      />,
    )
    expect(screen.getByText('NO BOOKINGS')).toBeInTheDocument()
    expect(screen.getByText('尚無預約')).toBeInTheDocument()
    expect(screen.getByTestId('es-icon')).toBeInTheDocument()
  })

  it('renders cta when provided', () => {
    render(
      <EmptyState
        icon={<Calendar />}
        title="EMPTY"
        cta={<button>action</button>}
      />,
    )
    expect(screen.getByRole('button', { name: 'action' })).toBeInTheDocument()
  })

  it('has dashed border style', () => {
    const { container } = render(<EmptyState icon={<Calendar />} title="EMPTY" />)
    expect(container.firstChild).toHaveClass('border-dashed')
  })
})
