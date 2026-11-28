import { describe, expect, it } from 'vitest'
import {
  BOOKING_STATUS_LABEL,
  CANCEL_CATEGORY_LABEL,
  CLASS_DISPOSITION_LABEL,
  FORBIDDEN_TERMS,
  PURCHASE_APPROVAL_LABEL,
  actorRoleLabel,
  classDispositionText,
  describeActivity,
  type ActorRole,
  type Viewer,
} from '@/lib/booking-terms'

const TABLES = {
  BOOKING_STATUS_LABEL,
  CANCEL_CATEGORY_LABEL,
  CLASS_DISPOSITION_LABEL,
  PURCHASE_APPROVAL_LABEL,
} as const

const VIEWERS: Viewer[] = ['customer', 'tenant']
const ROLES: ActorRole[] = ['customer', 'owner', 'staff', 'system']

const EVENTS: { event: string; detail: Record<string, unknown> | null }[] = [
  { event: 'booking.created', detail: { slot_id: 's1' } },
  { event: 'booking.confirmed', detail: {} },
  { event: 'booking.confirmed', detail: { auto: true, trigger: 'min_attendance' } },
  { event: 'booking.cancelled', detail: { category: 'customer', disposition: 'forfeited' } },
  { event: 'booking.rescheduled_out', detail: { category: 'rescheduled' } },
  { event: 'booking.rescheduled_in', detail: {} },
  { event: 'booking.checked_in', detail: { source: 'customer_checkin' } },
  { event: 'booking.no_show', detail: { source: 'system' } },
  { event: 'slot.closed', detail: { cancelled_bookings: 2 } },
]

function allOutputs(): string[] {
  const out: string[] = []
  for (const table of Object.values(TABLES)) out.push(...Object.values(table))
  for (const viewer of VIEWERS) {
    for (const role of ROLES) {
      out.push(actorRoleLabel(role, viewer))
      for (const e of EVENTS) out.push(describeActivity({ ...e, actor_role: role }, viewer))
    }
  }
  return out
}

describe('booking-terms 對照表', () => {
  it.each(Object.entries(TABLES))('%s 每個鍵都有非空字串', (_name, table) => {
    for (const value of Object.values(table)) {
      expect(typeof value).toBe('string')
      expect(value.trim().length).toBeGreaterThan(0)
    }
  })

  it('所有用語與歷程描述都不含禁用詞', () => {
    for (const text of allOutputs()) {
      for (const term of FORBIDDEN_TERMS) expect(text).not.toContain(term)
    }
  })

  it('預約狀態與購買審核狀態的關鍵用語', () => {
    expect(BOOKING_STATUS_LABEL.completed).toBe('已出席')
    expect(BOOKING_STATUS_LABEL.no_show).toBe('未出席')
    expect(PURCHASE_APPROVAL_LABEL.confirmed).toBe('已核准')
  })

  it('禁用詞清單', () => {
    expect(FORBIDDEN_TERMS).toEqual(['套裝', '課卡', '套票', '已完成', '未到場'])
  })
})

describe('actorRoleLabel', () => {
  it('學員端把 Owner 與助教都顯示為教練', () => {
    expect(actorRoleLabel('staff', 'customer')).toBe('教練')
    expect(actorRoleLabel('owner', 'customer')).toBe('教練')
  })
  it('教練端分別顯示 Owner 與助教', () => {
    expect(actorRoleLabel('staff', 'tenant')).toBe('助教')
    expect(actorRoleLabel('owner', 'tenant')).toBe('Owner')
  })
  it('學員與系統兩端相同', () => {
    for (const viewer of VIEWERS) {
      expect(actorRoleLabel('customer', viewer)).toBe('學員')
      expect(actorRoleLabel('system', viewer)).toBe('系統')
    }
  })
})

describe('describeActivity', () => {
  it('未知事件回傳「其他紀錄」', () => {
    expect(describeActivity({ event: 'x.y', actor_role: 'system', detail: null }, 'customer')).toBe(
      '其他紀錄',
    )
  })

  it('取消事件顯示取消類別與堂數處理', () => {
    expect(
      describeActivity(
        {
          event: 'booking.cancelled',
          actor_role: 'owner',
          detail: { category: 'coach_cancelled', disposition: 'refunded' },
        },
        'customer',
      ),
    ).toBe('教練取消・退回')
  })

  it('取消事件缺少類別或堂數處理時不露出代碼', () => {
    expect(
      describeActivity(
        { event: 'booking.cancelled', actor_role: 'system', detail: { category: 'bogus' } },
        'tenant',
      ),
    ).toBe('取消預約')
  })

  it('依身分與檢視端組出描述', () => {
    expect(
      describeActivity({ event: 'booking.created', actor_role: 'staff', detail: {} }, 'customer'),
    ).toBe('教練建立預約')
    expect(
      describeActivity({ event: 'booking.confirmed', actor_role: 'staff', detail: {} }, 'tenant'),
    ).toBe('助教確認預約')
    expect(
      describeActivity(
        { event: 'booking.confirmed', actor_role: 'system', detail: { auto: true } },
        'tenant',
      ),
    ).toBe('已達開班人數，系統自動確認')
    expect(
      describeActivity(
        { event: 'booking.rescheduled_out', actor_role: 'customer', detail: null },
        'customer',
      ),
    ).toBe('學員改期（改到新的時段）')
  })

  it('輸出不含事件代碼或英文底線代碼', () => {
    for (const text of allOutputs()) expect(text).not.toMatch(/[a-z]+[._][a-z]+/)
  })
})

describe('classDispositionText（堂數結果的說法）', () => {
  it('已退回 1 堂／不退回／已轉到新預約', () => {
    expect(classDispositionText('refunded')).toBe('已退回 1 堂')
    expect(classDispositionText('forfeited')).toBe('不退回')
    expect(classDispositionText('transferred')).toBe('已轉到新預約')
  })

  it('不含禁用詞與「退還」', () => {
    for (const d of ['refunded', 'forfeited', 'transferred'] as const)
      for (const term of [...FORBIDDEN_TERMS, '退還'])
        expect(classDispositionText(d)).not.toContain(term)
  })
})
