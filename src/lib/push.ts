import webpush from 'web-push'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import { isLatestUnreadOnly, toInAppUrl } from '@/lib/notification-events'

let configured = false

/** 設定推播金鑰；三個環境變數缺任一個就回 false（不推播，但站內紀錄照寫） */
function ensureConfigured(): boolean {
  if (configured) return true
  const subject = process.env.VAPID_SUBJECT
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!subject || !publicKey || !privateKey) {
    console.error('[push] 推播金鑰未設定，本次只寫站內紀錄')
    return false
  }
  webpush.setVapidDetails(subject, publicKey, privateKey)
  configured = true
  return true
}

export type PushPayload = {
  title: string
  body: string
  url?: string
  icon?: string
  badge?: string
  tag?: string
}

export type NotificationDispatch = {
  userId: string
  type: string
  payload: PushPayload
  relatedId?: string | null
  scheduledFor?: string | null
}

type LogRow = Database['public']['Tables']['notification_log']['Insert']

/**
 * 寫一筆站內通知紀錄（pushToUser 與 recordInAppNotification 共用）。
 * - url 只收站內路徑，不合規則存 null
 * - 「只留最新一則未讀」的類型：寫入前把同使用者、同類型的舊未讀標為已讀
 * 任何失敗都只記 log，不往外丟——通知失敗不能讓呼叫端的主要動作失敗。
 */
async function writeNotificationLog(
  supabase: SupabaseClient<Database>,
  row: Omit<LogRow, 'url'> & { url?: string | null },
): Promise<void> {
  const url = toInAppUrl(row.url)
  if (row.url && url === null) {
    console.error('[push] 通知連結不是站內路徑，改存空值', { type: row.type, url: row.url })
  }

  try {
    if (isLatestUnreadOnly(row.type)) {
      const { error } = await supabase
        .from('notification_log')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', row.user_id)
        .eq('type', row.type)
        .is('read_at', null)
      if (error) console.error('[push] 舊的未讀通知標為已讀失敗', error)
    }
  } catch (err) {
    console.error('[push] 舊的未讀通知標為已讀失敗', err)
  }

  try {
    const { error } = await supabase.from('notification_log').insert({ ...row, url })
    if (error) console.error('[push] 寫入通知紀錄失敗', error)
  } catch (err) {
    console.error('[push] 寫入通知紀錄失敗', err)
  }
}

/** 使用者是否關掉了這一類推播（沿用既有四個開關） */
function isTypeDisabled(
  type: string,
  prefs: Database['public']['Tables']['notification_preferences']['Row'] | null,
): boolean {
  if (!prefs) return false
  if (type === 'weekly_summary' && !prefs.weekly_summary_enabled) return true
  if (type === 'daily_reminder' && !prefs.daily_reminder_enabled) return true
  if (type === 'pre_event' && !prefs.pre_event_enabled) return true
  if (type === 'booking_status' && !prefs.booking_status_changes_enabled) return true
  return false
}

/**
 * 對使用者的所有裝置發送推播，並一定留下一筆站內紀錄。
 * 推播金鑰沒設定、使用者關掉這一類、沒有訂閱任何裝置時只是不推播（紀錄狀態為 skipped）。
 * 同一事件已發過（去重命中）則什麼都不做。
 * 回傳 { sent, failed, removed }；過期訂閱（410/404）會自動移除。
 */
export async function pushToUser(
  supabase: SupabaseClient<Database>,
  dispatch: NotificationDispatch,
): Promise<{ sent: number; failed: number; removed: number }> {
  // Dedup: check if a log row already exists
  if (dispatch.relatedId && dispatch.scheduledFor) {
    const { data: existing } = await supabase
      .from('notification_log')
      .select('id')
      .eq('user_id', dispatch.userId)
      .eq('type', dispatch.type)
      .eq('related_id', dispatch.relatedId)
      .eq('scheduled_for', dispatch.scheduledFor)
      .maybeSingle()
    if (existing) {
      return { sent: 0, failed: 0, removed: 0 }
    }
  }

  let sent = 0
  let failed = 0
  let removed = 0

  const canPush = await (async () => {
    if (!ensureConfigured()) return false

    // Check user's preferences (skip push if disabled for this type)
    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', dispatch.userId)
      .maybeSingle()
    return !isTypeDisabled(dispatch.type, prefs)
  })()

  if (canPush) {
    // Get subscriptions
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', dispatch.userId)

    const payloadJson = JSON.stringify(dispatch.payload)

    for (const sub of subs ?? []) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payloadJson,
        )
        sent++
        await supabase
          .from('push_subscriptions')
          .update({ last_used_at: new Date().toISOString() })
          .eq('id', sub.id)
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode
        if (statusCode === 410 || statusCode === 404) {
          // Subscription expired
          await supabase.from('push_subscriptions').delete().eq('id', sub.id)
          removed++
        } else {
          failed++
          console.error('[push] send failed', err)
        }
      }
    }
  }

  // Log it (one row per dispatch, not per subscription)
  await writeNotificationLog(supabase, {
    user_id: dispatch.userId,
    type: dispatch.type,
    related_id: dispatch.relatedId ?? null,
    scheduled_for: dispatch.scheduledFor ?? null,
    channel: 'web_push',
    status: sent > 0 ? 'sent' : failed > 0 ? 'failed' : 'skipped',
    title: dispatch.payload.title,
    body: dispatch.payload.body,
    url: dispatch.payload.url ?? null,
  })

  return { sent, failed, removed }
}

/**
 * 只留站內通知紀錄，不推播、不看偏好設定。失敗只記 log，不往外丟。
 */
export async function recordInAppNotification(
  supabase: SupabaseClient<Database>,
  input: {
    userId: string
    type: string
    title: string
    body: string
    url?: string | null
    relatedId?: string | null
  },
): Promise<void> {
  await writeNotificationLog(supabase, {
    user_id: input.userId,
    type: input.type,
    related_id: input.relatedId ?? null,
    channel: 'in_app',
    status: 'skipped',
    title: input.title,
    body: input.body,
    url: input.url ?? null,
  })
}
