'use client'

import { useAction } from 'next-safe-action/hooks'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { markAllNotificationsReadAction } from './actions'

export default function MarkAllReadButton({ unreadCount }: { unreadCount: number }) {
  const { execute, isPending } = useAction(markAllNotificationsReadAction)
  if (unreadCount === 0) return null
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() => execute({})}
    >
      <Check className="size-3.5" /> 全部標為已讀（{unreadCount}）
    </Button>
  )
}
