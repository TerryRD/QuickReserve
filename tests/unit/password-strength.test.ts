import { describe, expect, it } from 'vitest'
import { checkPasswordStrength } from '@/lib/password-strength'

describe('checkPasswordStrength', () => {
  it('rejects common passwords in any case', () => {
    expect(checkPasswordStrength('password').ok).toBe(false)
    expect(checkPasswordStrength('Password1').ok).toBe(false)
  })

  it('rejects all-numeric sequences', () => {
    expect(checkPasswordStrength('12345678').ok).toBe(false)
    expect(checkPasswordStrength('19900101').ok).toBe(false)
  })

  it('rejects keyboard runs', () => {
    expect(checkPasswordStrength('qwerty12345').ok).toBe(false)
    expect(checkPasswordStrength('asdfghjkl').ok).toBe(false)
  })

  it('accepts strong random strings', () => {
    expect(checkPasswordStrength('S7@gPx#vL9$mQ').ok).toBe(true)
  })

  it('accepts decent passphrases', () => {
    expect(checkPasswordStrength('correct horse battery staple').ok).toBe(true)
  })

  it('returns the underlying score', () => {
    expect(checkPasswordStrength('password').score).toBeLessThan(2)
    expect(checkPasswordStrength('S7@gPx#vL9$mQ').score).toBeGreaterThanOrEqual(2)
  })
})
