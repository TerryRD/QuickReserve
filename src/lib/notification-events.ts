import { safePath } from '@/lib/safe-path'

/**
 * 通知事件清單（唯一定義處）。
 * - audience：哪一方會收到（customer＝學員、tenant＝教練端）
 * - configurable：使用者能不能在偏好設定裡關掉
 * - kind：event＝事件當下發出；reminder＝排程提醒
 * - latestUnreadOnly：同一類只留最新一則未讀（新的一則寫入時，舊的未讀自動標為已讀）
 *
 * 這個檔案不含伺服器端專用程式，前端元件也可以引用。
 */
export const NOTIFICATION_EVENTS = [
  {
    key: 'booking_created',
    label: '新預約',
    audience: ['tenant'],
    configurable: true,
    kind: 'event',
    latestUnreadOnly: false,
  },
  {
    key: 'booking_confirmed',
    label: '預約已確認／已成班',
    audience: ['customer', 'tenant'],
    configurable: true,
    kind: 'event',
    latestUnreadOnly: false,
  },
  {
    key: 'booking_cancelled',
    label: '預約取消',
    audience: ['customer', 'tenant'],
    configurable: true,
    kind: 'event',
    latestUnreadOnly: false,
  },
  {
    key: 'booking_rescheduled',
    label: '預約改期',
    audience: ['customer', 'tenant'],
    configurable: true,
    kind: 'event',
    latestUnreadOnly: false,
  },
  {
    key: 'leave_request',
    label: '請假申請',
    audience: ['customer', 'tenant'],
    configurable: true,
    kind: 'event',
    latestUnreadOnly: false,
  },
  {
    key: 'package_request',
    label: '購買申請',
    audience: ['tenant'],
    configurable: true,
    kind: 'event',
    latestUnreadOnly: false,
  },
  {
    key: 'package_approved',
    label: '購買申請結果',
    audience: ['customer'],
    configurable: true,
    kind: 'event',
    latestUnreadOnly: false,
  },
  {
    key: 'pre_event',
    label: '課前提醒',
    audience: ['customer'],
    configurable: true,
    kind: 'reminder',
    latestUnreadOnly: false,
  },
  {
    key: 'daily_reminder',
    label: '每日提醒',
    audience: ['customer', 'tenant'],
    configurable: true,
    kind: 'reminder',
    latestUnreadOnly: true,
  },
  {
    key: 'weekly_summary',
    label: '每週摘要',
    audience: ['customer', 'tenant'],
    configurable: true,
    kind: 'reminder',
    latestUnreadOnly: true,
  },
  {
    key: 'checkin_reminder',
    label: '簽到提醒',
    audience: ['customer'],
    configurable: false,
    kind: 'event',
    latestUnreadOnly: false,
  },
  {
    key: 'checkin_missing',
    label: '尚未簽到',
    audience: ['customer', 'tenant'],
    configurable: false,
    kind: 'event',
    latestUnreadOnly: false,
  },
  {
    key: 'checkin_done',
    label: '學員已簽到',
    audience: ['tenant'],
    configurable: false,
    kind: 'event',
    latestUnreadOnly: false,
  },
] as const

export type NotificationEventKey = (typeof NOTIFICATION_EVENTS)[number]['key']

/** 頁首通知小視窗列出最近幾則 */
export const RECENT_NOTIFICATION_LIMIT = 5

/** 改版前留在通知紀錄裡的舊類型，仍要顯示得出名稱 */
const LEGACY_LABELS = new Map<string, string>([
  ['booking_status', '預約通知'],
  ['purchase_request', '購買申請'],
  ['recovery', '帳號回復'],
])

const FALLBACK_LABEL = '通知'

/** 通知類型的顯示名稱；查不到一律回「通知」，絕不回傳類型代碼 */
export function notificationLabel(type: string): string {
  const event = NOTIFICATION_EVENTS.find((e) => e.key === type)
  if (event) return event.label
  return LEGACY_LABELS.get(type) ?? FALLBACK_LABEL
}

/** 這一類是否只留最新一則未讀 */
export function isLatestUnreadOnly(type: string): boolean {
  return NOTIFICATION_EVENTS.some((e) => e.key === type && e.latestUnreadOnly)
}

/**
 * 通知連結只接受站內路徑（以 / 開頭，不可 // 或 /\ 開頭），與資料庫的
 * notification_log_url_internal_check 一致；不合規則（含沒給）回 null。
 * 判斷規則沿用 safePath：合規的路徑 safePath 會原樣回傳。
 */
export function toInAppUrl(url: string | null | undefined): string | null {
  if (!url) return null
  return safePath(url) === url ? url : null
}
