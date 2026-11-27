// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const webpushMock = vi.hoisted(() => ({
  setVapidDetails: vi.fn(),
  sendNotification: vi.fn(),
}))
vi.mock('web-push', () => ({ default: webpushMock }))

type Op = 'select' | 'insert' | 'update' | 'delete'
type Call = {
  table: string
  op: Op
  values?: unknown
  filters: { kind: 'eq' | 'is'; col: string; val: unknown }[]
}

type Options = {
  dedupHit?: boolean
  prefs?: Record<string, unknown> | null
  subs?: { id: string; endpoint: string; p256dh: string; auth: string }[]
  insertError?: boolean
  insertThrows?: boolean
}

/** 假的 Supabase client：記下每一次 from(...) 的操作與條件，依表名回傳設定好的結果 */
function fakeSupabase(opts: Options = {}) {
  const calls: Call[] = []
  const client = {
    from(table: string) {
      const call: Call = { table, op: 'select', filters: [] }
      calls.push(call)
      const result = () => {
        if (table === 'notification_log' && call.op === 'select') {
          return { data: opts.dedupHit ? { id: 'old' } : null, error: null }
        }
        if (table === 'notification_log' && call.op === 'insert') {
          if (opts.insertThrows) throw new Error('連線中斷')
          return { data: null, error: opts.insertError ? { message: '寫入失敗' } : null }
        }
        if (table === 'notification_preferences') return { data: opts.prefs ?? null, error: null }
        if (table === 'push_subscriptions' && call.op === 'select') {
          return { data: opts.subs ?? [], error: null }
        }
        return { data: null, error: null }
      }
      const builder: Record<string, unknown> = {
        select() {
          return builder
        },
        insert(values: unknown) {
          call.op = 'insert'
          call.values = values
          return builder
        },
        update(values: unknown) {
          call.op = 'update'
          call.values = values
          return builder
        },
        delete() {
          call.op = 'delete'
          return builder
        },
        eq(col: string, val: unknown) {
          call.filters.push({ kind: 'eq', col, val })
          return builder
        },
        is(col: string, val: unknown) {
          call.filters.push({ kind: 'is', col, val })
          return builder
        },
        maybeSingle() {
          return Promise.resolve(result())
        },
        then(resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) {
          try {
            return Promise.resolve(result()).then(resolve, reject)
          } catch (e) {
            return Promise.reject(e).then(resolve, reject)
          }
        },
      }
      return builder
    },
  }
  const logInserts = () => calls.filter((c) => c.table === 'notification_log' && c.op === 'insert')
  const logUpdates = () => calls.filter((c) => c.table === 'notification_log' && c.op === 'update')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { client: client as any, calls, logInserts, logUpdates }
}

const SUB = { id: 'sub-1', endpoint: 'https://push.example/1', p256dh: 'p', auth: 'a' }

const ALL_ON = {
  weekly_summary_enabled: true,
  daily_reminder_enabled: true,
  pre_event_enabled: true,
  booking_status_changes_enabled: true,
}

function dispatch(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'user-1',
    type: 'booking_status',
    payload: { title: '預約已確認', body: '您的預約已確認', url: '/my-bookings/1' },
    relatedId: 'booking-1',
    ...overrides,
  }
}

async function loadPush() {
  vi.resetModules()
  return import('@/lib/push')
}

beforeEach(() => {
  webpushMock.setVapidDetails.mockReset()
  webpushMock.sendNotification.mockReset()
  vi.stubEnv('VAPID_SUBJECT', 'mailto:test@example.com')
  vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'public-key')
  vi.stubEnv('VAPID_PRIVATE_KEY', 'private-key')
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('pushToUser：一律留下站內紀錄', () => {
  it('推播金鑰沒設定 → 不丟錯、不推播，仍寫入一筆含標題內文連結、狀態 skipped', async () => {
    vi.stubEnv('VAPID_PRIVATE_KEY', '')
    const { pushToUser } = await loadPush()
    const fake = fakeSupabase({ prefs: ALL_ON, subs: [SUB] })

    const res = await pushToUser(fake.client, dispatch())

    expect(res).toEqual({ sent: 0, failed: 0, removed: 0 })
    expect(webpushMock.sendNotification).not.toHaveBeenCalled()
    expect(fake.logInserts()).toHaveLength(1)
    expect(fake.logInserts()[0]!.values).toMatchObject({
      user_id: 'user-1',
      type: 'booking_status',
      channel: 'web_push',
      status: 'skipped',
      title: '預約已確認',
      body: '您的預約已確認',
      url: '/my-bookings/1',
      related_id: 'booking-1',
    })
  })

  it.each([
    ['weekly_summary', 'weekly_summary_enabled'],
    ['daily_reminder', 'daily_reminder_enabled'],
    ['pre_event', 'pre_event_enabled'],
    ['booking_status', 'booking_status_changes_enabled'],
  ])('使用者關掉 %s → 不推播，仍寫入 skipped', async (type, flag) => {
    const { pushToUser } = await loadPush()
    const fake = fakeSupabase({ prefs: { ...ALL_ON, [flag]: false }, subs: [SUB] })

    const res = await pushToUser(fake.client, dispatch({ type, relatedId: null }))

    expect(res.sent).toBe(0)
    expect(webpushMock.sendNotification).not.toHaveBeenCalled()
    expect(fake.logInserts()).toHaveLength(1)
    expect(fake.logInserts()[0]!.values).toMatchObject({ type, status: 'skipped' })
  })

  it('沒有訂閱任何裝置 → 仍寫入 skipped', async () => {
    const { pushToUser } = await loadPush()
    const fake = fakeSupabase({ prefs: ALL_ON, subs: [] })

    await pushToUser(fake.client, dispatch())

    expect(webpushMock.sendNotification).not.toHaveBeenCalled()
    expect(fake.logInserts()).toHaveLength(1)
    expect(fake.logInserts()[0]!.values).toMatchObject({ status: 'skipped' })
  })

  it('有訂閱且推播成功 → sent=1、紀錄 sent', async () => {
    webpushMock.sendNotification.mockResolvedValue({})
    const { pushToUser } = await loadPush()
    const fake = fakeSupabase({ prefs: ALL_ON, subs: [SUB] })

    const res = await pushToUser(fake.client, dispatch())

    expect(res).toEqual({ sent: 1, failed: 0, removed: 0 })
    expect(webpushMock.sendNotification).toHaveBeenCalledTimes(1)
    expect(fake.logInserts()[0]!.values).toMatchObject({ status: 'sent' })
    expect(fake.calls.some((c) => c.table === 'push_subscriptions' && c.op === 'update')).toBe(true)
  })

  it('推播失敗（非 410）→ failed', async () => {
    webpushMock.sendNotification.mockRejectedValue({ statusCode: 500 })
    const { pushToUser } = await loadPush()
    const fake = fakeSupabase({ prefs: ALL_ON, subs: [SUB] })

    const res = await pushToUser(fake.client, dispatch())

    expect(res).toEqual({ sent: 0, failed: 1, removed: 0 })
    expect(fake.logInserts()[0]!.values).toMatchObject({ status: 'failed' })
  })

  it('推播回 410 → 移除訂閱', async () => {
    webpushMock.sendNotification.mockRejectedValue({ statusCode: 410 })
    const { pushToUser } = await loadPush()
    const fake = fakeSupabase({ prefs: ALL_ON, subs: [SUB] })

    const res = await pushToUser(fake.client, dispatch())

    expect(res).toEqual({ sent: 0, failed: 0, removed: 1 })
    const del = fake.calls.find((c) => c.table === 'push_subscriptions' && c.op === 'delete')
    expect(del?.filters).toContainEqual({ kind: 'eq', col: 'id', val: 'sub-1' })
    expect(fake.logInserts()[0]!.values).toMatchObject({ status: 'skipped' })
  })

  it('去重命中 → 不寫入、不推播', async () => {
    const { pushToUser } = await loadPush()
    const fake = fakeSupabase({ dedupHit: true, prefs: ALL_ON, subs: [SUB] })

    const res = await pushToUser(
      fake.client,
      dispatch({ scheduledFor: '2026-12-01T00:00:00.000Z' }),
    )

    expect(res).toEqual({ sent: 0, failed: 0, removed: 0 })
    expect(webpushMock.sendNotification).not.toHaveBeenCalled()
    expect(fake.logInserts()).toHaveLength(0)
  })

  it('daily_reminder 寫入前，把同使用者、同類型的未讀標為已讀', async () => {
    const { pushToUser } = await loadPush()
    const fake = fakeSupabase({ prefs: ALL_ON, subs: [] })

    await pushToUser(fake.client, dispatch({ type: 'daily_reminder', relatedId: null }))

    const updates = fake.logUpdates()
    expect(updates).toHaveLength(1)
    expect(updates[0]!.values).toHaveProperty('read_at')
    expect(updates[0]!.filters).toEqual(
      expect.arrayContaining([
        { kind: 'eq', col: 'user_id', val: 'user-1' },
        { kind: 'eq', col: 'type', val: 'daily_reminder' },
        { kind: 'is', col: 'read_at', val: null },
      ]),
    )
    expect(fake.logInserts()).toHaveLength(1)
  })

  it.each(['pre_event', 'booking_status'])('%s 不會把舊的未讀標為已讀', async (type) => {
    const { pushToUser } = await loadPush()
    const fake = fakeSupabase({ prefs: ALL_ON, subs: [] })

    await pushToUser(fake.client, dispatch({ type }))

    expect(fake.logUpdates()).toHaveLength(0)
    expect(fake.logInserts()).toHaveLength(1)
  })

  it.each([
    ['https://x', null],
    ['//x', null],
    ['/\\x', null],
    [undefined, null],
    ['/my-bookings/1', '/my-bookings/1'],
  ])('url %s → 存 %s', async (url, expected) => {
    const { pushToUser } = await loadPush()
    const fake = fakeSupabase({ prefs: ALL_ON, subs: [] })

    await pushToUser(
      fake.client,
      dispatch({ payload: { title: '標題', body: '內文', ...(url !== undefined ? { url } : {}) } }),
    )

    expect(fake.logInserts()[0]!.values).toMatchObject({ url: expected })
  })

  it('寫入回傳錯誤 → 不丟錯，回傳值照常', async () => {
    webpushMock.sendNotification.mockResolvedValue({})
    const { pushToUser } = await loadPush()
    const fake = fakeSupabase({ prefs: ALL_ON, subs: [SUB], insertError: true })

    await expect(pushToUser(fake.client, dispatch())).resolves.toEqual({
      sent: 1,
      failed: 0,
      removed: 0,
    })
    expect(console.error).toHaveBeenCalled()
  })

  it('寫入時丟出例外 → 不丟錯，回傳值照常', async () => {
    const { pushToUser } = await loadPush()
    const fake = fakeSupabase({ prefs: ALL_ON, subs: [], insertThrows: true })

    await expect(pushToUser(fake.client, dispatch())).resolves.toEqual({
      sent: 0,
      failed: 0,
      removed: 0,
    })
  })
})

describe('recordInAppNotification', () => {
  it('只寫站內紀錄：不推播、不讀偏好，channel 為 in_app', async () => {
    const { recordInAppNotification } = await loadPush()
    const fake = fakeSupabase({ prefs: ALL_ON, subs: [SUB] })

    await recordInAppNotification(fake.client, {
      userId: 'user-1',
      type: 'package_request',
      title: '新的購買申請',
      body: '內文',
      url: '//evil.example',
      relatedId: 'p-1',
    })

    expect(webpushMock.sendNotification).not.toHaveBeenCalled()
    expect(fake.calls.some((c) => c.table === 'notification_preferences')).toBe(false)
    expect(fake.logInserts()).toHaveLength(1)
    expect(fake.logInserts()[0]!.values).toMatchObject({
      user_id: 'user-1',
      type: 'package_request',
      channel: 'in_app',
      status: 'skipped',
      title: '新的購買申請',
      body: '內文',
      url: null,
      related_id: 'p-1',
    })
  })

  it('weekly_summary 也會把舊的未讀標為已讀；寫入失敗不丟錯', async () => {
    const { recordInAppNotification } = await loadPush()
    const fake = fakeSupabase({ insertError: true })

    await expect(
      recordInAppNotification(fake.client, {
        userId: 'user-1',
        type: 'weekly_summary',
        title: '下週行程預覽',
        body: '內文',
      }),
    ).resolves.toBeUndefined()
    expect(fake.logUpdates()).toHaveLength(1)
  })
})
