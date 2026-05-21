'use client'

import { useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { inviteCoachAction } from './actions'

export default function InviteCoachForm() {
  const [email, setEmail] = useState('')
  const [tenantName, setTenantName] = useState('')
  const [tenantSlug, setTenantSlug] = useState('')
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)

  const { execute, isPending } = useAction(inviteCoachAction, {
    onSuccess: ({ data }) => {
      toast.success('已建立邀請')
      setInviteUrl(data?.inviteUrl ?? null)
      setEmail('')
      setTenantName('')
      setTenantSlug('')
    },
    onError: ({ error }) => {
      toast.error(error.serverError?.message ?? '邀請失敗')
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>邀請新教練</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            execute({ email, tenantName, tenantSlug })
          }}
        >
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">教練 Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenantName">租戶名稱</Label>
              <Input
                id="tenantName"
                required
                value={tenantName}
                onChange={(e) => setTenantName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenantSlug">Slug (公開連結)</Label>
              <Input
                id="tenantSlug"
                required
                placeholder="wang-coach"
                value={tenantSlug}
                onChange={(e) => setTenantSlug(e.target.value)}
              />
            </div>
          </div>
          <Button type="submit" disabled={isPending}>
            {isPending ? '邀請中...' : '送出邀請'}
          </Button>
        </form>
        {inviteUrl && (
          <div className="mt-4 rounded border bg-slate-50 p-3 text-sm">
            <p className="mb-1 font-semibold">邀請連結（請傳給教練）：</p>
            <code className="break-all">{inviteUrl}</code>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
