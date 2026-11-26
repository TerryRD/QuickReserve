// @vitest-environment node
// 成員權限欄位防線（W2-1 ～ W2-11）
// 對應 supabase/migrations/20261126100700_bfv2_p1_member_privilege_guard.sql（tenant_members 的欄位層級防線）
// 與既有 RLS tenant_members_update（20260522040000_advisor_phase1_and_2.sql）
import { randomBytes } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import {
  admin,
  makeOwnerOfNewTenant,
  makeUser,
  setupBfv2,
  teardownBfv2,
  type Bfv2Ctx,
} from './helpers/bfv2-fixture'

type MemberRow = Database['public']['Tables']['tenant_members']['Row']
type WriteResult = { data: unknown; error: { message: string; code: string } | null }

const DAY_MS = 24 * 60 * 60 * 1000

let ctx: Bfv2Ctx
let otherTenantId: string
let otherTenantOwner: SupabaseClient<Database>
/** W2-9 接受邀請後啟用的成員，W2-11 用來測移除 */
let acceptedMemberId: string | undefined

/** 64 個十六進位字元的邀請 token（與正式邀請流程同格式） */
function newToken() {
  return randomBytes(32).toString('hex')
}

function daysLater(days: number) {
  return new Date(Date.now() + days * DAY_MS).toISOString()
}

/** 用 service role 讀整列 */
async function memberRow(id: string): Promise<MemberRow> {
  const { data, error } = await admin.from('tenant_members').select('*').eq('id', id).single()
  if (error) throw new Error(`memberRow ${id}: ${error.message}`)
  return data
}

/**
 * 確認整列與之前相同。
 * 防線不在時寫入可能會成功：先用 service role 復原，避免影響後面的案例，再讓斷言失敗。
 */
async function expectUnchanged(before: MemberRow) {
  const after = await memberRow(before.id)
  if (JSON.stringify(after) !== JSON.stringify(before)) {
    const { id, ...rest } = before
    await admin.from('tenant_members').update(rest).eq('id', id)
  }
  expect(after).toEqual(before)
}

/** 被觸發器以指定代碼擋下回 'ok'；否則回實際結果，方便看出哪一項沒擋住 */
function blockedBy(r: WriteResult, code: string): string {
  if (r.error?.code === '42501' && r.error.message.includes(code)) return 'ok'
  return r.error ? `${r.error.code} ${r.error.message}` : `沒有錯誤，回傳 ${JSON.stringify(r.data)}`
}

/** 新增一列「已邀請、尚未接受」的成員（service role） */
async function insertInvited(tag: string) {
  const invitedEmail = `${tag}-bfv2-${ctx.label}-${ctx.ts}@example.com`
  const { data, error } = await admin
    .from('tenant_members')
    .insert({
      tenant_id: ctx.tenantId,
      user_id: null,
      role: 'staff',
      status: 'invited',
      invited_email: invitedEmail,
      invite_token: newToken(),
      invite_expires_at: daysLater(7),
    })
    .select('id')
    .single()
  if (error) throw new Error(`insertInvited ${tag}: ${error.message}`)
  return { memberId: data.id, invitedEmail }
}

describe('bfv2 P1：成員權限欄位防線', () => {
  // W2-1～W2-4、W2-6 在 Migration 8 執行前會紅（防線本身）；
  // W2-5、W2-7～W2-11 是「既有流程不被弄壞」的回歸防線，Migration 8 執行前後都應該綠。

  beforeAll(async () => {
    ctx = await setupBfv2('mguard')
    const other = await makeOwnerOfNewTenant(ctx, '-other')
    otherTenantId = other.tenantId
    otherTenantOwner = other.owner.client
  }, 120_000)

  afterAll(async () => {
    await teardownBfv2(ctx)
  }, 120_000)

  it('W2-1 助教把自己的 role 改成 owner：MEMBER_ROLE_STATUS_FORBIDDEN，仍是 staff', async () => {
    const before = await memberRow(ctx.staffA.memberId)
    const { error } = await ctx.staffA.client
      .from('tenant_members')
      .update({ role: 'owner' })
      .eq('id', ctx.staffA.memberId)
      .select('id')
    await expectUnchanged(before)
    expect(error?.code).toBe('42501')
    expect(error?.message).toContain('MEMBER_ROLE_STATUS_FORBIDDEN')
    expect((await memberRow(ctx.staffA.memberId)).role).toBe('staff')
  })

  it('W2-2 助教改自己的 status：MEMBER_ROLE_STATUS_FORBIDDEN', async () => {
    const before = await memberRow(ctx.staffA.memberId)
    const { error } = await ctx.staffA.client
      .from('tenant_members')
      .update({ status: 'removed' })
      .eq('id', ctx.staffA.memberId)
      .select('id')
    await expectUnchanged(before)
    expect(error?.code).toBe('42501')
    expect(error?.message).toContain('MEMBER_ROLE_STATUS_FORBIDDEN')
  })

  it('W2-3 助教改自己的 tenant_id、user_id、invited_email、invite_token：都是 MEMBER_FIELD_LOCKED', async () => {
    const before = await memberRow(ctx.staffA.memberId)
    const self = () => ctx.staffA.client.from('tenant_members')

    const outcomes: Record<string, string> = {}
    outcomes['tenant_id'] = blockedBy(
      await self().update({ tenant_id: otherTenantId }).eq('id', ctx.staffA.memberId).select('id'),
      'MEMBER_FIELD_LOCKED',
    )
    await expectUnchanged(before)
    outcomes['user_id'] = blockedBy(
      await self()
        .update({ user_id: ctx.customer.userId })
        .eq('id', ctx.staffA.memberId)
        .select('id'),
      'MEMBER_FIELD_LOCKED',
    )
    await expectUnchanged(before)
    outcomes['invited_email'] = blockedBy(
      await self()
        .update({ invited_email: `hijack-${ctx.ts}@example.com` })
        .eq('id', ctx.staffA.memberId)
        .select('id'),
      'MEMBER_FIELD_LOCKED',
    )
    await expectUnchanged(before)
    outcomes['invite_token'] = blockedBy(
      await self().update({ invite_token: newToken() }).eq('id', ctx.staffA.memberId).select('id'),
      'MEMBER_FIELD_LOCKED',
    )
    await expectUnchanged(before)

    expect(Object.entries(outcomes).filter(([, v]) => v !== 'ok')).toEqual([])
  })

  it('W2-4 Owner 改自己的 role 或 status：MEMBER_ROLE_STATUS_FORBIDDEN', async () => {
    const before = await memberRow(ctx.owner.memberId)
    const self = () => ctx.owner.client.from('tenant_members')

    const outcomes: Record<string, string> = {}
    outcomes['role'] = blockedBy(
      await self().update({ role: 'staff' }).eq('id', ctx.owner.memberId).select('id'),
      'MEMBER_ROLE_STATUS_FORBIDDEN',
    )
    await expectUnchanged(before)
    outcomes['status'] = blockedBy(
      await self().update({ status: 'removed' }).eq('id', ctx.owner.memberId).select('id'),
      'MEMBER_ROLE_STATUS_FORBIDDEN',
    )
    await expectUnchanged(before)

    expect(Object.entries(outcomes).filter(([, v]) => v !== 'ok')).toEqual([])
  })

  it('W2-5 Owner 以登入者身分把助教 B 的 status 改成 removed：成功（1 列）', async () => {
    try {
      const { data, error } = await ctx.owner.client
        .from('tenant_members')
        .update({ status: 'removed' })
        .eq('id', ctx.staffB.memberId)
        .select('id')
      expect(error).toBeNull()
      expect(data).toHaveLength(1)
      expect((await memberRow(ctx.staffB.memberId)).status).toBe('removed')
    } finally {
      // 復原，讓其他案例的助教 B 仍是有效成員
      const { error } = await admin
        .from('tenant_members')
        .update({ status: 'active' })
        .eq('id', ctx.staffB.memberId)
      if (error) throw new Error(`W2-5 復原: ${error.message}`)
    }
    expect((await memberRow(ctx.staffB.memberId)).status).toBe('active')
  })

  it('W2-6 Owner 改助教的 user_id、tenant_id、invited_email：都是 MEMBER_FIELD_LOCKED', async () => {
    const before = await memberRow(ctx.staffA.memberId)
    const member = () => ctx.owner.client.from('tenant_members')

    const outcomes: Record<string, string> = {}
    outcomes['user_id'] = blockedBy(
      await member()
        .update({ user_id: ctx.customer.userId })
        .eq('id', ctx.staffA.memberId)
        .select('id'),
      'MEMBER_FIELD_LOCKED',
    )
    await expectUnchanged(before)
    outcomes['tenant_id'] = blockedBy(
      await member()
        .update({ tenant_id: otherTenantId })
        .eq('id', ctx.staffA.memberId)
        .select('id'),
      'MEMBER_FIELD_LOCKED',
    )
    await expectUnchanged(before)
    outcomes['invited_email'] = blockedBy(
      await member()
        .update({ invited_email: `owner-edit-${ctx.ts}@example.com` })
        .eq('id', ctx.staffA.memberId)
        .select('id'),
      'MEMBER_FIELD_LOCKED',
    )
    await expectUnchanged(before)

    expect(Object.entries(outcomes).filter(([, v]) => v !== 'ok')).toEqual([])
  })

  it('W2-7 助教 A 改助教 B、另一個租戶的 Owner、平台管理員改助教的 role：都是 0 列，資料不變', async () => {
    const beforeB = await memberRow(ctx.staffB.memberId)
    const beforeA = await memberRow(ctx.staffA.memberId)

    const results: Record<string, WriteResult> = {
      '助教 A 改助教 B': await ctx.staffA.client
        .from('tenant_members')
        .update({ role: 'owner' })
        .eq('id', ctx.staffB.memberId)
        .select('id'),
      '另一個租戶的 Owner 改助教 A': await otherTenantOwner
        .from('tenant_members')
        .update({ role: 'owner' })
        .eq('id', ctx.staffA.memberId)
        .select('id'),
      '平台管理員改助教 B': await ctx.platformAdmin.client
        .from('tenant_members')
        .update({ role: 'owner' })
        .eq('id', ctx.staffB.memberId)
        .select('id'),
    }
    const shapes = Object.fromEntries(
      Object.entries(results).map(([who, r]) => [
        who,
        { error: r.error, rows: Array.isArray(r.data) ? r.data.length : r.data },
      ]),
    )
    expect(shapes).toEqual({
      '助教 A 改助教 B': { error: null, rows: 0 },
      '另一個租戶的 Owner 改助教 A': { error: null, rows: 0 },
      '平台管理員改助教 B': { error: null, rows: 0 },
    })

    await expectUnchanged(beforeB)
    await expectUnchanged(beforeA)
  })

  it('W2-8 帳號設定改姓名照常：助教 A 以登入者身分改自己的 display_name，成功（1 列）', async () => {
    const { data, error } = await ctx.staffA.client
      .from('tenant_members')
      .update({ display_name: '新名字' })
      .eq('user_id', ctx.staffA.userId)
      .select('id')
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    expect((await memberRow(ctx.staffA.memberId)).display_name).toBe('新名字')
  })

  it('W2-9 接受邀請照常（service role）：寫入 user_id、改為 active、清掉 token', async () => {
    const { memberId, invitedEmail } = await insertInvited('invitee')
    const { userId, email } = await makeUser(ctx, 'invitee')
    expect(email).toBe(invitedEmail)

    const { error } = await admin
      .from('tenant_members')
      .update({ user_id: userId, status: 'active', invite_token: null, invite_expires_at: null })
      .eq('id', memberId)
    expect(error).toBeNull()

    const row = await memberRow(memberId)
    expect(row.status).toBe('active')
    expect(row.user_id).toBe(userId)
    expect(row.invite_token).toBeNull()
    expect(row.invite_expires_at).toBeNull()
    acceptedMemberId = memberId
  })

  it('W2-10 平台重寄邀請照常（service role）：換新 token 與期限', async () => {
    const { memberId } = await insertInvited('reinvite')
    const token = newToken()
    const expiresAt = daysLater(7)

    const { error } = await admin
      .from('tenant_members')
      .update({ invite_token: token, invite_expires_at: expiresAt })
      .eq('id', memberId)
    expect(error).toBeNull()

    const row = await memberRow(memberId)
    expect(row.invite_token).toBe(token)
    expect(new Date(row.invite_expires_at!).getTime()).toBe(new Date(expiresAt).getTime())
  })

  it('W2-11 Owner 移除助教照常（service role）：W2-9 啟用的成員改為 removed', async () => {
    expect(acceptedMemberId).toBeDefined()
    const { error } = await admin
      .from('tenant_members')
      .update({ status: 'removed' })
      .eq('id', acceptedMemberId!)
    expect(error).toBeNull()
    expect((await memberRow(acceptedMemberId!)).status).toBe('removed')
  })
})
