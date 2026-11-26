// src/lib/booking-rpc-errors.ts
import { AppError } from '@/lib/errors'

const GENERIC_MESSAGE = '操作失敗，請稍後再試'

/** 預約相關 RPC 的錯誤代碼 → 給使用者看的白話訊息 */
export const BOOKING_RPC_ERROR_MESSAGE = {
  REASON_REQUIRED: '請填寫原因',
  REASON_TOO_LONG: '原因請不要超過 500 字',
  FORBIDDEN: '你沒有權限操作這筆預約',
  BOOKING_NOT_FOUND: '找不到這筆預約',
  INVALID_STATE: '這筆預約目前的狀態無法進行這個操作',
  SLOT_STARTED: '課程已經開始，無法取消或改期',
  SERVICE_MISMATCH: '只能改到同一個服務的時段',
  SAME_SLOT: '這就是目前的時段，請選其他時段',
  SLOT_UNAVAILABLE: '這個時段已經無法預約',
  SLOT_NOT_FOUND: '找不到這個時段',
  SLOT_FULL: '這個時段名額已滿',
  SLOT_PAST: '這個時段已經過了',
  CROSS_TENANT: '不能改到其他教練的時段',
  NO_BALANCE: '目前沒有可用的剩餘堂數，請先購買',
  PURCHASE_INVALID: '選擇的堂數已無法使用，請重新選擇',
  CUSTOMER_BLOCKED: '這位教練目前不接受您的預約',
  ALREADY_CHECKED_IN: '已經簽到過了',
  NOT_CONFIRMED: '這筆預約尚未確認，無法簽到',
  CHECKIN_TOO_EARLY: '尚未開放簽到（開課前 30 分鐘起）',
  CHECKIN_CLOSED: '課程已結束，無法簽到',
} as const satisfies Record<string, string>

export type BookingRpcErrorCode = keyof typeof BOOKING_RPC_ERROR_MESSAGE

// 較長的代碼先比對，避免短代碼剛好是長代碼的一部分時誤判
const CODES_LONGEST_FIRST = (Object.keys(BOOKING_RPC_ERROR_MESSAGE) as BookingRpcErrorCode[]).sort(
  (a, b) => b.length - a.length,
)

/** 把 RPC 錯誤轉成給使用者看的 AppError。未知錯誤回傳通用訊息，並用 console.error 留下原始訊息供除錯。 */
export function toBookingAppError(error: { message?: string } | null | undefined): AppError {
  const message = error?.message ?? ''
  const code = CODES_LONGEST_FIRST.find((c) => message.includes(c))
  if (code) return new AppError(code, BOOKING_RPC_ERROR_MESSAGE[code])
  console.error('[booking-rpc]', error)
  return new AppError('UNKNOWN', GENERIC_MESSAGE)
}
