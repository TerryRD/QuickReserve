import { describe, it, expect } from 'vitest'
import { normalizeSlug } from '@/lib/utils/slug'

describe('normalizeSlug', () => {
  it('lowercases uppercase letters', () => {
    expect(normalizeSlug('TerryTest')).toBe('terrytest')
  })

  it('replaces spaces with single hyphen', () => {
    expect(normalizeSlug('Terry Test')).toBe('terry-test')
  })

  it('replaces underscores with hyphens', () => {
    expect(normalizeSlug('terry_test')).toBe('terry-test')
  })

  it('collapses repeated separators', () => {
    expect(normalizeSlug('terry   test___coach')).toBe('terry-test-coach')
  })

  it('strips non-alphanumeric characters', () => {
    expect(normalizeSlug('Terry@Coach!')).toBe('terrycoach')
  })

  it('strips CJK characters', () => {
    expect(normalizeSlug('林教練 Lin')).toBe('lin')
  })

  it('trims leading and trailing hyphens', () => {
    expect(normalizeSlug('---terry---')).toBe('terry')
  })

  it('returns empty string for input with no allowed chars', () => {
    expect(normalizeSlug('林教練')).toBe('')
  })

  it('handles empty input', () => {
    expect(normalizeSlug('')).toBe('')
  })
})
