import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { actionClient } from '@/lib/safe-action'
import { ForbiddenError } from '@/lib/errors'

describe('safeAction', () => {
  it('validates input with Zod and returns ok on success', async () => {
    const action = actionClient
      .inputSchema(z.object({ name: z.string().min(1) }))
      .action(async ({ parsedInput }) => {
        return { greeting: `hi ${parsedInput.name}` }
      })

    const result = await action({ name: 'wang' })
    expect(result?.data).toEqual({ greeting: 'hi wang' })
  })

  it('returns serverError shape on AppError', async () => {
    const action = actionClient.action(async () => {
      throw new ForbiddenError()
    })
    const result = await action()
    expect(result?.serverError).toMatchObject({ code: 'FORBIDDEN' })
  })

  it('returns validationErrors when zod parse fails', async () => {
    const action = actionClient
      .inputSchema(z.object({ name: z.string().min(1) }))
      .action(async () => ({ ok: true }))

    const result = await action({ name: '' })
    expect(result?.validationErrors).toBeDefined()
  })
})
