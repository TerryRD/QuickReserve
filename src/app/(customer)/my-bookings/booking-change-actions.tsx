import Link from 'next/link'
import { Calendar } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { willCustomerCancelRefund } from '@/lib/cancel-deadline'
import CancelMyBookingButton from './cancel-button'

/** 「改期」與「取消預約」按鈕。我的預約卡片與預約明細頁共用，確保兩處行為相同。 */
export default function BookingChangeActions({
  bookingId,
  status,
  tenantSlug,
  serviceId,
  startAt,
  cancelDeadlineAt,
  cancelDeadlineHours,
  cancelReasons,
}: {
  bookingId: string
  status: string
  tenantSlug: string | null
  serviceId: string | null
  startAt: string | null
  cancelDeadlineAt: string | null
  cancelDeadlineHours: number | null
  cancelReasons: string[] | null
}) {
  return (
    <>
      {tenantSlug && serviceId && (
        <Link
          href={`/${tenantSlug}?service=${serviceId}&reschedule=${bookingId}`}
          className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }))}
        >
          <Calendar className="size-3" /> 改期
        </Link>
      )}
      {cancelReasons ? (
        <CancelMyBookingButton
          bookingId={bookingId}
          presetReasons={cancelReasons}
          willRefund={
            !!startAt &&
            cancelDeadlineHours != null &&
            willCustomerCancelRefund(new Date(), {
              status,
              cancelDeadlineAt,
              startAt,
              deadlineHours: cancelDeadlineHours,
            })
          }
        />
      ) : (
        // 讀不到取消原因清單時不讓學員取消，也不以寫死的清單頂替（B6.9）
        <span className="font-cjk text-xs text-muted-foreground">目前無法取消，請稍後再試</span>
      )}
    </>
  )
}
