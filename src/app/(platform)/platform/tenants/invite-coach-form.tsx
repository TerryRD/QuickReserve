'use client'

import { useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import FormFieldErrors from '@/components/forms/form-field-errors'
import { normalizeSlug } from '@/lib/utils/slug'
import { inviteCoachAction } from './actions'

export default function InviteCoachForm() {
  const [email, setEmail] = useState('')
  const [tenantName, setTenantName] = useState('')
  const [tenantSlug, setTenantSlug] = useState('')
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)

  const { execute, isPending, result } = useAction(inviteCoachAction, {
    onSuccess: ({ data }) => {
      toast.success('已建立邀請')
      setInviteUrl(data?.inviteUrl ?? null)
      setEmail('')
      setTenantName('')
      setTenantSlug('')
    },
    onError: ({ error }) => {
      // Field-level errors render via FormFieldErrors; only show a toast for
      // server errors (e.g. SLUG_TAKEN) which next-safe-action surfaces via serverError.
      if (error.serverError?.message) toast.error(error.serverError.message)
    },
  })

  const fieldErrors = result?.validationErrors as
    | Record<string, { _errors?: string[] }>
    | undefined

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
              <FormFieldErrors errors={fieldErrors} field="email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenantName">租戶名稱</Label>
              <Input
                id="tenantName"
                required
                value={tenantName}
                onChange={(e) => setTenantName(e.target.value)}
              />
              <FormFieldErrors errors={fieldErrors} field="tenantName" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenantSlug">Slug (公開連結)</Label>
              <Input
                id="tenantSlug"
                required
                placeholder="terry-coach"
                value={tenantSlug}
                onChange={(e) => setTenantSlug(normalizeSlug(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                公開連結網址，只能小寫英數和短橫線。例：<code>terry-coach</code>
              </p>
              <FormFieldErrors errors={fieldErrors} field="tenantSlug" />
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
