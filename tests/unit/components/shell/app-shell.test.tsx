import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { AppShell } from '@/components/shell/app-shell'

describe('AppShell', () => {
  it('renders title and children', () => {
    render(
      <AppShell title="總覽" kicker="DASHBOARD · 2026.05.27">
        <div>page-content</div>
      </AppShell>,
    )
    expect(screen.getByText('總覽')).toBeInTheDocument()
    expect(screen.getByText('DASHBOARD · 2026.05.27')).toBeInTheDocument()
    expect(screen.getByText('page-content')).toBeInTheDocument()
  })

  it('renders subnav slot when provided', () => {
    render(
      <AppShell title="X" subnav={<nav>SUB</nav>}>
        <div>c</div>
      </AppShell>,
    )
    expect(screen.getByText('SUB')).toBeInTheDocument()
  })

  it('renders actions slot when provided', () => {
    render(
      <AppShell title="X" actions={<button>ACT</button>}>
        <div>c</div>
      </AppShell>,
    )
    expect(screen.getByRole('button', { name: 'ACT' })).toBeInTheDocument()
  })
})
