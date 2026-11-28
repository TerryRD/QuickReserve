import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import { AppError } from '@/lib/errors'

// 只給伺服器端用（讀取站內通知）。前端元件請只用 `import type { InboxItem }`。

export type InboxItem = {
  id: string
  type: string
  /** 舊紀錄為 null */
  title: string | null
  body: string | null
  url: string | null
  sentAt: string
  readAt: string | null
}

/** 通知清單一次最多顯示幾筆 */
const INBOX_LIMIT = 100

/**
 * 最新 limit 筆（預設 100，新到舊）。查詢失敗丟 AppError，不回空陣列冒充「沒有通知」。
 */
export async function listInbox(
  supabase: SupabaseClient<Database>,
  userId: string,
  limit: number = INBOX_LIMIT,
): Promise<InboxItem[]> {
  const { data, error } = await supabase
    .from('notification_log')
    .select('id, type, title, body, url, sent_at, read_at')
    .eq('user_id', userId)
    .order('sent_at', { ascending: false })
    .limit(limit)
  if (error || !data) {
    throw new AppError('INBOX_LOAD_FAILED', '通知讀取失敗，請稍後再試', error ?? undefined)
  }
  return data.map((row) => ({
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    url: row.url,
    sentAt: row.sent_at,
    readAt: row.read_at,
  }))
}

/** 未讀數。查詢失敗回 null（並 console.error），不回 0。 */
export async function countUnread(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<number | null> {
  const { count, error } = await supabase
    .from('notification_log')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null)
  if (error || count === null) {
    console.error('[notifications] 未讀數查詢失敗', error)
    return null
  }
  return count
}
