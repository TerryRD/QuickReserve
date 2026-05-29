import Link from 'next/link'
import { format, formatDistanceToNow } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { Bell, Settings } from 'lucide-react'
import { requireTenantMember } from '@/lib/auth/get-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { SectionHead } from '@/components/ui/section-head'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import NotificationItem from './notification-item'
import MarkAllReadButton from './mark-all-read-button'

type TabKey = 'all' | 'bookings' | 'packages' | 'system'

const TABS: { key: TabKey; label: string; eng: string; matcher: (type: string) => boolean }[] = [
  { key: 'all', label: '全部', eng: 'ALL', matcher: () => true },
  { key: 'bookings', label: '預約', eng: 'BOOKINGS', matcher: t => t.startsWith('booking_') },
  { key: 'packages', label: '套裝', eng: 'PACKAGES', matcher: t => t.startsWith('package_') || t.startsWith('purchase_') },
  {
    key: 'system',
    label: '系統',
    eng: 'SYSTEM',
    matcher: t => !t.startsWith('booking_') && !t.startsWith('package_') && !t.startsWith('purchase_'),
  },
]

// Best-effort label mapping. Falls back to raw type for anything not listed.
const TYPE_LABEL: Record<string, string> = {
  booking_status: '預約狀態更新',
  booking_created: '新預約',
  booking_confirmed: '預約已確認',
  booking_cancelled: '預約取消',
  booking_rescheduled: '預約改期',
  package_request: '套裝申請',
  package_approved: '套裝核准',
  purchase_request: '套裝購買申請',
  pre_event: '即將開始提醒',
  daily_reminder: '每日提醒',
  weekly_summary: '每週摘要',
  recovery: '帳號回復',
}

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: TabKey }>
}) {
  const { tab = 'all' } = await searchParams
  const session = await requireTenantMember()
  const supabase = await createSupabaseServerClient()

  const { data: logs } = await supabase
    .from('notification_log')
    .select('id, type, related_id, channel, status, sent_at, read_at, error_message')
    .eq('user_id', session.userId)
    .order('sent_at', { ascending: false })
    .limit(100)

  const tabDef = TABS.find(t => t.key === tab) ?? TABS[0]!
  const filtered = (logs ?? []).filter(l => tabDef.matcher(l.type))
  const unreadCount = (logs ?? []).filter(l => l.read_at === null).length

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionHead
          kicker="NOTIFICATIONS · 通知"
          title="通知"
          eng="INBOX"
          className="mb-0"
        />
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
        {TABS.map(t => (
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
            <span className="font-mono text-[10px] tracking-[0.15em] opacity-70">{t.eng}</span>
          </Link>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Bell className="size-5" />}
          title="沒有通知"
          hint="新事件發生時會出現在這裡"
        />
      ) : (
        <div className="space-y-2">
          {filtered.map(l => {
            const ts = new Date(l.sent_at)
            const isUnread = l.read_at === null
            const label = TYPE_LABEL[l.type] ?? l.type
            return (
              <NotificationItem
                key={l.id}
                id={l.id}
                isUnread={isUnread}
                className={cn(
                  'relative flex w-full items-center gap-3 rounded-2xl border bg-card p-4 text-left',
                  isUnread
                    ? 'border-border pl-5 before:absolute before:top-3 before:bottom-3 before:left-0 before:w-1 before:rounded-r-full before:bg-accent before:content-[""] hover:bg-muted/40'
                    : 'border-border opacity-70',
                )}
              >
                <Bell
                  className={cn(
                    'size-4 shrink-0',
                    isUnread ? 'text-foreground' : 'text-muted-foreground',
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div
                    className={cn(
                      'font-cjk text-sm',
                      isUnread ? 'font-semibold' : 'font-normal text-muted-foreground',
                    )}
                  >
                    {label}
                  </div>
                  <div className="font-mono mt-0.5 text-xs text-muted-foreground">
                    {l.channel} · {l.status} ·{' '}
                    {formatDistanceToNow(ts, { addSuffix: true, locale: zhTW })}
                  </div>
                  {l.error_message && (
                    <div className="font-cjk mt-1 text-xs text-destructive">{l.error_message}</div>
                  )}
                </div>
                <time className="font-mono text-[10px] text-muted-foreground shrink-0">
                  {format(ts, 'M/d HH:mm')}
                </time>
              </NotificationItem>
            )
          })}
        </div>
      )}
    </div>
  )
}
