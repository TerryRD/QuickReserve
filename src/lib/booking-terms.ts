// src/lib/booking-terms.ts
// 預約流程的唯一用語表（設計文件 §2、§3）。畫面、通知、錯誤訊息一律從這裡取用語。

export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'no_show' | 'cancelled'
export type CancelCategory =
  | 'customer'
  | 'rescheduled'
  | 'coach_rejected'
  | 'confirm_expired'
  | 'leave'
  | 'coach_cancelled'
  | 'late_cancel'
  | 'under_min'
  | 'legacy'
export type ClassDisposition = 'refunded' | 'forfeited' | 'transferred'
export type ActorRole = 'customer' | 'owner' | 'staff' | 'system'
export type PurchaseApprovalStatus = 'pending_review' | 'confirmed' | 'rejected'
export type Viewer = 'customer' | 'tenant'

export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  pending: '待確認',
  confirmed: '已確認',
  completed: '已出席',
  no_show: '未出席',
  cancelled: '已取消',
}

export const CANCEL_CATEGORY_LABEL: Record<CancelCategory, string> = {
  customer: '學員取消',
  rescheduled: '改期',
  coach_rejected: '教練拒絕',
  confirm_expired: '逾期未確認',
  leave: '請假',
  coach_cancelled: '教練取消',
  late_cancel: '學員臨時取消（教練代登）',
  under_min: '人數不足',
  legacy: '舊資料（未分類）',
}

export const CLASS_DISPOSITION_LABEL: Record<ClassDisposition, string> = {
  refunded: '退回',
  forfeited: '不退回',
  transferred: '轉到新預約',
}

/**
 * 堂數處理的結果說法（取消紀錄、預約清單摘要、學員卡片共用）：
 * 已退回 1 堂／不退回／已轉到新預約。一筆預約只用 1 堂，所以退回固定寫 1 堂。
 */
export function classDispositionText(disposition: ClassDisposition): string {
  switch (disposition) {
    case 'refunded':
      return `已${CLASS_DISPOSITION_LABEL.refunded} 1 堂`
    case 'forfeited':
      return CLASS_DISPOSITION_LABEL.forfeited
    case 'transferred':
      return `已${CLASS_DISPOSITION_LABEL.transferred}`
  }
}

/** 清單摘要與推播內文裡的原因最多顯示幾個字，超過截斷加「…」，完整原因在明細頁看 */
export const REASON_PREVIEW_MAX = 40

/** 原因的簡短版本（去頭尾空白；空白或沒填回傳 null） */
export function previewReason(reason: string | null | undefined): string | null {
  const r = reason?.trim()
  if (!r) return null
  return r.length > REASON_PREVIEW_MAX ? `${r.slice(0, REASON_PREVIEW_MAX)}…` : r
}

export const PURCHASE_APPROVAL_LABEL: Record<PurchaseApprovalStatus, string> = {
  pending_review: '審核中',
  confirmed: '已核准',
  rejected: '已拒絕',
}

/** 畫面上不得出現的舊用語 */
export const FORBIDDEN_TERMS: readonly string[] = ['套裝', '課卡', '套票', '已完成', '未到場']

function labelOf<K extends string>(table: Record<K, string>, key: unknown): string | undefined {
  return typeof key === 'string' && Object.hasOwn(table, key) ? table[key as K] : undefined
}

/** 學員端：owner／staff 一律顯示「教練」；教練端分別顯示「Owner」「助教」 */
export function actorRoleLabel(role: ActorRole, viewer: Viewer): string {
  switch (role) {
    case 'customer':
      return '學員'
    case 'system':
      return '系統'
    case 'owner':
      return viewer === 'customer' ? '教練' : 'Owner'
    case 'staff':
      return viewer === 'customer' ? '教練' : '助教'
    default:
      return ''
  }
}

/** 歷程事件 → 一行白話描述。未知事件回傳「其他紀錄」，不得回傳事件代碼 */
export function describeActivity(
  row: { event: string; actor_role: ActorRole; detail: Record<string, unknown> | null },
  viewer: Viewer,
): string {
  const actor = actorRoleLabel(row.actor_role, viewer)
  const detail = row.detail ?? {}

  switch (row.event) {
    case 'booking.created':
      return `${actor}建立預約`
    case 'booking.confirmed':
      return detail.auto === true ? '已達開班人數，系統自動確認' : `${actor}確認預約`
    case 'booking.cancelled': {
      const category = labelOf(CANCEL_CATEGORY_LABEL, detail.category) ?? '取消預約'
      const disposition = labelOf(CLASS_DISPOSITION_LABEL, detail.disposition)
      return disposition ? `${category}・${disposition}` : category
    }
    case 'booking.rescheduled_out':
      return `${actor}改期（改到新的時段）`
    case 'booking.rescheduled_in':
      return '由改期建立'
    case 'booking.checked_in':
      return '學員簽到'
    case 'booking.no_show':
      return '課程結束未簽到，系統標為未出席'
    case 'slot.closed':
      return '時段關閉'
    default:
      return '其他紀錄'
  }
}
