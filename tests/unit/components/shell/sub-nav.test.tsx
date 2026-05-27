import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { SubNav } from '@/components/shell/sub-nav'

const ITEMS = [
  { href: '/settings/profile', label: '公開頁', eng: 'PROFILE' },
  { href: '/settings/notifications', label: '通知', eng: 'NOTIF' },
]

describe('SubNav', () => {
  it('renders all items', () => {
    render(<SubNav items={ITEMS} active="/settings/profile" />)
    expect(screen.getByText('PROFILE')).toBeInTheDocument()
    expect(screen.getByText('NOTIF')).toBeInTheDocument()
  })

  it('marks the active item with aria-current', () => {
    render(<SubNav items={ITEMS} active="/settings/notifications" />)
    const active = screen.getByText('NOTIF').closest('a')
    expect(active).toHaveAttribute('aria-current', 'page')
  })
})
