// @vitest-environment node
import WebSocket from 'ws'
if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket
}
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import { verifyCurrentPassword } from '@/lib/auth/verify-password'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const admin = createClient<Database>(SUPABASE_URL, SERVICE_KEY)

const email = `acct-verify-${Date.now()}@example.com`
const password = 'TestPass123!'
let userId: string | undefined

describe('verifyCurrentPassword', () => {
  beforeAll(async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (error || !data?.user) throw new Error(`create user failed: ${error?.message}`)
    userId = data.user.id
  })

  afterAll(async () => {
    if (userId) await admin.auth.admin.deleteUser(userId)
  })

  it('returns true for the correct password', async () => {
    expect(await verifyCurrentPassword(email, password)).toBe(true)
  })

  it('returns false for a wrong password', async () => {
    expect(await verifyCurrentPassword(email, 'WrongPass999!')).toBe(false)
  })
})
