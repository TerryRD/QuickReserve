'use client'

import { type ReactNode, useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { markNotificationReadAction } from './actions'

// Unread row → button that fires the mark-read action on click (with optimistic
// fade). Read row → static div. Layout is identical between the two; only the
// element type changes.

export default function NotificationItem({
  id,
  isUnread,
  className,
  children,
}: {
  id: string
  isUnread: boolean
  className?: string
  children: ReactNode
}) {
  const [optimisticRead, setOptimisticRead] = useState(false)
  const { execute, isPending } = useAction(markNotificationReadAction)
  const stillUnread = isUnread && !optimisticRead

  if (!stillUnread) {
    return <div className={className}>{children}</div>
  }

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        setOptimisticRead(true)
        execute({ id })
      }}
      className={className}
      aria-label="標為已讀"
    >
      {children}
    </button>
  )
}
