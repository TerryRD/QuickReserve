'use client'

import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import CancelReasonDialog from '@/components/bookings/cancel-reason-dialog'
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

// 待確認的預約叫「拒絕」，已確認的叫「取消」（示意圖 M2）
const CANCEL_COPY = {
  pending: {
    button: '拒絕',
    title: '確定要拒絕此預約嗎？',
    description: '拒絕後會退回學員 1 堂，這個時段會重新開放。學員會收到通知，並看到你填的原因。',
    reasonLabel: '拒絕原因',
    confirmLabel: '拒絕預約',
    success: '已拒絕預約',
    failure: '拒絕失敗，請稍後再試',
  },
  confirmed: {
    button: '取消',
    title: '確定要取消此預約嗎？',
    description: '取消後會退回學員 1 堂，這個時段會重新開放。學員會收到通知，並看到你填的原因。',
    reasonLabel: '取消原因',
    confirmLabel: '取消預約',
    success: '已取消預約',
    failure: '取消失敗，請稍後再試',
  },
} as const

export function CancelButton({
  bookingId,
  bookingStatus,
}: {
  bookingId: string
  bookingStatus: 'pending' | 'confirmed'
}) {
  const copy = CANCEL_COPY[bookingStatus]
  const { executeAsync, isPending } = useAction(cancelBookingByTenantAction, {
    onSuccess: () => toast.success(copy.success),
    onError: ({ error }) =>
      toast.error(
        error.serverError?.message ??
          (error.validationErrors ? `請確認${copy.reasonLabel}後再送出` : copy.failure),
      ),
  })

  return (
    <CancelReasonDialog
      trigger={
        <Button size="sm" variant="outline" disabled={isPending}>
          {isPending ? '...' : copy.button}
        </Button>
      }
      title={copy.title}
      description={copy.description}
      reasonLabel={copy.reasonLabel}
      confirmLabel={copy.confirmLabel}
      isPending={isPending}
      onConfirm={async (reason) => {
        const result = await executeAsync({ bookingId, reason })
        // 失敗時保持對話框開啟、保留已填的原因，讓使用者看到錯誤後可以重試或返回
        return !!result?.data && !result.serverError && !result.validationErrors
      }}
    />
  )
}

/** 清單與明細頁共用的操作按鈕：待確認 →「確認」「拒絕」；已確認 →「取消」 */
export function BookingActionButtons({
  bookingId,
  bookingStatus,
}: {
  bookingId: string
  bookingStatus: 'pending' | 'confirmed'
}) {
  return (
    <>
      {bookingStatus === 'pending' && <ConfirmButton bookingId={bookingId} />}
      <CancelButton bookingId={bookingId} bookingStatus={bookingStatus} />
    </>
  )
}
