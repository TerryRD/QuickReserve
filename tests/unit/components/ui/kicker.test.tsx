import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Kicker } from '@/components/ui/kicker'

describe('Kicker', () => {
  it('renders children with mono uppercase tracking', () => {
    render(<Kicker>DASHBOARD · OVERVIEW</Kicker>)
    const el = screen.getByText('DASHBOARD · OVERVIEW')
    expect(el).toHaveClass('font-mono')
    expect(el.className).toMatch(/tracking-\[0\.18em\]/)
    expect(el.className).toMatch(/uppercase/)
  })
  it('merges className prop', () => {
    render(<Kicker className="custom-x">KICK</Kicker>)
    expect(screen.getByText('KICK')).toHaveClass('custom-x')
  })
})
