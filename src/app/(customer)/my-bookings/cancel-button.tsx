'use client'

import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import ConfirmDialog from '@/components/confirm-dialog'
import { cancelMyBookingAction } from '@/app/book/[slotId]/actions'

export default function CancelMyBookingButton({
  bookingId,
  willRefund,
}: {
  bookingId: string
  willRefund: boolean
}) {
  const { execute, isPending } = useAction(cancelMyBookingAction, {
    onSuccess: () => toast.success(willRefund ? '已取消預約，已退還堂數' : '已取消預約（未退還堂數）'),
    onError: ({ error }) => toast.error(error.serverError?.message ?? '取消失敗'),
  })

  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline" size="sm" disabled={isPending}>
          {isPending ? '取消中...' : '取消預約'}
        </Button>
      }
      title="確定要取消此預約嗎？"
      description={
        willRefund
          ? '取消後該時段會釋出，其他學員可重新預約，並退還此堂課數。'
          : '⚠️ 已超過免費取消期限，取消將不退還此堂課數，仍要取消嗎？'
      }
      confirmLabel="取消預約"
      variant="destructive"
      onConfirm={() => execute({ bookingId })}
    />
  )
}
