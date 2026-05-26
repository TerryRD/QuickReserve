import { describe, it, expect } from 'vitest'
import { sanitizeBioHtml } from '@/lib/sanitize'

describe('sanitizeBioHtml', () => {
  it('keeps allowed tags', () => {
    const input = '<p>hello <strong>world</strong></p><ul><li>one</li></ul>'
    expect(sanitizeBioHtml(input)).toBe(input)
  })

  it('strips <script>', () => {
    const input = '<p>safe</p><script>alert(1)</script>'
    expect(sanitizeBioHtml(input)).toBe('<p>safe</p>')
  })

  it('strips inline event handlers', () => {
    const input = '<p onclick="alert(1)">x</p>'
    expect(sanitizeBioHtml(input)).toBe('<p>x</p>')
  })

  it('strips style attribute', () => {
    const input = '<p style="color:red">x</p>'
    expect(sanitizeBioHtml(input)).toBe('<p>x</p>')
  })

  it('rewrites links with rel + target', () => {
    const input = '<a href="https://example.com">link</a>'
    const out = sanitizeBioHtml(input)
    expect(out).toContain('rel="noopener noreferrer"')
    expect(out).toContain('target="_blank"')
    expect(out).toContain('href="https://example.com"')
  })

  it('strips javascript: URLs', () => {
    const input = '<a href="javascript:alert(1)">x</a>'
    const out = sanitizeBioHtml(input)
    expect(out).not.toContain('javascript:')
  })

  it('allows mailto: links', () => {
    const out = sanitizeBioHtml('<a href="mailto:a@b.com">mail</a>')
    expect(out).toContain('href="mailto:a@b.com"')
  })

  it('strips <iframe>', () => {
    expect(sanitizeBioHtml('<iframe src="x"></iframe><p>ok</p>')).toBe('<p>ok</p>')
  })

  it('returns empty string for empty input', () => {
    expect(sanitizeBioHtml('')).toBe('')
  })
})
