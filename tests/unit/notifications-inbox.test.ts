// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { countUnread, listInbox } from '@/lib/notifications'
import { AppError } from '@/lib/errors'

type Filter = { kind: string; args: unknown[] }

/** 假的 Supabase client：記下條件，最後回傳指定結果 */
function fakeSupabase(result: { data?: unknown; count?: number | null; error?: unknown }) {
  const filters: Filter[] = []
  const builder: Record<string, unknown> = {}
  for (const kind of ['select', 'eq', 'is', 'order', 'limit']) {
    builder[kind] = (...args: unknown[]) => {
      filters.push({ kind, args })
      return builder
    }
  }
  builder.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({
      data: result.data ?? null,
      count: result.count ?? null,
      error: result.error ?? null,
    }).then(resolve)
  const client = { from: vi.fn(() => builder) }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { client: client as any, filters }
}

afterEach(() => vi.restoreAllMocks())

describe('listInbox', () => {
  it('成功 → 帶 user_id 條件、新到舊、最多 100 筆，並轉成畫面用的欄位', async () => {
    const fake = fakeSupabase({
      data: [
        {
          id: 'n1',
          type: 'booking_status',
          title: null,
          body: null,
          url: null,
          sent_at: '2026-11-26T01:00:00Z',
          read_at: null,
        },
      ],
    })

    const items = await listInbox(fake.client, 'user-1')

    expect(fake.client.from).toHaveBeenCalledWith('notification_log')
    expect(fake.filters).toContainEqual({ kind: 'eq', args: ['user_id', 'user-1'] })
    expect(fake.filters).toContainEqual({ kind: 'order', args: ['sent_at', { ascending: false }] })
    expect(fake.filters).toContainEqual({ kind: 'limit', args: [100] })
    expect(items).toEqual([
      {
        id: 'n1',
        type: 'booking_status',
        title: null,
        body: null,
        url: null,
        sentAt: '2026-11-26T01:00:00Z',
        readAt: null,
      },
    ])
  })

  it('有給筆數 → 依指定筆數查詢', async () => {
    const fake = fakeSupabase({ data: [] })
    await expect(listInbox(fake.client, 'user-1', 5)).resolves.toEqual([])
    expect(fake.filters).toContainEqual({ kind: 'limit', args: [5] })
    expect(fake.filters).not.toContainEqual({ kind: 'limit', args: [100] })
  })

  it('查詢失敗 → 丟 AppError，不回空陣列', async () => {
    const fake = fakeSupabase({ error: { message: 'boom' } })
    await expect(listInbox(fake.client, 'user-1')).rejects.toBeInstanceOf(AppError)
  })
})

describe('countUnread', () => {
  it('成功 → 回未讀數，條件含 user_id 與 read_at 為空', async () => {
    const fake = fakeSupabase({ count: 3 })

    await expect(countUnread(fake.client, 'user-1')).resolves.toBe(3)
    expect(fake.filters).toContainEqual({ kind: 'eq', args: ['user_id', 'user-1'] })
    expect(fake.filters).toContainEqual({ kind: 'is', args: ['read_at', null] })
  })

  it('沒有未讀 → 回 0', async () => {
    const fake = fakeSupabase({ count: 0 })
    await expect(countUnread(fake.client, 'user-1')).resolves.toBe(0)
  })

  it('查詢失敗 → 回 null 並記錄錯誤，不回 0', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const fake = fakeSupabase({ error: { message: 'boom' } })

    await expect(countUnread(fake.client, 'user-1')).resolves.toBeNull()
    expect(spy).toHaveBeenCalled()
  })
})
