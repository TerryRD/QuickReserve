'use client'

import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import ConfirmDialog from '@/components/confirm-dialog'
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
    <ConfirmDialog
      trigger={
        <Button size="sm" variant="outline" disabled={isPending}>
          {isPending ? '...' : '取消'}
        </Button>
      }
      title="確定要取消此預約嗎？"
      description="取消後該時段會釋出，且學員會收到通知（若啟用推播）。"
      confirmLabel="取消預約"
      variant="destructive"
      onConfirm={() => execute({ bookingId })}
    />
  )
}
