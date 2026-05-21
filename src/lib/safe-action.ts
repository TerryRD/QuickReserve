import { createSafeActionClient, DEFAULT_SERVER_ERROR_MESSAGE } from 'next-safe-action'
import { AppError } from '@/lib/errors'

const baseClient = createSafeActionClient({
  handleServerError(error) {
    if (error instanceof AppError) {
      return {
        code: error.code,
        message: error.message,
        details: error.details ?? null,
      }
    }
    // Unknown error: log full server-side, return generic to client
    console.error('[safe-action] unhandled', error)
    return {
      code: 'INTERNAL_ERROR',
      message: DEFAULT_SERVER_ERROR_MESSAGE,
      details: null,
    }
  },
})

export const actionClient = baseClient
