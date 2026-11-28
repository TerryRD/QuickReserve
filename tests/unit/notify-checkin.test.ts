import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const { pushToUser, createSupabaseAdminClient } = vi.hoisted(() => ({
  pushToUser: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createSupabaseAdminClient }))
vi.mock('@/lib/push', () => ({ pushToUser }))

import {
  notifyCheckinDone,
  notifyCheckinMissingCoach,
  notifyCheckinMissingStudent,
  notifyCheckinReminder,
} from '@/lib/notify-checkin'

const ORIGINAL_TZ = process.env.TZ
const START_AT = '2026-12-02T11:00:00Z' // 台灣 2026/12/02（三）19:00

// 每種執行環境時區的實際位移（分鐘，getTimezoneOffset 的正負號與 UTC 位移相反）
const ZONES = [
  { tz: 'Asia/Taipei', offset: -480 },
  { tz: 'UTC', offset: 0 },
] as const

function lastBody(): string {
  const call = pushToUser.mock.calls.at(-1)
  return (call?.[1] as { payload: { body: string } }).payload.body
}

describe.each(ZONES)('簽到推播的上課時間（執行環境時區 $tz）', ({ tz, offset }) => {
  beforeAll(() => {
    process.env.TZ = tz
  })

  afterAll(() => {
    if (ORIGINAL_TZ === undefined) delete process.env.TZ
    else process.env.TZ = ORIGINAL_TZ
  })

  beforeEach(() => {
    pushToUser.mockReset()
    createSupabaseAdminClient.mockReset()
    createSupabaseAdminClient.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                id: 'b1',
                customers: { display_name: '陳小明' },
                services: { name: '一對一基礎課' },
                availability_slots: { start_at: START_AT, tenant_members: { user_id: 'coach-1' } },
              },
            }),
          }),
        }),
      }),
    })
  })

  it('確實切到這個時區', () => {
    expect(new Date('2026-12-02T04:00:00Z').getTimezoneOffset()).toBe(offset)
  })

  it('學員已簽到 → 教練收到的內文是台灣時間', async () => {
    await notifyCheckinDone('b1')
    expect(lastBody()).toBe('陳小明 已簽到（一對一基礎課 2026/12/02（三）19:00）')
  })

  it('課前提醒 → 學員收到的內文是台灣時間', async () => {
    await notifyCheckinReminder('stu-1', '一對一基礎課', START_AT, 'b1')
    expect(lastBody()).toBe('一對一基礎課（2026/12/02（三）19:00 開始）記得到場後簽到')
  })

  it('未簽到 → 學員與教練收到的內文都是台灣時間', async () => {
    await notifyCheckinMissingStudent('stu-1', '一對一基礎課', START_AT, 'b1')
    expect(lastBody()).toBe('一對一基礎課（2026/12/02（三）19:00）已開始，請儘快簽到')
    await notifyCheckinMissingCoach('coach-1', '一對一基礎課', START_AT, 's1', ['陳小明', '王大同'])
    expect(lastBody()).toBe('一對一基礎課（2026/12/02（三）19:00）：陳小明、王大同')
  })
})
