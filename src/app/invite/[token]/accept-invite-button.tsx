'use client'

import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { acceptInviteAction } from './actions'

export default function AcceptInviteButton({ token }: { token: string }) {
  const { execute, isPending } = useAction(acceptInviteAction, {
    onError: ({ error }) => {
      toast.error(error.serverError?.message ?? '接受邀請失敗')
    },
  })

  return (
    <Button onClick={() => execute({ token })} disabled={isPending}>
      {isPending ? '處理中...' : '接受邀請'}
    </Button>
  )
}
