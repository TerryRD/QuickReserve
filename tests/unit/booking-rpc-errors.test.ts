import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppError } from '@/lib/errors'
import { toBookingAppError } from '@/lib/booking-rpc-errors'

const EXPECTED: [string, string][] = [
  ['REASON_REQUIRED', '請填寫原因'],
  ['REASON_TOO_LONG', '原因請不要超過 500 字'],
  ['FORBIDDEN', '你沒有權限操作這筆預約'],
  ['BOOKING_NOT_FOUND', '找不到這筆預約'],
  ['INVALID_STATE', '這筆預約目前的狀態無法進行這個操作'],
  ['SLOT_STARTED', '課程已經開始，無法取消或改期'],
  ['SERVICE_MISMATCH', '只能改到同一個服務的時段'],
  ['SAME_SLOT', '這就是目前的時段，請選其他時段'],
  ['SLOT_UNAVAILABLE', '這個時段已經無法預約'],
  ['SLOT_NOT_FOUND', '找不到這個時段'],
  ['SLOT_FULL', '這個時段名額已滿'],
  ['SLOT_PAST', '這個時段已經過了'],
  ['CROSS_TENANT', '不能改到其他教練的時段'],
  ['NO_BALANCE', '目前沒有可用的剩餘堂數，請先購買'],
  ['PURCHASE_INVALID', '選擇的堂數已無法使用，請重新選擇'],
  ['CUSTOMER_BLOCKED', '這位教練目前不接受您的預約'],
  ['ALREADY_CHECKED_IN', '已經簽到過了'],
  ['NOT_CONFIRMED', '這筆預約尚未確認，無法簽到'],
  ['CHECKIN_TOO_EARLY', '尚未開放簽到（開課前 30 分鐘起）'],
  ['CHECKIN_CLOSED', '課程已結束，無法簽到'],
]

const GENERIC = '操作失敗，請稍後再試'

describe('toBookingAppError', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it.each(EXPECTED)('%s → 指定訊息', (code, message) => {
    const err = toBookingAppError({ message: code })
    expect(err).toBeInstanceOf(AppError)
    expect(err.code).toBe(code)
    expect(err.message).toBe(message)
  })

  it('訊息裡夾帶代碼時也能對應（資料庫錯誤的原文格式）', () => {
    const err = toBookingAppError({ message: 'P0001: REASON_TOO_LONG' })
    expect(err.code).toBe('REASON_TOO_LONG')
  })

  it('未知錯誤回傳通用訊息並留下除錯紀錄', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const err = toBookingAppError({ message: 'duplicate key value violates unique constraint' })
    expect(err.code).toBe('UNKNOWN')
    expect(err.message).toBe(GENERIC)
    expect(spy).toHaveBeenCalled()
  })

  it('所有輸出訊息都不含大寫英文底線代碼', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const inputs = [...EXPECTED.map(([code]) => code), 'SOMETHING_ELSE', '']
    for (const input of inputs) {
      expect(toBookingAppError({ message: input }).message).not.toMatch(/[A-Z]{2,}_[A-Z]/)
    }
  })

  it('null／undefined 輸入不丟例外', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(toBookingAppError(null).message).toBe(GENERIC)
    expect(toBookingAppError(undefined).message).toBe(GENERIC)
    expect(toBookingAppError({}).message).toBe(GENERIC)
  })
})
