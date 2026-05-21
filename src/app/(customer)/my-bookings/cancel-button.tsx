'use client'

import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cancelMyBookingAction } from '@/app/book/[slotId]/actions'

export default function CancelMyBookingButton({ bookingId }: { bookingId: string }) {
  const { execute, isPending } = useAction(cancelMyBookingAction, {
    onSuccess: () => toast.success('已取消預約'),
    onError: ({ error }) => toast.error(error.serverError?.message ?? '取消失敗'),
  })

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() => {
        if (confirm('確定要取消此預約嗎？')) execute({ bookingId })
      }}
    >
      {isPending ? '取消中...' : '取消預約'}
    </Button>
  )
}
