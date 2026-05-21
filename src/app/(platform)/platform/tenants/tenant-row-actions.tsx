'use client'

import { useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { MoreHorizontal, Mail, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { reinviteOwnerAction, resetCoachPasswordAction } from './reinvite-actions'

export function TenantRowActions({
  memberId,
  isInvitedPending,
  hasUserId,
}: {
  memberId: string
  isInvitedPending: boolean
  hasUserId: boolean
}) {
  const [open, setOpen] = useState(false)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [resultLabel, setResultLabel] = useState<string | null>(null)

  const reinvite = useAction(reinviteOwnerAction, {
    onSuccess: ({ data }) => {
      setResultUrl(data?.inviteUrl ?? null)
      setResultLabel('新的邀請連結（傳給教練）')
      toast.success('已重新產生邀請')
    },
    onError: ({ error }) => toast.error(error.serverError?.message ?? '失敗'),
  })

  const resetPwd = useAction(resetCoachPasswordAction, {
    onSuccess: ({ data }) => {
      setResultUrl(data?.resetUrl ?? null)
      setResultLabel(`密碼重設連結（${data?.email}）`)
      toast.success('已產生密碼重設連結')
    },
    onError: ({ error }) => toast.error(error.serverError?.message ?? '失敗'),
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) {
          setResultUrl(null)
          setResultLabel(null)
        }
      }}
    >
      <DialogTrigger
        render={
          <Button variant="ghost" size="sm">
            <MoreHorizontal className="h-3.5 w-3.5" />
          </Button>
        }
      />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>租戶操作</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {isInvitedPending && (
            <Button
              variant="outline"
              className="w-full justify-start"
              disabled={reinvite.isPending}
              onClick={() => reinvite.execute({ memberId })}
            >
              <Mail className="mr-2 h-4 w-4" />
              {reinvite.isPending ? '產生中...' : '重新產生邀請連結（7 天有效）'}
            </Button>
          )}
          {hasUserId && (
            <Button
              variant="outline"
              className="w-full justify-start"
              disabled={resetPwd.isPending}
              onClick={() => resetPwd.execute({ memberId })}
            >
              <KeyRound className="mr-2 h-4 w-4" />
              {resetPwd.isPending ? '產生中...' : '產生密碼重設連結'}
            </Button>
          )}
          {!isInvitedPending && !hasUserId && (
            <p className="text-sm text-muted-foreground">無可用操作</p>
          )}

          {resultUrl && (
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="mb-2 text-xs font-semibold">{resultLabel}：</p>
              <code className="block break-all text-xs">{resultUrl}</code>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={() => setOpen(false)} variant="outline">
            關閉
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
