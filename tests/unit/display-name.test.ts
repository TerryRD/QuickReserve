import { describe, expect, it } from 'vitest'
import { resolveDisplayName } from '@/lib/auth/display-name'

describe('resolveDisplayName', () => {
  it('uses full display name when present', () => {
    expect(resolveDisplayName({ displayName: '王小明', email: 'a@b.com' })).toBe('王小明')
  })
  it('trims whitespace-only display name and falls back to email local part', () => {
    expect(resolveDisplayName({ displayName: '   ', email: 'coach@example.com' })).toBe('coach')
  })
  it('falls back to email local part when no display name', () => {
    expect(resolveDisplayName({ displayName: null, email: 'coach@example.com' })).toBe('coach')
  })
  it('uses raw email when it has no @ somehow', () => {
    expect(resolveDisplayName({ displayName: null, email: 'weird' })).toBe('weird')
  })
  it('returns 使用者 when nothing is available', () => {
    expect(resolveDisplayName({ displayName: null, email: null })).toBe('使用者')
  })
})
