'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAction } from 'next-safe-action/hooks'
import { formatDistanceToNow } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { Bell } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'
import { notificationLabel, toInAppUrl } from '@/lib/notification-events'
import { formatTaipeiShortMonthDayTime } from '@/lib/taipei-time'
// 只引入型別：編譯後會被移除，不會把伺服器端的讀取程式打包進前端
import type { InboxItem } from '@/lib/notifications'
import { markNotificationReadAction } from './actions'

/** 距今多久以內顯示相對時間（例：5 分鐘前）；超過顯示台灣時間的月日時分 */
export const RELATIVE_TIME_WINDOW_MS = 3 * 60 * 60 * 1000

/** 讀不到通知時給使用者看的文字（不可顯示成「沒有通知」） */
export const INBOX_LOAD_ERROR_TEXT = '目前無法取得通知，請稍後再試'

/** 通知的時間文字：距 now 不到 3 小時用相對時間，否則用台灣時間「M/d HH:mm」 */
export function formatNotificationTime(sentAt: string, now: number): string {
  const sent = new Date(sentAt).getTime()
  if (now - sent < RELATIVE_TIME_WINDOW_MS) {
    return formatDistanceToNow(sent, { addSuffix: true, locale: zhTW })
  }
  return formatTaipeiShortMonthDayTime(sentAt)
}

/** 站內通知清單。點未讀的一則會標為已讀；有連結的會前往該頁。 */
export function NotificationList({ items }: { items: InboxItem[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Bell className="size-5" />}
        title="沒有通知"
        hint="新事件發生時會出現在這裡"
      />
    )
  }
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.id}>
          <NotificationRow item={item} />
        </li>
      ))}
    </ul>
  )
}

/** 讀不到通知時的訊息（通知頁與頁首小視窗共用） */
export function NotificationLoadError({ className }: { className?: string }) {
  return (
    <p
      role="alert"
      className={cn(
        'font-cjk rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive',
        className,
      )}
    >
      {INBOX_LOAD_ERROR_TEXT}
    </p>
  )
}

/**
 * 通知的一列（清單與頁首小視窗共用）。
 * - compact：小視窗用，內文只留一行、時間一律在內文下面
 * - onActivate：點了之後要做的事（例如關閉小視窗）
 */
export function NotificationRow({
  item,
  compact = false,
  onActivate,
}: {
  item: InboxItem
  compact?: boolean
  onActivate?: () => void
}) {
  const [optimisticRead, setOptimisticRead] = useState(false)
  const { execute, isPending } = useAction(markNotificationReadAction)
  const isUnread = item.readAt === null && !optimisticRead
  // 前端再檢查一次：不是站內路徑就當作沒有連結
  const href = toInAppUrl(item.url)
  const title = item.title ?? notificationLabel(item.type)

  const activate = () => {
    if (isUnread) {
      setOptimisticRead(true)
      execute({ id: item.id })
    }
    onActivate?.()
  }

  // 沿用教練端通知頁的列樣式：未讀左側色條、已讀淡化
  const className = cn(
    'relative flex w-full items-start gap-3 rounded-2xl border bg-card text-left',
    compact ? 'p-3' : 'p-4',
    isUnread
      ? 'border-border pl-5 before:absolute before:top-3 before:bottom-3 before:left-0 before:w-1 before:rounded-r-full before:bg-accent before:content-[""] hover:bg-muted/40'
      : 'border-border opacity-70',
    href && !isUnread && 'hover:opacity-100',
  )

  const content = (
    <>
      <Bell
        aria-hidden
        className={cn(
          'mt-0.5 size-4 shrink-0',
          isUnread ? 'text-foreground' : 'text-muted-foreground',
        )}
      />
      {/* 手機寬度（與小視窗）時間在內文下面；電腦寬度在右側 */}
      <div
        className={cn(
          'flex min-w-0 flex-1 flex-col gap-1',
          !compact && 'sm:flex-row sm:items-start sm:gap-3',
        )}
      >
        <div className="min-w-0 flex-1">
          <div
            className={cn(
              'font-cjk text-sm',
              isUnread ? 'font-semibold' : 'font-normal text-muted-foreground',
            )}
          >
            {title}
          </div>
          {item.body && (
            <p
              className={cn('font-cjk mt-0.5 text-sm text-muted-foreground', compact && 'truncate')}
            >
              {item.body}
            </p>
          )}
        </div>
        <NotificationTime sentAt={item.sentAt} />
      </div>
    </>
  )

  if (href) {
    return (
      <Link href={href} onClick={activate} className={className} data-unread={isUnread}>
        {content}
      </Link>
    )
  }

  if (isUnread) {
    return (
      <button
        type="button"
        disabled={isPending}
        onClick={activate}
        className={className}
        data-unread={isUnread}
      >
        {content}
      </button>
    )
  }

  return (
    <div className={className} data-unread={isUnread}>
      {content}
    </div>
  )
}

/**
 * 時間文字。「距今多久」在伺服器與瀏覽器算出來會不同，直接算會造成 hydration 不一致，
 * 所以第一次畫面（伺服器與 hydration）一律顯示台灣時間的月日時分，掛載後再依瀏覽器的現在時間決定是否改成相對時間。
 */
function NotificationTime({ sentAt }: { sentAt: string }) {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => setNow(Date.now()), [])
  const text =
    now === null ? formatTaipeiShortMonthDayTime(sentAt) : formatNotificationTime(sentAt, now)
  return (
    <time dateTime={sentAt} className="font-mono shrink-0 text-[10px] text-muted-foreground">
      {text}
    </time>
  )
}
