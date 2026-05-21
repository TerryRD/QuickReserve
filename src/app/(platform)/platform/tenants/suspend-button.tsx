'use client'

import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
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
    <Button
      size="sm"
      variant={currentStatus === 'active' ? 'outline' : 'default'}
      disabled={isPending}
      onClick={() => {
        if (confirm(`確定要將此租戶設為「${label}」嗎？`))
          execute({ tenantId, status: target })
      }}
    >
      {isPending ? '...' : label}
    </Button>
  )
}
