// 公開頁時段的共用純函式：把資料庫函式 public_bookable_slots 的資料列整理成前端要的形狀，
// 以及預約確認頁判斷「這個時段還能不能約」。
// 資料列缺欄位或人數不是數字時一律 throw，不當成 0 也不略過（失敗不可冒充正常結果）。

/** public_bookable_slots 回傳的一列 */
export type BookableSlotRow = {
  id: string
  start_at: string
  end_at: string
  max_capacity: number
  taken: number
}

/** 回傳給公開頁的時段形狀（src/app/[tenantSlug]/slot-picker.tsx 的 Slot 型別在用，不可改） */
export type PublicSlot = {
  id: string
  start_at: string
  end_at: string
  max_capacity: number
  current_bookings: number
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0
}

function isCount(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

/** 檢查一列資料是否完整；不完整就 throw */
function assertRow(row: unknown, index: number): asserts row is BookableSlotRow {
  if (typeof row !== 'object' || row === null) {
    throw new Error(`public_bookable_slots 第 ${index} 列不是物件`)
  }
  const r = row as Record<string, unknown>
  for (const key of ['id', 'start_at', 'end_at'] as const) {
    if (!isNonEmptyString(r[key])) {
      throw new Error(`public_bookable_slots 第 ${index} 列缺少 ${key}`)
    }
  }
  for (const key of ['max_capacity', 'taken'] as const) {
    if (!isCount(r[key])) {
      throw new Error(`public_bookable_slots 第 ${index} 列的 ${key} 不是數字`)
    }
  }
}

/** 資料列 → 回傳給公開頁的時段（current_bookings 取已佔名額 taken） */
export function toPublicSlots(rows: readonly BookableSlotRow[]): PublicSlot[] {
  return rows.map((row, i) => {
    assertRow(row, i)
    return {
      id: row.id,
      start_at: row.start_at,
      end_at: row.end_at,
      max_capacity: row.max_capacity,
      current_bookings: row.taken,
    }
  })
}

/**
 * 依開始時間的 UTC 日期（start_at 前 10 個字元，yyyy-MM-dd）分組計數，
 * 與 /api/public/slots 選某一天時回傳的時段一致。
 */
export function countSlotsByDay(rows: readonly BookableSlotRow[]): Record<string, number> {
  const counts: Record<string, number> = {}
  rows.forEach((row, i) => {
    assertRow(row, i)
    const dayKey = row.start_at.slice(0, 10)
    counts[dayKey] = (counts[dayKey] ?? 0) + 1
  })
  return counts
}

/**
 * 預約確認頁用：時段狀態是「沒人預約（available）」或「有人預約但未額滿（pending）」，
 * 且已佔名額小於上限，才算還能預約。
 */
export function isSlotBookable(o: { status: string; taken: number; maxCapacity: number }): boolean {
  if (o.status !== 'available' && o.status !== 'pending') return false
  return o.taken < o.maxCapacity
}
