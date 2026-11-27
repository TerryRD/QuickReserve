import { describe, expect, it } from 'vitest'
import {
  countSlotsByDay,
  isSlotBookable,
  toPublicSlots,
  type BookableSlotRow,
} from '@/lib/public-slots'

function row(over: Partial<BookableSlotRow> = {}): BookableSlotRow {
  return {
    id: 'slot-1',
    start_at: '2026-12-03T02:00:00+00:00',
    end_at: '2026-12-03T03:00:00+00:00',
    max_capacity: 3,
    taken: 1,
    ...over,
  }
}

/** 模擬資料庫回傳的壞資料（型別上不合法，所以先轉成 unknown） */
function bad(over: Record<string, unknown>): BookableSlotRow {
  return { ...row(), ...over } as unknown as BookableSlotRow
}

describe('toPublicSlots', () => {
  it('沒有資料時回傳空陣列', () => {
    expect(toPublicSlots([])).toEqual([])
  })

  it('已佔名額 taken 對應到 current_bookings', () => {
    const [slot] = toPublicSlots([row({ taken: 2 })])
    expect(slot!.current_bookings).toBe(2)
    expect(slot).not.toHaveProperty('taken')
  })

  it('時段 id、開始與結束時間、名額上限原樣帶出，順序不變', () => {
    const rows = [
      row({ id: 'a', start_at: '2026-12-03T02:00:00+00:00', end_at: '2026-12-03T03:00:00+00:00' }),
      row({ id: 'b', start_at: '2026-12-03T04:00:00+00:00', end_at: '2026-12-03T05:00:00+00:00' }),
    ]
    expect(toPublicSlots(rows)).toEqual([
      {
        id: 'a',
        start_at: '2026-12-03T02:00:00+00:00',
        end_at: '2026-12-03T03:00:00+00:00',
        max_capacity: 3,
        current_bookings: 1,
      },
      {
        id: 'b',
        start_at: '2026-12-03T04:00:00+00:00',
        end_at: '2026-12-03T05:00:00+00:00',
        max_capacity: 3,
        current_bookings: 1,
      },
    ])
  })

  it('個人班沒人預約：名額 1、人數 0', () => {
    expect(toPublicSlots([row({ max_capacity: 1, taken: 0 })])[0]).toMatchObject({
      max_capacity: 1,
      current_bookings: 0,
    })
  })

  it('已佔名額不是數字時丟錯，不當成 0', () => {
    expect(() => toPublicSlots([bad({ taken: null })])).toThrow(/taken/)
    expect(() => toPublicSlots([bad({ taken: '1' })])).toThrow(/taken/)
    expect(() => toPublicSlots([bad({ taken: Number.NaN })])).toThrow(/taken/)
  })

  it('名額上限不是數字時丟錯', () => {
    expect(() => toPublicSlots([bad({ max_capacity: undefined })])).toThrow(/max_capacity/)
  })

  it('缺少時段 id 或時間時丟錯，不略過', () => {
    expect(() => toPublicSlots([bad({ id: undefined })])).toThrow(/id/)
    expect(() => toPublicSlots([bad({ start_at: null })])).toThrow(/start_at/)
    expect(() => toPublicSlots([bad({ end_at: '' })])).toThrow(/end_at/)
  })

  it('有一列壞掉就整批丟錯，不只回傳好的那幾列', () => {
    expect(() => toPublicSlots([row(), bad({ taken: null })])).toThrow()
  })

  it('資料列不是物件時丟錯', () => {
    expect(() => toPublicSlots([null as unknown as BookableSlotRow])).toThrow()
  })
})

describe('countSlotsByDay', () => {
  it('沒有資料時回傳空物件', () => {
    expect(countSlotsByDay([])).toEqual({})
  })

  it('同一天的多個時段合計', () => {
    const rows = [
      row({ id: 'a', start_at: '2026-12-03T02:00:00+00:00' }),
      row({ id: 'b', start_at: '2026-12-03T04:00:00+00:00' }),
      row({ id: 'c', start_at: '2026-12-03T23:00:00+00:00' }),
    ]
    expect(countSlotsByDay(rows)).toEqual({ '2026-12-03': 3 })
  })

  it('依開始時間的 UTC 日期分組（台灣時間跨日的時段算在 UTC 那天）', () => {
    const rows = [
      row({ id: 'a', start_at: '2026-12-03T02:00:00+00:00' }),
      // 台灣時間 12/5 早上 7 點，UTC 仍是 12/4
      row({ id: 'b', start_at: '2026-12-04T23:00:00+00:00' }),
      row({ id: 'c', start_at: '2026-12-05T01:00:00+00:00' }),
      row({ id: 'd', start_at: '2026-12-05T03:00:00+00:00' }),
    ]
    expect(countSlotsByDay(rows)).toEqual({
      '2026-12-03': 1,
      '2026-12-04': 1,
      '2026-12-05': 2,
    })
  })

  it('開始時間缺少時丟錯', () => {
    expect(() => countSlotsByDay([bad({ start_at: undefined })])).toThrow(/start_at/)
  })

  it('已佔名額不是數字時丟錯，不默默計入', () => {
    expect(() => countSlotsByDay([row(), bad({ taken: null })])).toThrow(/taken/)
  })
})

describe('isSlotBookable', () => {
  it('個人班沒人預約（available、0/1）→ 可以預約', () => {
    expect(isSlotBookable({ status: 'available', taken: 0, maxCapacity: 1 })).toBe(true)
  })

  it('個人班已有人預約（pending、1/1）→ 不可預約', () => {
    expect(isSlotBookable({ status: 'pending', taken: 1, maxCapacity: 1 })).toBe(false)
  })

  it('團班有人預約但未額滿（pending、1/3）→ 可以預約', () => {
    expect(isSlotBookable({ status: 'pending', taken: 1, maxCapacity: 3 })).toBe(true)
  })

  it('團班已額滿（pending、3/3）→ 不可預約', () => {
    expect(isSlotBookable({ status: 'pending', taken: 3, maxCapacity: 3 })).toBe(false)
  })

  it('已額滿（booked）的時段 → 不可預約，即使人數看起來還有空位', () => {
    expect(isSlotBookable({ status: 'booked', taken: 0, maxCapacity: 3 })).toBe(false)
  })

  it('已關閉（cancelled）的時段 → 不可預約', () => {
    expect(isSlotBookable({ status: 'cancelled', taken: 0, maxCapacity: 3 })).toBe(false)
  })

  it('已佔名額超過上限 → 不可預約', () => {
    expect(isSlotBookable({ status: 'available', taken: 4, maxCapacity: 3 })).toBe(false)
    expect(isSlotBookable({ status: 'pending', taken: 2, maxCapacity: 1 })).toBe(false)
  })
})
