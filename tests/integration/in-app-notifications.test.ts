// @vitest-environment node
// 站內通知：通知紀錄 notification_log 的讀寫範圍與限制。
//
// 前置條件：
//   - 需要 migration 20261126120000_in_app_notifications.sql（title／body／url 欄位與站內連結限制）
//     與 20261127120000_notification_log_update_read_at_only.sql（登入者只能改 read_at）都已執行。
//   - 會寫入資料庫：與其他整合測試、e2e 不可同時跑（共用同一個資料庫）。
//   - 不會被 `npm test` 執行（tests/integration/** 已排除），只用 `npm run test:integration` 跑。
//
// 測試資料：setupBfv2 建立的獨立租戶與帳號，加上本檔用 service role 寫入的通知；
// afterAll 先刪本檔寫入的通知，再由 teardownBfv2 刪租戶與使用者。
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import { randomUUID } from 'node:crypto'
import { pushToUser } from '@/lib/push'
import { preEventScheduledFor } from '@/lib/pre-event-reminder'
import { admin, setupBfv2, teardownBfv2, type Bfv2Ctx } from './helpers/bfv2-fixture'

let ctx: Bfv2Ctx

type NotificationInsert = Database['public']['Tables']['notification_log']['Insert']

/** 用 service role 寫入一筆給指定使用者的站內通知，回傳 id */
async function insertNotification(
  userId: string,
  overrides: Partial<NotificationInsert> = {},
): Promise<string> {
  const { data, error } = await admin
    .from('notification_log')
    .insert({
      user_id: userId,
      type: 'booking_cancelled',
      channel: 'in_app',
      status: 'skipped',
      title: '預約已取消',
      body: '教練取消了你的預約。原因：場地臨時整修。',
      url: '/my-bookings',
      ...overrides,
    })
    .select('id')
    .single()
  if (error) throw new Error(`寫入通知失敗：${error.message}`)
  return data.id
}

/** 直接以 service role 讀一筆通知（驗證資料真的沒被改） */
async function readNotification(id: string) {
  const { data, error } = await admin
    .from('notification_log')
    .select('id, user_id, title, body, url, read_at')
    .eq('id', id)
    .single()
  if (error) throw new Error(`讀取通知失敗：${error.message}`)
  return data
}

async function visibleIds(client: SupabaseClient<Database>, ids: string[]): Promise<string[]> {
  const { data, error } = await client.from('notification_log').select('id').in('id', ids)
  expect(error).toBeNull()
  return (data ?? []).map((r) => r.id)
}

async function unreadCount(client: SupabaseClient<Database>, userId: string): Promise<number> {
  // 與 src/lib/notifications.ts 的 countUnread 相同條件
  const { count, error } = await client
    .from('notification_log')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null)
  expect(error).toBeNull()
  return count ?? -1
}

describe('站內通知：讀寫範圍與限制', () => {
  beforeAll(async () => {
    ctx = await setupBfv2('inapp')
  }, 120_000)

  afterAll(async () => {
    if (ctx) {
      const errors: string[] = []
      for (const userId of ctx.userIds) {
        const { error } = await admin.from('notification_log').delete().eq('user_id', userId)
        if (error) errors.push(`刪除通知 ${userId}：${error.message}`)
      }
      await teardownBfv2(ctx)
      if (errors.length) throw new Error(errors.join('\n'))
    }
  }, 120_000)

  it('1. 後端寫入給學員的通知：學員讀得到標題、內文、連結；另一位學員與 Owner 讀不到', async () => {
    const id = await insertNotification(ctx.customer.userId, {
      title: '預約已取消',
      body: '原因：場地臨時整修。',
      url: '/my-bookings/abc',
    })

    const { data, error } = await ctx.customer.client
      .from('notification_log')
      .select('id, title, body, url, read_at')
      .eq('id', id)
      .single()
    expect(error).toBeNull()
    expect(data).toEqual({
      id,
      title: '預約已取消',
      body: '原因：場地臨時整修。',
      url: '/my-bookings/abc',
      read_at: null,
    })

    expect(await visibleIds(ctx.otherCustomer.client, [id])).toEqual([])
    expect(await visibleIds(ctx.owner.client, [id])).toEqual([])
  })

  it('2. 學員把自己的通知標為已讀 → 成功；標別人的 → 影響 0 筆，資料不變', async () => {
    const mine = await insertNotification(ctx.customer.userId)
    const others = await insertNotification(ctx.otherCustomer.userId)
    const now = new Date().toISOString()

    const { data: updated, error } = await ctx.customer.client
      .from('notification_log')
      .update({ read_at: now })
      .eq('id', mine)
      .select('id')
    expect(error).toBeNull()
    expect(updated).toEqual([{ id: mine }])
    expect((await readNotification(mine)).read_at).not.toBeNull()

    const { data: notMine, error: notMineErr } = await ctx.customer.client
      .from('notification_log')
      .update({ read_at: now })
      .eq('id', others)
      .select('id')
    expect(notMineErr).toBeNull()
    expect(notMine).toEqual([])
    expect((await readNotification(others)).read_at).toBeNull()
  })

  it('3. 學員、Owner 直接新增通知 → 被擋', async () => {
    for (const [who, client, userId] of [
      ['學員', ctx.customer.client, ctx.customer.userId],
      ['Owner', ctx.owner.client, ctx.owner.userId],
    ] as const) {
      const { data, error } = await client
        .from('notification_log')
        .insert({
          user_id: userId,
          type: 'booking_cancelled',
          channel: 'in_app',
          status: 'skipped',
          title: `${who}自己寫的通知`,
        })
        .select('id')
      expect(error, `${who}新增應被擋`).not.toBeNull()
      expect(data).toBeNull()
    }
    const { count } = await admin
      .from('notification_log')
      .select('id', { count: 'exact', head: true })
      .in('title', ['學員自己寫的通知', 'Owner自己寫的通知'])
    expect(count).toBe(0)
  })

  it.each(['https://evil.example/x', '//evil.example/x', '/\\evil.example/x'])(
    '4. 連結不是站內路徑（%s）→ 後端寫入也被資料庫擋下',
    async (url) => {
      const { data, error } = await admin
        .from('notification_log')
        .insert({
          user_id: ctx.customer.userId,
          type: 'booking_cancelled',
          channel: 'in_app',
          status: 'skipped',
          title: '站外連結',
          url,
        })
        .select('id')
      expect(error).not.toBeNull()
      // 23514＝違反 check 限制（notification_log_url_internal_check）
      expect(error!.code).toBe('23514')
      expect(data).toBeNull()
    },
  )

  it('5. 未讀數只算自己的未讀', async () => {
    const before = await unreadCount(ctx.staffA.client, ctx.staffA.userId)
    await insertNotification(ctx.staffA.userId)
    await insertNotification(ctx.staffA.userId)
    await insertNotification(ctx.staffA.userId, { read_at: new Date().toISOString() })
    // 別人的未讀不算進來
    await insertNotification(ctx.staffB.userId)

    expect(await unreadCount(ctx.staffA.client, ctx.staffA.userId)).toBe(before + 2)
    // 拿別人的 user_id 去數：受讀取規則限制，數不到別人的
    expect(await unreadCount(ctx.staffA.client, ctx.staffB.userId)).toBe(0)
  })

  it.each([
    ['title', { title: '被改掉的標題' }],
    ['body', { body: '被改掉的內文' }],
    ['url', { url: '/somewhere-else' }],
  ] as const)('6. 學員修改自己那筆通知的 %s → 被擋，資料不變', async (_col, patch) => {
    const id = await insertNotification(ctx.customer.userId)
    const before = await readNotification(id)

    const { data, error } = await ctx.customer.client
      .from('notification_log')
      .update(patch)
      .eq('id', id)
      .select('id')
    // 只開放 read_at 欄位的修改權限：改其他欄位是權限錯誤
    expect(error).not.toBeNull()
    expect(error!.code).toBe('42501')
    expect(data).toBeNull()
    expect(await readNotification(id)).toEqual(before)
  })
  it('7. 發送入口：沒有訂閱裝置的使用者也留下一筆含標題、內文、連結的紀錄；課前提醒同一則只留一筆', async () => {
    const relatedId = randomUUID()
    const scheduledFor = preEventScheduledFor('2026-12-01T10:00:00+00:00', 30)
    const dispatch = {
      userId: ctx.otherCustomer.userId,
      type: 'pre_event',
      payload: { title: '預約即將開始', body: '30 分鐘後：整合測試課', url: '/my-bookings' },
      relatedId,
      scheduledFor,
    }

    // 排程每分鐘跑一次、容許前後 1 分鐘：同一則會被送進來最多 3 次
    await pushToUser(admin, dispatch)
    await pushToUser(admin, dispatch)
    await pushToUser(admin, dispatch)

    const { data, error } = await admin
      .from('notification_log')
      .select('title, body, url, status, scheduled_for, read_at')
      .eq('user_id', ctx.otherCustomer.userId)
      .eq('type', 'pre_event')
      .eq('related_id', relatedId)
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    expect(data![0]).toMatchObject({
      title: '預約即將開始',
      body: '30 分鐘後：整合測試課',
      url: '/my-bookings',
      status: 'skipped',
      read_at: null,
    })
    expect(new Date(data![0]!.scheduled_for!).toISOString()).toBe('2026-12-01T09:30:00.000Z')
  })

  it('7b. 對照：修正前的去重值（開始時間後面接分鐘數）不是合法時間，紀錄寫不進去', async () => {
    const relatedId = randomUUID()
    await pushToUser(admin, {
      userId: ctx.otherCustomer.userId,
      type: 'pre_event',
      payload: { title: '預約即將開始', body: '30 分鐘後：整合測試課', url: '/my-bookings' },
      relatedId,
      scheduledFor: '2026-12-01T10:00:00+00:00-30',
    })
    const { count, error } = await admin
      .from('notification_log')
      .select('id', { count: 'exact', head: true })
      .eq('related_id', relatedId)
    expect(error).toBeNull()
    expect(count).toBe(0)
  })

  it('8. 每日提醒只留最新一則未讀：第二天的寫入後，第一天那則變成已讀', async () => {
    const userId = ctx.platformAdmin.userId
    const send = (day: string) =>
      pushToUser(admin, {
        userId,
        type: 'daily_reminder',
        payload: {
          title: '今日行程提醒',
          body: `您今天有 1 個預約 / 時段（${day}）`,
          url: '/my-bookings',
        },
        scheduledFor: `${day}T16:00:00.000Z`,
      })
    await send('2026-12-01')
    await send('2026-12-02')

    const { data, error } = await admin
      .from('notification_log')
      .select('body, read_at')
      .eq('user_id', userId)
      .eq('type', 'daily_reminder')
      .order('scheduled_for', { ascending: true })
    expect(error).toBeNull()
    expect(data).toHaveLength(2)
    expect(data![0]!.read_at).not.toBeNull()
    expect(data![1]!.read_at).toBeNull()
  })
})
