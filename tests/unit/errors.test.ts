import { describe, expect, it } from 'vitest'
import {
  AppError,
  ForbiddenError,
  NotFoundError,
  RateLimitError,
  SlotConflictError,
  SlotUnavailableError,
  ValidationError,
} from '@/lib/errors'

describe('AppError', () => {
  it('is an Error subclass with code and message', () => {
    const err = new AppError('SOME_CODE', 'human message')
    expect(err).toBeInstanceOf(Error)
    expect(err.code).toBe('SOME_CODE')
    expect(err.message).toBe('human message')
    expect(err.name).toBe('AppError')
  })

  it('ForbiddenError has FORBIDDEN code', () => {
    expect(new ForbiddenError().code).toBe('FORBIDDEN')
  })

  it('NotFoundError takes a resource name', () => {
    const err = new NotFoundError('booking')
    expect(err.code).toBe('NOT_FOUND')
    expect(err.message).toContain('booking')
  })

  it('RateLimitError code', () => {
    expect(new RateLimitError().code).toBe('RATE_LIMIT')
  })

  it('ValidationError carries field details', () => {
    const err = new ValidationError({ fieldErrors: { email: ['required'] } })
    expect(err.code).toBe('VALIDATION')
    expect(err.details).toEqual({ fieldErrors: { email: ['required'] } })
  })

  it('SlotConflictError carries conflicts array', () => {
    const conflicts = [{ id: 'a', startAt: '2026-05-21T14:00:00Z' }]
    const err = new SlotConflictError(conflicts)
    expect(err.code).toBe('SLOT_CONFLICT')
    expect(err.conflicts).toBe(conflicts)
  })

  it('SlotUnavailableError code', () => {
    expect(new SlotUnavailableError().code).toBe('SLOT_UNAVAILABLE')
  })
})
