'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { actionClient } from '@/lib/safe-action'
import { requireSession } from '@/lib/auth/get-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AppError } from '@/lib/errors'
import { listInbox, type InboxItem } from '@/lib/notifications'
import { RECENT_NOTIFICATION_LIMIT } from '@/lib/notification-events'

const MarkReadSchema = z.object({ id: z.string().uuid() })

export const markNotificationReadAction = actionClient
  .inputSchema(MarkReadSchema)
  .action(async ({ parsedInput }) => {
    const session = await requireSession()
    const supabase = await createSupabaseServerClient()

    // RLS policy (20260529120000) already gates USING + WITH CHECK on
    // user_id = auth.uid(); the explicit user_id filter is belt-and-suspenders
    // in case the policy is ever loosened.
    const { error } = await supabase
      .from('notification_log')
      .update({ read_at: new Date().toISOString() })
      .eq('id', parsedInput.id)
      .eq('user_id', session.userId)
      .is('read_at', null)
    if (error) throw new AppError('MARK_READ_FAILED', error.message)

    revalidatePath('/', 'layout')
    return { ok: true }
  })

export const markAllNotificationsReadAction = actionClient
  .inputSchema(z.object({}))
  .action(async () => {
    const session = await requireSession()
    const supabase = await createSupabaseServerClient()

    const { error } = await supabase
      .from('notification_log')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', session.userId)
      .is('read_at', null)
    if (error) throw new AppError('MARK_ALL_READ_FAILED', error.message)

    revalidatePath('/', 'layout')
    return { ok: true }
  })

/**
 * 頁首小視窗用：登入者自己最近 5 則通知（新到舊）。只讀，不會標為已讀。
 * 讀取失敗回 { ok: false } 並記錄錯誤——畫面據此顯示讀取失敗，不可當成「沒有通知」。
 */
export const listRecentAction = actionClient.action(
  async (): Promise<{ ok: true; items: InboxItem[] } | { ok: false }> => {
    try {
      const session = await requireSession()
      const supabase = await createSupabaseServerClient()
      const items = await listInbox(supabase, session.userId, RECENT_NOTIFICATION_LIMIT)
      return { ok: true, items }
    } catch (err) {
      console.error('[notifications] 最近通知讀取失敗', err)
      return { ok: false }
    }
  },
)
