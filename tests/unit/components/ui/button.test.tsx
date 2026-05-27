import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Button } from '@/components/ui/button'

describe('Button extensions', () => {
  it('renders fullWidth class when fullWidth prop set', () => {
    render(<Button fullWidth>Go</Button>)
    expect(screen.getByRole('button')).toHaveClass('w-full')
  })

  it('renders arrow circle indicator when withArrow="circle"', () => {
    render(<Button withArrow="circle">Go</Button>)
    expect(screen.getByTestId('btn-arrow-circle')).toBeInTheDocument()
  })

  it('renders inline arrow indicator when withArrow="inline"', () => {
    render(<Button withArrow="inline">Go</Button>)
    expect(screen.getByTestId('btn-arrow-inline')).toBeInTheDocument()
  })

  it('does not render arrow when withArrow not provided', () => {
    render(<Button>Go</Button>)
    expect(screen.queryByTestId('btn-arrow-circle')).not.toBeInTheDocument()
    expect(screen.queryByTestId('btn-arrow-inline')).not.toBeInTheDocument()
  })
})
