'use client'

import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cancelBookingByTenantAction, confirmBookingAction } from './actions'

export function ConfirmButton({ bookingId }: { bookingId: string }) {
  const { execute, isPending } = useAction(confirmBookingAction, {
    onSuccess: () => toast.success('已確認'),
    onError: ({ error }) => toast.error(error.serverError?.message ?? '確認失敗'),
  })
  return (
    <Button size="sm" disabled={isPending} onClick={() => execute({ bookingId })}>
      {isPending ? '...' : '確認'}
    </Button>
  )
}

export function CancelButton({ bookingId }: { bookingId: string }) {
  const { execute, isPending } = useAction(cancelBookingByTenantAction, {
    onSuccess: () => toast.success('已取消'),
    onError: ({ error }) => toast.error(error.serverError?.message ?? '取消失敗'),
  })
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={isPending}
      onClick={() => {
        if (confirm('確定要取消此預約嗎？')) execute({ bookingId })
      }}
    >
      {isPending ? '...' : '取消'}
    </Button>
  )
}
