import { describe, expect, it } from 'vitest'
import { CHECKIN_OPEN_BEFORE_MIN, canCheckIn } from '@/lib/checkin-window'

const start = '2026-06-13T10:00:00.000Z'
const end = '2026-06-13T11:00:00.000Z'

describe('canCheckIn', () => {
  it('blocks before the open window (>30 min before start)', () => {
    expect(canCheckIn(new Date('2026-06-13T09:29:00.000Z'), start, end)).toBe(false)
  })
  it('allows exactly at the open boundary (start - 30 min)', () => {
    expect(canCheckIn(new Date('2026-06-13T09:30:00.000Z'), start, end)).toBe(true)
  })
  it('allows during class', () => {
    expect(canCheckIn(new Date('2026-06-13T10:30:00.000Z'), start, end)).toBe(true)
  })
  it('allows at end_at', () => {
    expect(canCheckIn(new Date('2026-06-13T11:00:00.000Z'), start, end)).toBe(true)
  })
  it('blocks after end_at', () => {
    expect(canCheckIn(new Date('2026-06-13T11:00:01.000Z'), start, end)).toBe(false)
  })
  it('exposes the 30-minute constant', () => {
    expect(CHECKIN_OPEN_BEFORE_MIN).toBe(30)
  })
})
