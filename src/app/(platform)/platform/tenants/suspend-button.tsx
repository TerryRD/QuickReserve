'use client'

import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import ConfirmDialog from '@/components/confirm-dialog'
import { setTenantStatusAction } from './suspend-actions'

export default function SuspendButton({
  tenantId,
  currentStatus,
}: {
  tenantId: string
  currentStatus: 'active' | 'suspended'
}) {
  const target = currentStatus === 'active' ? 'suspended' : 'active'
  const label = currentStatus === 'active' ? '暫停' : '啟用'
  const { execute, isPending } = useAction(setTenantStatusAction, {
    onSuccess: () => toast.success(`已${label}`),
    onError: ({ error }) => toast.error(error.serverError?.message ?? '失敗'),
  })

  return (
    <ConfirmDialog
      trigger={
        <Button
          size="sm"
          variant={currentStatus === 'active' ? 'outline' : 'default'}
          disabled={isPending}
        >
          {isPending ? '...' : label}
        </Button>
      }
      title={`確定要將此租戶設為「${label}」嗎？`}
      description={
        currentStatus === 'active'
          ? '租戶被暫停後，其公開預約頁將顯示「服務暫停中」，學員無法建立新預約。'
          : '啟用後租戶將恢復正常運作。'
      }
      confirmLabel={label}
      variant={currentStatus === 'active' ? 'destructive' : 'default'}
      onConfirm={() => execute({ tenantId, status: target })}
    />
  )
}
