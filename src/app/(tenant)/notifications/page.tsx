import Link from 'next/link'
import { Settings } from 'lucide-react'
import { requireTenantMember } from '@/lib/auth/get-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { listInbox, type InboxItem } from '@/lib/notifications'
import { SectionHead } from '@/components/ui/section-head'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  NotificationList,
  NotificationLoadError,
} from '@/components/notifications/notification-list'
import MarkAllReadButton from '@/components/notifications/mark-all-read-button'

type TabKey = 'all' | 'bookings' | 'packages' | 'system'

const TABS: { key: TabKey; label: string; matcher: (type: string) => boolean }[] = [
  { key: 'all', label: '全部', matcher: () => true },
  { key: 'bookings', label: '預約', matcher: (t) => t.startsWith('booking_') },
  {
    key: 'packages',
    label: '購課',
    matcher: (t) => t.startsWith('package_') || t.startsWith('purchase_'),
  },
  {
    key: 'system',
    label: '系統',
    matcher: (t) =>
      !t.startsWith('booking_') && !t.startsWith('package_') && !t.startsWith('purchase_'),
  },
]

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: TabKey }>
}) {
  const { tab = 'all' } = await searchParams
  const session = await requireTenantMember()
  const supabase = await createSupabaseServerClient()

  let items: InboxItem[] | null = null
  try {
    items = await listInbox(supabase, session.userId)
  } catch (err) {
    // 讀不到時顯示讀取失敗，不可當成「沒有通知」
    console.error('[notifications] 通知讀取失敗', err)
  }

  const tabDef = TABS.find((t) => t.key === tab) ?? TABS[0]!
  // 未讀數以這 100 筆內的未讀計算
  const unreadCount = items ? items.filter((i) => i.readAt === null).length : 0

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionHead kicker="NOTIFICATIONS · 通知" title="通知" eng="INBOX" className="mb-0" />
        <div className="flex items-center gap-2">
          <MarkAllReadButton unreadCount={unreadCount} />
          <Link href="/settings/notifications">
            <Button variant="outline" size="sm">
              <Settings className="size-3.5" /> 推播偏好
            </Button>
          </Link>
        </div>
      </div>

      <div className="inline-flex rounded-full border border-border bg-card p-1">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={{ pathname: '/notifications', query: t.key === 'all' ? {} : { tab: t.key } }}
            aria-current={tab === t.key ? 'page' : undefined}
            className={cn(
              'inline-flex items-baseline gap-2 rounded-full px-4 py-1.5 transition',
              tab === t.key
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <span className="font-cjk text-sm">{t.label}</span>
          </Link>
        ))}
      </div>

      {items ? (
        <NotificationList items={items.filter((i) => tabDef.matcher(i.type))} />
      ) : (
        <NotificationLoadError />
      )}
    </div>
  )
}
