'use client'

import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { checkinBookingAction } from '@/app/book/[slotId]/actions'

export default function CheckinButton({ bookingId }: { bookingId: string }) {
  const { execute, isPending } = useAction(checkinBookingAction, {
    onSuccess: () => toast.success('簽到成功'),
    onError: ({ error }) => toast.error(error.serverError?.message ?? '簽到失敗'),
  })
  return (
    <Button size="sm" disabled={isPending} onClick={() => execute({ bookingId })}>
      {isPending ? '簽到中...' : '簽到'}
    </Button>
  )
}
