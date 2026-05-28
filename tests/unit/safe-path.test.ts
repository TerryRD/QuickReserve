import { describe, it, expect } from 'vitest'
import { safePath } from '@/lib/safe-path'

describe('safePath', () => {
  it('returns / for null / undefined / empty', () => {
    expect(safePath(undefined)).toBe('/')
    expect(safePath(null)).toBe('/')
    expect(safePath('')).toBe('/')
  })

  it('allows internal absolute paths', () => {
    expect(safePath('/dashboard')).toBe('/dashboard')
    expect(safePath('/my-bookings')).toBe('/my-bookings')
    expect(safePath('/foo/bar?q=1')).toBe('/foo/bar?q=1')
    expect(safePath('/coach-poyu?reschedule=abc')).toBe('/coach-poyu?reschedule=abc')
  })

  it('blocks non-absolute paths', () => {
    expect(safePath('dashboard')).toBe('/')
    expect(safePath('foo/bar')).toBe('/')
    expect(safePath('http://evil.com')).toBe('/')
    expect(safePath('https://evil.com')).toBe('/')
    expect(safePath('javascript:alert(1)')).toBe('/')
    expect(safePath('data:text/html,<script>')).toBe('/')
  })

  it('blocks protocol-relative URLs', () => {
    expect(safePath('//evil.com')).toBe('/')
    expect(safePath('//evil.com/foo')).toBe('/')
  })

  it('blocks backslash bypass (browsers normalize /\\foo to //foo)', () => {
    expect(safePath('/\\evil.com')).toBe('/')
    expect(safePath('/\\\\evil.com')).toBe('/')
  })

  it('does NOT block paths that contain // mid-string', () => {
    // Only the prefix matters — /foo//bar is a valid internal path
    expect(safePath('/foo//bar')).toBe('/foo//bar')
  })
})
