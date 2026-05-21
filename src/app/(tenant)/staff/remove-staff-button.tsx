'use client'

import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import ConfirmDialog from '@/components/confirm-dialog'
import { removeStaffAction } from './actions'

export default function RemoveStaffButton({ memberId }: { memberId: string }) {
  const { execute, isPending } = useAction(removeStaffAction, {
    onSuccess: () => toast.success('已移除'),
    onError: ({ error }) => toast.error(error.serverError?.message ?? '移除失敗'),
  })
  return (
    <ConfirmDialog
      trigger={
        <Button size="sm" variant="outline" disabled={isPending}>
          {isPending ? '...' : '移除'}
        </Button>
      }
      title="移除這位助教？"
      description="移除後該助教無法再登入後台。歷史預約與時段紀錄保留。"
      confirmLabel="移除"
      variant="destructive"
      onConfirm={() => execute({ memberId })}
    />
  )
}
