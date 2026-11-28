'use client'

import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Trash2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import ConfirmDialog from '@/components/confirm-dialog'
import { softDeletePackageAction, restorePackageAction } from './actions'

export default function PackageActionsRow({ id, isActive }: { id: string; isActive: boolean }) {
  const del = useAction(softDeletePackageAction, {
    onSuccess: () => toast.success('已刪除'),
    onError: ({ error }) => toast.error(error.serverError?.message ?? '刪除失敗'),
  })
  const restore = useAction(restorePackageAction, {
    onSuccess: () => toast.success('已重新啟用'),
    onError: ({ error }) => toast.error(error.serverError?.message ?? '失敗'),
  })

  if (!isActive) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => restore.execute({ id })}
        disabled={restore.isPending}
      >
        <RotateCcw className="mr-1 h-3.5 w-3.5" />
        重新啟用
      </Button>
    )
  }

  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline" size="sm">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      }
      title="刪除這個 N 堂課？"
      description="刪除後學員端不再顯示。已核准的購買不受影響，學員仍可繼續使用剩餘堂數。可從「已刪除」分頁重新啟用。"
      confirmLabel="刪除"
      variant="destructive"
      onConfirm={() => del.execute({ id })}
    />
  )
}
