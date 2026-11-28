// 預約管理清單與教練端預約明細頁共用的顯示規則（狀態樣式、取消摘要）。日期格式見 @/lib/taipei-time
import {
  BOOKING_STATUS_LABEL,
  CANCEL_CATEGORY_LABEL,
  CLASS_DISPOSITION_LABEL,
  classDispositionText,
  previewReason,
  type BookingStatus,
  type CancelCategory,
  type ClassDisposition,
} from '@/lib/booking-terms'

export const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-emerald-100 text-emerald-800',
  completed: 'bg-slate-100 text-slate-700',
  no_show: 'bg-slate-100 text-slate-500',
  cancelled: 'bg-slate-100 text-slate-500',
}

export function statusLabel(status: string): string {
  return Object.hasOwn(BOOKING_STATUS_LABEL, status)
    ? BOOKING_STATUS_LABEL[status as BookingStatus]
    : '其他'
}

export function asCategory(value: string | null): CancelCategory | null {
  return value && Object.hasOwn(CANCEL_CATEGORY_LABEL, value) ? (value as CancelCategory) : null
}

export function asDisposition(value: string | null): ClassDisposition | null {
  return value && Object.hasOwn(CLASS_DISPOSITION_LABEL, value) ? (value as ClassDisposition) : null
}

/**
 * 已取消卡片的一行摘要，例：「教練取消 · 已退回 1 堂 · 原因：場地臨時整修」。
 * 改版前的舊資料（legacy）只寫類別；沒有類別時回傳 null。
 */
export function cancelSummary(row: {
  cancel_category: string | null
  cancel_reason: string | null
  class_disposition: string | null
}): string | null {
  const category = asCategory(row.cancel_category)
  if (!category) return null
  const categoryLabel = CANCEL_CATEGORY_LABEL[category]
  if (category === 'legacy') return categoryLabel
  const parts = [categoryLabel]
  const disposition = asDisposition(row.class_disposition)
  if (disposition) parts.push(classDispositionText(disposition))
  const reason = previewReason(row.cancel_reason)
  if (reason) parts.push(`原因：${reason}`)
  return parts.join(' · ')
}
