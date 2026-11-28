import { actorRoleLabel, classDispositionText, type Viewer } from '@/lib/booking-terms'
import type { TimelineEntry } from '@/lib/activity-log'
import { formatTaipeiMonthDayTime } from '@/lib/taipei-time'

/** 第一行：發生了什麼事（不含操作人，操作人放第二行） */
export function describeTimelineEvent(entry: Pick<TimelineEntry, 'event' | 'detail'>): string {
  const detail = entry.detail
  switch (entry.event) {
    case 'booking.created':
      return detail.purchase_id ? '建立預約，使用 1 堂' : '建立預約'
    case 'booking.rescheduled_in':
      return '由改期建立預約'
    case 'booking.confirmed':
      return '預約已確認'
    case 'booking.cancelled': {
      const action =
        detail.category === 'coach_rejected'
          ? '拒絕預約'
          : detail.category === 'under_min'
            ? '人數不足，取消預約'
            : '取消預約'
      if (detail.disposition === 'refunded' && detail.class_returned !== false)
        return `${action}，${classDispositionText('refunded')}`
      if (detail.disposition === 'forfeited')
        return `${action}，${classDispositionText('forfeited')}`
      return action
    }
    case 'booking.rescheduled_out':
      return '改期到新的時段'
    case 'booking.checked_in':
      return '已簽到'
    case 'booking.no_show':
      return '課程結束未簽到，標為未出席'
    case 'slot.closed':
      return '時段因人數不足關閉'
    default:
      return '其他紀錄'
  }
}

/** 第二行的操作人：學員端只分「你／教練／系統」；教練端有名稱時寫「名稱（身分）」 */
export function timelineActorLabel(
  entry: Pick<TimelineEntry, 'actorRole' | 'actorName'>,
  viewer: Viewer,
): string {
  if (viewer === 'customer') {
    return entry.actorRole === 'customer' ? '你' : actorRoleLabel(entry.actorRole, 'customer')
  }
  const role = actorRoleLabel(entry.actorRole, 'tenant')
  if (entry.actorRole === 'system' || !entry.actorName) return role
  return `${entry.actorName}（${role}）`
}

/** 一筆預約的歷程列表（學員端與教練端共用）。entries 依時間由舊到新傳入，畫面上新的在上。 */
export function BookingTimeline({
  entries,
  viewer,
  emptyHint = '尚無紀錄',
}: {
  entries: TimelineEntry[]
  viewer: Viewer
  emptyHint?: string
}) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyHint}</p>
  }

  return (
    <ol className="flex flex-col">
      {[...entries].reverse().map((entry) => {
        const actor = timelineActorLabel(entry, viewer)
        return (
          <li
            key={entry.id}
            className="grid grid-cols-[5.5rem_1fr] gap-3 border-t py-2 text-sm first:border-t-0"
          >
            <time
              dateTime={entry.createdAt}
              className="pt-0.5 font-mono text-xs tabular-nums text-muted-foreground"
            >
              {formatTaipeiMonthDayTime(entry.createdAt)}
            </time>
            <div className="min-w-0">
              <div>{describeTimelineEvent(entry)}</div>
              <div className="break-words text-xs text-muted-foreground">
                {entry.reason ? `${actor} · 原因：${entry.reason}` : actor}
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
