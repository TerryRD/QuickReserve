import Link from 'next/link'
import { Settings } from 'lucide-react'
import { requireSession } from '@/lib/auth/get-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { listInbox, type InboxItem } from '@/lib/notifications'
import { SectionHead } from '@/components/ui/section-head'
import { Button } from '@/components/ui/button'
import {
  NotificationList,
  NotificationLoadError,
} from '@/components/notifications/notification-list'
import MarkAllReadButton from '@/components/notifications/mark-all-read-button'

// 學員的站內通知清單（網址不用 /notifications：那是教練端的通知頁）
export default async function MyNotificationsPage() {
  const session = await requireSession()
  const supabase = await createSupabaseServerClient()

  let items: InboxItem[] | null = null
  try {
    items = await listInbox(supabase, session.userId)
  } catch (err) {
    // 讀不到時顯示讀取失敗，不可當成「沒有通知」
    console.error('[my-notifications] 通知讀取失敗', err)
  }
  const unreadCount = items ? items.filter((i) => i.readAt === null).length : 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <SectionHead kicker="NOTIFICATIONS · 通知" title="通知" className="mb-0" />
        <div className="flex flex-wrap items-center gap-2">
          <MarkAllReadButton unreadCount={unreadCount} />
          <Button variant="outline" size="sm" render={<Link href="/account/notifications" />}>
            <Settings className="size-3.5" /> 推播偏好
          </Button>
        </div>
      </div>

      {items ? <NotificationList items={items} /> : <NotificationLoadError />}
    </div>
  )
}
