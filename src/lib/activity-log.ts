import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { AppError } from './errors'
import { memberDisplayName } from './auth/display-name'
import type { ActorRole } from './booking-terms'
import type { Database } from './supabase/types'

type Client = SupabaseClient<Database>

const LOAD_FAILED_MESSAGE = '目前無法取得預約歷程，請稍後再試'

const ACTOR_ROLES: readonly ActorRole[] = ['customer', 'owner', 'staff', 'system']

export type TimelineEntry = {
  id: string
  event: string
  actorRole: ActorRole
  /** 操作人名稱（只有教練端會查；查不到或學員端時為 null） */
  actorName: string | null
  reason: string | null
  detail: Record<string, unknown>
  createdAt: string
}

// 同一交易寫入的多筆紀錄時間相同（例如建立預約後立即自動確認），以事件先後補排序
const EVENT_ORDER: Record<string, number> = {
  'booking.rescheduled_in': 0,
  'booking.created': 0,
  'booking.confirmed': 1,
  'booking.checked_in': 2,
  'booking.no_show': 2,
  'booking.cancelled': 3,
  'booking.rescheduled_out': 3,
}

function isActorRole(value: string): value is ActorRole {
  return (ACTOR_ROLES as readonly string[]).includes(value)
}

function toDetail(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

/**
 * 一筆預約的歷程，依時間由舊到新。查詢失敗時丟出 AppError（不回傳空陣列冒充「沒有紀錄」，B6.9）。
 * 助教查非自己時段的預約時，RLS 會讓結果為空陣列——這是合法結果，由呼叫端顯示說明。
 *
 * `withActorNames`：教練端傳 true，會另外查操作人名稱（學員用 customers.display_name，
 * 成員取法見 memberDisplayName：顯示名稱 → invited_email 的 @ 前段）。RLS 擋掉而查不到名稱時 actorName 為 null，
 * 畫面只顯示身分；查詢本身失敗則丟出 AppError。
 */
export async function getBookingTimeline(
  supabase: Client,
  bookingId: string,
  options: { withActorNames?: boolean } = {},
): Promise<TimelineEntry[]> {
  const { data, error } = await supabase
    .from('activity_log')
    .select('id, event, actor_role, actor_user_id, reason, detail, created_at, tenant_id')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[activity-log] 讀取歷程失敗', error)
    throw new AppError('TIMELINE_UNAVAILABLE', LOAD_FAILED_MESSAGE)
  }

  const rows = data ?? []
  for (const r of rows) {
    if (!isActorRole(r.actor_role)) {
      console.error('[activity-log] 無法辨識的操作人身分', r.id, r.actor_role)
      throw new AppError('TIMELINE_INVALID', LOAD_FAILED_MESSAGE)
    }
  }

  const names = options.withActorNames
    ? await loadActorNames(supabase, rows)
    : new Map<string, string>()

  return rows
    .map((r, index) => ({ r, index }))
    .sort((a, b) => {
      const t = new Date(a.r.created_at).getTime() - new Date(b.r.created_at).getTime()
      if (t !== 0) return t
      const o = (EVENT_ORDER[a.r.event] ?? 2) - (EVENT_ORDER[b.r.event] ?? 2)
      return o !== 0 ? o : a.index - b.index
    })
    .map(({ r }) => ({
      id: r.id,
      event: r.event,
      actorRole: r.actor_role as ActorRole,
      actorName: r.actor_user_id
        ? (names.get(`${r.actor_role === 'customer' ? 'c' : 'm'}:${r.actor_user_id}`) ?? null)
        : null,
      reason: r.reason,
      detail: toDetail(r.detail),
      createdAt: r.created_at,
    }))
}

async function loadActorNames(
  supabase: Client,
  rows: { actor_role: string; actor_user_id: string | null; tenant_id: string }[],
): Promise<Map<string, string>> {
  const names = new Map<string, string>()
  const customerIds = [
    ...new Set(
      rows
        .filter((r) => r.actor_role === 'customer' && r.actor_user_id)
        .map((r) => r.actor_user_id!),
    ),
  ]
  const memberIds = [
    ...new Set(
      rows
        .filter((r) => (r.actor_role === 'owner' || r.actor_role === 'staff') && r.actor_user_id)
        .map((r) => r.actor_user_id!),
    ),
  ]
  const tenantIds = [...new Set(rows.map((r) => r.tenant_id))]

  if (customerIds.length > 0) {
    const { data, error } = await supabase
      .from('customers')
      .select('id, display_name')
      .in('id', customerIds)
    if (error) {
      console.error('[activity-log] 讀取學員名稱失敗', error)
      throw new AppError('TIMELINE_UNAVAILABLE', LOAD_FAILED_MESSAGE)
    }
    for (const c of data ?? []) {
      if (c.display_name) names.set(`c:${c.id}`, c.display_name)
    }
  }

  if (memberIds.length > 0) {
    const { data, error } = await supabase
      .from('tenant_members')
      .select('user_id, display_name, invited_email')
      .in('user_id', memberIds)
      .in('tenant_id', tenantIds)
    if (error) {
      console.error('[activity-log] 讀取成員名稱失敗', error)
      throw new AppError('TIMELINE_UNAVAILABLE', LOAD_FAILED_MESSAGE)
    }
    for (const m of data ?? []) {
      const name = memberDisplayName({
        displayName: m.display_name,
        invitedEmail: m.invited_email,
      })
      if (m.user_id && name) names.set(`m:${m.user_id}`, name)
    }
  }

  return names
}
