'use client'

import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Ban, Check } from 'lucide-react'
import { toggleCustomerBlockAction } from './actions'
import ConfirmDialog from '@/components/confirm-dialog'

export default function BlockButton({
  customerId,
  isBlocked,
}: {
  customerId: string
  isBlocked: boolean
}) {
  const { execute, isPending } = useAction(toggleCustomerBlockAction, {
    onSuccess: () => toast.success(isBlocked ? '已解除封鎖' : '已封鎖'),
    onError: ({ error }) => toast.error(error.serverError?.message ?? '失敗'),
  })

  if (isBlocked) {
    return (
      <button
        type="button"
        disabled={isPending}
        onClick={() => execute({ customerId, isBlocked: false })}
        className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-[10px] text-emerald-700 hover:bg-emerald-100"
      >
        <Check className="h-3 w-3" />
        解除封鎖
      </button>
    )
  }

  return (
    <ConfirmDialog
      trigger={
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Ban className="h-3 w-3" />
          封鎖
        </button>
      }
      title="封鎖此學員？"
      description="封鎖後，該學員將無法在您的公開頁建立新預約。既有預約不受影響。"
      confirmLabel="封鎖"
      variant="destructive"
      onConfirm={() => execute({ customerId, isBlocked: true })}
    />
  )
}
