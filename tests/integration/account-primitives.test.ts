// @vitest-environment node
import WebSocket from 'ws'
if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket
}
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const admin = createClient<Database>(SUPABASE_URL, SERVICE_KEY)

const ts = Date.now()
const custEmail = `acct-cust-${ts}@example.com`
const password = 'TestPass123!'
const otherEmail = `acct-other-${ts}@example.com`
let custId: string | undefined
let otherId: string | undefined

describe('account settings DB primitives', () => {
  beforeAll(async () => {
    const { data: c, error: cErr } = await admin.auth.admin.createUser({
      email: custEmail,
      password,
      email_confirm: true,
    })
    if (cErr || !c?.user) throw new Error(`create cust failed: ${cErr?.message}`)
    custId = c.user.id
    const { error: insErr } = await admin
      .from('customers')
      .insert({ id: custId, display_name: '舊名字' })
    if (insErr) throw new Error(`insert customer failed: ${insErr.message}`)

    const { data: o, error: oErr } = await admin.auth.admin.createUser({
      email: otherEmail,
      password,
      email_confirm: true,
    })
    if (oErr || !o?.user) throw new Error(`create other failed: ${oErr?.message}`)
    otherId = o.user.id
  })

  afterAll(async () => {
    if (custId) await admin.auth.admin.deleteUser(custId)
    if (otherId) await admin.auth.admin.deleteUser(otherId)
  })

  it('customer can update own customers.display_name under RLS', async () => {
    const client = createClient<Database>(SUPABASE_URL, ANON_KEY)
    const { error: signErr } = await client.auth.signInWithPassword({
      email: custEmail,
      password,
    })
    expect(signErr).toBeNull()
    const { error } = await client.from('customers').update({ display_name: '新名字' }).eq('id', custId!)
    expect(error).toBeNull()
    const { data } = await admin.from('customers').select('display_name').eq('id', custId!).single()
    expect(data?.display_name).toBe('新名字')
  })

  it('admin updateUserById changes email instantly with email_confirm', async () => {
    const newEmail = `acct-cust-changed-${ts}@example.com`
    const { error } = await admin.auth.admin.updateUserById(custId!, {
      email: newEmail,
      email_confirm: true,
    })
    expect(error).toBeNull()
    const { data } = await admin.auth.admin.getUserById(custId!)
    expect(data.user?.email).toBe(newEmail)
  })

  it('admin updateUserById rejects an email already in use', async () => {
    const { error } = await admin.auth.admin.updateUserById(custId!, {
      email: otherEmail,
      email_confirm: true,
    })
    expect(error).not.toBeNull()
  })
})
