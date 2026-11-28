// 學員端「我的預約」卡片與預約明細頁共用的顯示文字（純函式，不碰資料庫）。日期格式見 @/lib/taipei-time
import { CANCEL_CATEGORY_LABEL, classDispositionText } from '@/lib/booking-terms'

/** 學員能不能自己改期或取消：待確認／已確認且尚未開課（畫面判斷；資料庫函式才是最終把關） */
export function canCustomerChangeBooking(
  status: string,
  startAt: string | null | undefined,
  now: Date,
): boolean {
  return (
    (status === 'pending' || status === 'confirmed') &&
    !!startAt &&
    new Date(startAt).getTime() > now.getTime()
  )
}

export type CancelInfo = {
  category: string | null
  reason: string | null
  actorRole: string | null
  disposition: string | null
}

function isKnownCategory(category: string | null): category is keyof typeof CANCEL_CATEGORY_LABEL {
  return !!category && Object.hasOwn(CANCEL_CATEGORY_LABEL, category)
}

/** 是否為改版前取消、沒有詳細紀錄的預約 */
export function isLegacyCancel(category: string | null): boolean {
  return !isKnownCategory(category) || category === 'legacy'
}

/**
 * 已取消卡片的灰底說明，例：「教練取消 · 原因：場地臨時整修」。
 * 學員自己取消寫「你取消」；改期依操作人寫「你改期」或「教練改期」。改版前的取消沒有紀錄，回傳 null。
 */
export function cancelSummaryLine(c: CancelInfo): string | null {
  if (!isKnownCategory(c.category) || c.category === 'legacy') return null
  let who: string
  if (c.category === 'customer') {
    who = '你取消'
  } else if (c.category === 'rescheduled') {
    who =
      c.actorRole === 'customer'
        ? '你改期'
        : c.actorRole === 'owner' || c.actorRole === 'staff'
          ? '教練改期'
          : CANCEL_CATEGORY_LABEL.rescheduled
  } else {
    who = CANCEL_CATEGORY_LABEL[c.category]
  }
  const reason = c.reason?.trim()
  return reason ? `${who} · 原因：${reason}` : who
}

/** 已取消卡片的堂數結果：已退回 1 堂／不退回／已改期；改版前的取消只寫「已取消」 */
export function cancelOutcomeText(c: Pick<CancelInfo, 'category' | 'disposition'>): string {
  if (isLegacyCancel(c.category)) return '已取消'
  if (c.category === 'rescheduled' || c.disposition === 'transferred') return '已改期'
  if (c.disposition === 'refunded' || c.disposition === 'forfeited')
    return classDispositionText(c.disposition)
  return '已取消'
}

type ListResult<T> = { data: T[] | null; error: unknown }
type CountResult = { count: number | null; error: unknown }

/** 「我的預約」頁的查詢結果整理成畫面狀態：任一查詢失敗就整頁改顯示讀取失敗，不以空清單或 0 冒充（B6.9） */
export type MyBookingsView<T> =
  | {
      ok: true
      bookings: T[]
      pendingCount: number
      completedCount: number
      cancelledCount: number
    }
  | { ok: false; failures: { query: string; error: unknown }[] }

export function resolveMyBookingsView<T>(res: {
  bookings: ListResult<T>
  pending: CountResult
  completed: CountResult
  cancelled: CountResult
}): MyBookingsView<T> {
  const failures: { query: string; error: unknown }[] = []
  const bookings = res.bookings.error ? null : res.bookings.data
  if (!bookings) failures.push({ query: 'bookings', error: res.bookings.error })
  const count = (key: 'pending' | 'completed' | 'cancelled'): number | null => {
    const r = res[key]
    if (r.error || r.count === null) {
      failures.push({ query: `${key} count`, error: r.error })
      return null
    }
    return r.count
  }
  const pendingCount = count('pending')
  const completedCount = count('completed')
  const cancelledCount = count('cancelled')
  if (!bookings || pendingCount === null || completedCount === null || cancelledCount === null)
    return { ok: false, failures }
  return { ok: true, bookings, pendingCount, completedCount, cancelledCount }
}
