'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@/components/ui/popover'
import { RECENT_NOTIFICATION_LIMIT } from '@/lib/notification-events'
// 只引入型別：編譯後會被移除，不會把伺服器端的讀取程式打包進前端
import type { InboxItem } from '@/lib/notifications'
import { listRecentAction } from './actions'
import { NotificationLoadError, NotificationRow } from './notification-list'
import { BellGlyph, bellAriaLabel, bellButtonClassName } from './unread-badge'

type RecentState = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; items: InboxItem[] }

/**
 * 頁首鈴鐺＋小視窗：點鈴鐺跳出最近 5 則通知，最下面「看全部通知」前往 href。
 * - 最近的通知在打開時才讀，每次打開都重讀；打開本身不會把任何通知標為已讀，點其中一則才標。
 * - 鈴鐺外觀、徽章、按鈕名稱與 NotificationBell 共用 unread-badge。
 */
export function NotificationPopover({ href, unread }: { href: string; unread: number | null }) {
  const [open, setOpen] = useState(false)
  const [recent, setRecent] = useState<RecentState>({ kind: 'loading' })
  // 快速連續開關時，只採用最後一次讀取的結果
  const requestSeq = useRef(0)

  const load = async () => {
    const seq = ++requestSeq.current
    setRecent({ kind: 'loading' })
    let next: RecentState
    try {
      const result = await listRecentAction()
      const data = result?.data
      next = data?.ok
        ? { kind: 'ready', items: data.items.slice(0, RECENT_NOTIFICATION_LIMIT) }
        : { kind: 'error' }
    } catch (err) {
      console.error('[notifications] 最近通知讀取失敗', err)
      next = { kind: 'error' }
    }
    if (seq === requestSeq.current) setRecent(next)
  }

  const close = () => setOpen(false)

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (nextOpen) void load()
      }}
    >
      <PopoverTrigger aria-label={bellAriaLabel(unread)} className={bellButtonClassName}>
        <BellGlyph unread={unread} />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(20rem,calc(100vw-2rem))] gap-3 p-3">
        <PopoverTitle>最近的通知</PopoverTitle>
        <RecentBody state={recent} onActivate={close} />
        <Link
          href={href}
          onClick={close}
          className="font-cjk block rounded-lg px-2 py-1.5 text-center text-sm font-medium hover:bg-muted"
        >
          看全部通知
        </Link>
      </PopoverContent>
    </Popover>
  )
}

function RecentBody({ state, onActivate }: { state: RecentState; onActivate: () => void }) {
  if (state.kind === 'loading') {
    return <p className="font-cjk py-4 text-center text-sm text-muted-foreground">讀取中…</p>
  }
  if (state.kind === 'error') {
    return <NotificationLoadError className="p-3" />
  }
  if (state.items.length === 0) {
    return <p className="font-cjk py-4 text-center text-sm text-muted-foreground">沒有通知</p>
  }
  return (
    <ul className="space-y-2">
      {state.items.map((item) => (
        <li key={item.id}>
          <NotificationRow item={item} compact onActivate={onActivate} />
        </li>
      ))}
    </ul>
  )
}
