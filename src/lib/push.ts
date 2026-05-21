import webpush from 'web-push'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

let configured = false

function ensureConfigured() {
  if (configured) return
  const subject = process.env.VAPID_SUBJECT
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!subject || !publicKey || !privateKey) {
    throw new Error('VAPID env vars missing')
  }
  webpush.setVapidDetails(subject, publicKey, privateKey)
  configured = true
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

/**
 * Send a Web Push to all of a user's subscriptions.
 * Returns { sent, failed, removed }. Expired subscriptions (410) are auto-removed.
 */
export async function pushToUser(
  supabase: SupabaseClient<Database>,
  dispatch: NotificationDispatch,
): Promise<{ sent: number; failed: number; removed: number }> {
  ensureConfigured()

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

  // Check user's preferences (skip if disabled for this type)
  const { data: prefs } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', dispatch.userId)
    .maybeSingle()
  if (prefs) {
    if (dispatch.type === 'weekly_summary' && !prefs.weekly_summary_enabled) {
      return { sent: 0, failed: 0, removed: 0 }
    }
    if (dispatch.type === 'daily_reminder' && !prefs.daily_reminder_enabled) {
      return { sent: 0, failed: 0, removed: 0 }
    }
    if (dispatch.type === 'pre_event' && !prefs.pre_event_enabled) {
      return { sent: 0, failed: 0, removed: 0 }
    }
    if (dispatch.type === 'booking_status' && !prefs.booking_status_changes_enabled) {
      return { sent: 0, failed: 0, removed: 0 }
    }
  }

  // Get subscriptions
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', dispatch.userId)
  if (!subs || subs.length === 0) return { sent: 0, failed: 0, removed: 0 }

  let sent = 0
  let failed = 0
  let removed = 0

  const payloadJson = JSON.stringify(dispatch.payload)

  for (const sub of subs) {
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

  // Log it (one row per dispatch, not per subscription)
  await supabase.from('notification_log').insert({
    user_id: dispatch.userId,
    type: dispatch.type,
    related_id: dispatch.relatedId ?? null,
    scheduled_for: dispatch.scheduledFor ?? null,
    channel: 'web_push',
    status: sent > 0 ? 'sent' : failed > 0 ? 'failed' : 'skipped',
  })

  return { sent, failed, removed }
}
