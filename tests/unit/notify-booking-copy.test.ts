import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createSupabaseAdminClient: vi.fn() }))
vi.mock('@/lib/push', () => ({ pushToUser: vi.fn() }))

import {
  buildCancelNotice,
  purchaseRejectedBody,
  type CancelNoticeInput,
} from '@/lib/notify-booking'
import { FORBIDDEN_TERMS, REASON_PREVIEW_MAX } from '@/lib/booking-terms'

const base: CancelNoticeInput = {
  tenantName: '羽球王教練',
  customerName: '陳小明',
  serviceName: '一對一基礎課',
  startAt: '2026/12/3 下午7:00:00',
  category: 'coach_cancelled',
  reason: '場地臨時整修',
  disposition: 'refunded',
  actorRole: 'owner',
}

function allCopies(n: ReturnType<typeof buildCancelNotice>): string[] {
  return [n.toCustomer, n.toCoach, n.toOwners].flatMap((c) => (c ? [c.title, c.body] : []))
}

describe('buildCancelNotice', () => {
  it('(a) 教練取消、退回 → 學員通知含原因與「已退回 1 堂」', () => {
    const n = buildCancelNotice(base)
    expect(n.toCustomer?.title).toBe('預約已取消')
    expect(n.toCustomer?.body).toBe(
      '羽球王教練 取消了您的預約（2026/12/3 下午7:00:00）。原因：場地臨時整修。已退回 1 堂。',
    )
    expect(n.toCoach).toBeUndefined()
    expect(n.toOwners).toBeUndefined()
  })

  it('教練拒絕 → 標題「預約未被接受」、內文含原因與「已退回 1 堂」', () => {
    const n = buildCancelNotice({
      ...base,
      category: 'coach_rejected',
      reason: '這個時段臨時有事',
    })
    expect(n.toCustomer?.title).toBe('預約未被接受')
    expect(n.toCustomer?.body).toBe(
      '羽球王教練 未接受您的預約（2026/12/3 下午7:00:00）。原因：這個時段臨時有事。已退回 1 堂。',
    )
    expect(n.toCustomer?.body).not.toContain('取消了您的預約')
  })

  it('教練取消／拒絕時堂數結果依處理方式寫出', () => {
    const forfeited = buildCancelNotice({ ...base, disposition: 'forfeited' })
    expect(forfeited.toCustomer?.body).toContain('原因：場地臨時整修。不退回。')
    const transferred = buildCancelNotice({ ...base, disposition: 'transferred' })
    expect(transferred.toCustomer?.body).toContain('已轉到新預約。')
    const unknown = buildCancelNotice({ ...base, disposition: null })
    expect(unknown.toCustomer?.body).not.toContain('退回')
  })

  it('原因過長時截斷加「…」，教練拒絕、教練取消、學員取消、助教通知 Owner 都一樣', () => {
    const long = '這'.repeat(REASON_PREVIEW_MAX + 10)
    const preview = `原因：${'這'.repeat(REASON_PREVIEW_MAX)}…。`
    const cases: CancelNoticeInput[] = [
      { ...base, reason: long },
      { ...base, reason: long, category: 'coach_rejected' },
      { ...base, reason: long, category: 'customer', actorRole: 'customer' },
      { ...base, reason: long, actorRole: 'staff' },
    ]
    for (const c of cases) {
      for (const text of allCopies(buildCancelNotice(c))) {
        expect(text).not.toContain(long)
      }
      const n = buildCancelNotice(c)
      const body = (n.toCustomer ?? n.toCoach)?.body ?? ''
      expect(body).toContain(preview)
    }
    const staff = buildCancelNotice({ ...base, reason: long, actorRole: 'staff' })
    expect(staff.toOwners?.body).toContain(preview)
  })

  it('原因剛好等於上限長度時不截斷', () => {
    const exact = '這'.repeat(REASON_PREVIEW_MAX)
    const n = buildCancelNotice({ ...base, reason: exact })
    expect(n.toCustomer?.body).toContain(`原因：${exact}。`)
    expect(n.toCustomer?.body).not.toContain('…')
  })

  it('沒有原因或只有空白時不出現「原因：」', () => {
    for (const reason of [null, '   ']) {
      const n = buildCancelNotice({ ...base, reason })
      expect(n.toCustomer?.body).toBe(
        '羽球王教練 取消了您的預約（2026/12/3 下午7:00:00）。已退回 1 堂。',
      )
    }
  })

  it('沒有租戶名稱時學員看到的是「教練」，且不出現助教', () => {
    const n = buildCancelNotice({ ...base, tenantName: null, actorRole: 'staff' })
    expect(n.toCustomer?.body.startsWith('教練 ')).toBe(true)
    expect(n.toCustomer?.body).not.toContain('助教')
    expect(n.toCustomer?.title).not.toContain('助教')
  })

  it('(b) 學員逾期取消 → 教練通知含「不退回」', () => {
    const n = buildCancelNotice({
      ...base,
      category: 'customer',
      actorRole: 'customer',
      disposition: 'forfeited',
      reason: '工作：臨時要加班',
    })
    expect(n.toCustomer).toBeUndefined()
    expect(n.toCoach?.title).toBe('預約已取消')
    expect(n.toCoach?.body).toBe(
      '陳小明 取消了預約（2026/12/3 下午7:00:00）。原因：工作：臨時要加班。已過取消期限，不退回。',
    )
  })

  it('學員期限內取消 → 教練通知含原因與「已退回 1 堂」', () => {
    const n = buildCancelNotice({ ...base, category: 'customer', actorRole: 'customer' })
    expect(n.toCoach?.body).toBe(
      '陳小明 取消了預約（2026/12/3 下午7:00:00）。原因：場地臨時整修。已退回 1 堂。',
    )
    expect(n.toCoach?.body).not.toContain('不退回')
  })

  it('(c) 改期 → 標題「預約已改期」且內文不含「取消了預約」、原因與堂數', () => {
    const n = buildCancelNotice({
      ...base,
      category: 'rescheduled',
      actorRole: 'customer',
      disposition: 'transferred',
    })
    expect(n.toCoach?.title).toBe('預約已改期')
    expect(n.toCoach?.body).toBe('陳小明 將預約改期（原時間 2026/12/3 下午7:00:00）')
    expect(n.toCoach?.body).not.toContain('取消了預約')
    expect(n.toCustomer).toBeUndefined()
  })

  it('(d) 助教取消 → 有 toOwners；Owner 取消 → 沒有 toOwners', () => {
    const staff = buildCancelNotice({ ...base, actorRole: 'staff' })
    expect(staff.toCustomer).toBeDefined()
    expect(staff.toOwners?.title).toBe('助教取消了預約')
    expect(staff.toOwners?.body).toBe(
      '陳小明 的 一對一基礎課（2026/12/3 下午7:00:00）。原因：場地臨時整修。',
    )

    const staffReject = buildCancelNotice({
      ...base,
      actorRole: 'staff',
      category: 'coach_rejected',
    })
    expect(staffReject.toOwners?.title).toBe('助教拒絕了預約')

    const owner = buildCancelNotice({ ...base, actorRole: 'owner' })
    expect(owner.toOwners).toBeUndefined()
  })

  it('系統取消（人數不足）不在這裡通知', () => {
    expect(buildCancelNotice({ ...base, actorRole: 'system', category: 'under_min' })).toEqual({})
  })

  it('(e) 所有輸出不含禁用詞與「退還」', () => {
    const cases: CancelNoticeInput[] = [
      base,
      { ...base, category: 'coach_rejected' },
      { ...base, actorRole: 'staff' },
      { ...base, actorRole: 'staff', category: 'coach_rejected' },
      { ...base, actorRole: 'customer', category: 'customer', disposition: 'forfeited' },
      { ...base, actorRole: 'customer', category: 'customer', disposition: 'refunded' },
      { ...base, actorRole: 'customer', category: 'rescheduled', disposition: 'transferred' },
    ]
    for (const c of cases) {
      const copies = allCopies(buildCancelNotice(c))
      expect(copies.length).toBeGreaterThan(0)
      for (const text of copies) {
        for (const term of FORBIDDEN_TERMS) expect(text).not.toContain(term)
        expect(text).not.toContain('退還')
      }
    }
  })
})

describe('purchaseRejectedBody', () => {
  it('有原因時接在冒號後面', () => {
    expect(purchaseRejectedBody('羽球王教練', '名額已滿')).toBe(
      '羽球王教練 已拒絕您的購買申請：名額已滿',
    )
  })
  it('沒有原因或只有空白時不以冒號結尾', () => {
    expect(purchaseRejectedBody('羽球王教練', null)).toBe('羽球王教練 已拒絕您的購買申請')
    expect(purchaseRejectedBody('羽球王教練', '  ')).toBe('羽球王教練 已拒絕您的購買申請')
  })
  it('沒有租戶名稱時寫「教練」', () => {
    expect(purchaseRejectedBody(null, null)).toBe('教練 已拒絕您的購買申請')
  })
})
