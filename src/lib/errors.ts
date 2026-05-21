export class AppError extends Error {
  public readonly code: string
  public readonly details?: unknown

  constructor(code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.details = details
  }
}

export class ForbiddenError extends AppError {
  constructor(message = '無權限執行此操作') {
    super('FORBIDDEN', message)
    this.name = 'ForbiddenError'
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super('NOT_FOUND', `${resource} 不存在`)
    this.name = 'NotFoundError'
  }
}

export class RateLimitError extends AppError {
  constructor(message = '請稍後再試') {
    super('RATE_LIMIT', message)
    this.name = 'RateLimitError'
  }
}

export class ValidationError extends AppError {
  constructor(details: unknown, message = '輸入格式錯誤') {
    super('VALIDATION', message, details)
    this.name = 'ValidationError'
  }
}

export type ConflictSlot = {
  id: string
  startAt: string
  endAt?: string
  serviceName?: string
  hasBooking?: boolean
  bookingId?: string | null
}

export class SlotConflictError extends AppError {
  public readonly conflicts: ConflictSlot[]

  constructor(conflicts: ConflictSlot[], message = '時段衝突') {
    super('SLOT_CONFLICT', message, conflicts)
    this.name = 'SlotConflictError'
    this.conflicts = conflicts
  }
}

export class SlotUnavailableError extends AppError {
  constructor(message = '該時段已被預約') {
    super('SLOT_UNAVAILABLE', message)
    this.name = 'SlotUnavailableError'
  }
}
