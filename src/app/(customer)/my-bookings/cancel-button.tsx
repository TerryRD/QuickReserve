'use client'

import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import CancelReasonDialog from '@/components/bookings/cancel-reason-dialog'
import { cancelMyBookingAction } from '@/app/book/[slotId]/actions'

export default function CancelMyBookingButton({
  bookingId,
  willRefund,
  presetReasons,
}: {
  bookingId: string
  willRefund: boolean
  presetReasons: string[]
}) {
  const { executeAsync, isPending } = useAction(cancelMyBookingAction, {
    onSuccess: ({ data }) => {
      const disposition = data?.classDisposition
      toast.success(
        disposition === 'refunded'
          ? '已取消預約，已退回 1 堂'
          : disposition === 'forfeited'
            ? '已取消預約（不退回）'
            : '已取消預約',
      )
    },
    onError: ({ error }) =>
      toast.error(
        error.serverError?.message ??
          (error.validationErrors ? '請確認取消原因後再送出' : '取消失敗，請稍後再試'),
      ),
  })

  return (
    <CancelReasonDialog
      trigger={
        <Button variant="outline" size="sm" disabled={isPending}>
          {isPending ? '取消中...' : '取消預約'}
        </Button>
      }
      title="確定要取消此預約嗎？"
      description={
        willRefund ? (
          '取消後這個時段會開放給其他學員預約，並退回 1 堂。'
        ) : (
          <span className="text-destructive">
            已超過取消期限，現在取消不會退回這 1 堂。仍要取消嗎？
          </span>
        )
      }
      presetReasons={presetReasons}
      reasonLabel="取消原因"
      footnote="教練會看到你選的原因。"
      confirmLabel="取消預約"
      isPending={isPending}
      onConfirm={async (reason) => {
        const result = await executeAsync({ bookingId, reason })
        // 失敗時保持對話框開啟，讓學員看到錯誤後可以重試或返回
        return !!result?.data && !result.serverError && !result.validationErrors
      }}
    />
  )
}
