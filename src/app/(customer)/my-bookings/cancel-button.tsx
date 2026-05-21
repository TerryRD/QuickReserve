'use client'

import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import ConfirmDialog from '@/components/confirm-dialog'
import { cancelMyBookingAction } from '@/app/book/[slotId]/actions'

export default function CancelMyBookingButton({ bookingId }: { bookingId: string }) {
  const { execute, isPending } = useAction(cancelMyBookingAction, {
    onSuccess: () => toast.success('已取消預約'),
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
      description="取消後該時段會釋出，其他學員可重新預約。"
      confirmLabel="取消預約"
      variant="destructive"
      onConfirm={() => execute({ bookingId })}
    />
  )
}
