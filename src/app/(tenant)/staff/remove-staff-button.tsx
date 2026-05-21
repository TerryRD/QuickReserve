'use client'

import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { removeStaffAction } from './actions'

export default function RemoveStaffButton({ memberId }: { memberId: string }) {
  const { execute, isPending } = useAction(removeStaffAction, {
    onSuccess: () => toast.success('已移除'),
    onError: ({ error }) => toast.error(error.serverError?.message ?? '移除失敗'),
  })
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={isPending}
      onClick={() => {
        if (confirm('確定要移除這位助教嗎？')) execute({ memberId })
      }}
    >
      {isPending ? '...' : '移除'}
    </Button>
  )
}
