'use client'

import { useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import FormFieldErrors from '@/components/forms/form-field-errors'
import { inviteStaffAction } from './actions'

export default function InviteStaffForm() {
  const [email, setEmail] = useState('')
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const { execute, isPending, result } = useAction(inviteStaffAction, {
    onSuccess: ({ data }) => {
      toast.success('已建立邀請')
      setInviteUrl(data?.inviteUrl ?? null)
      setEmail('')
    },
    onError: ({ error }) => {
      if (error.serverError?.message) toast.error(error.serverError.message)
    },
  })

  const fieldErrors = result?.validationErrors as Record<string, { _errors?: string[] }> | undefined

  return (
    <Card>
      <CardHeader>
        <CardTitle>邀請新助教</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="flex items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            execute({ email })
          }}
        >
          <div className="flex-1 space-y-2">
            <Label htmlFor="staff-email">助教 Email</Label>
            <Input
              id="staff-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <FormFieldErrors errors={fieldErrors} field="email" />
          </div>
          <Button type="submit" disabled={isPending}>
            {isPending ? '邀請中...' : '送出邀請'}
          </Button>
        </form>
        {inviteUrl && (
          <div className="mt-4 rounded border bg-slate-50 p-3 text-sm">
            <p className="mb-1 font-semibold">邀請連結（請傳給助教）：</p>
            <code className="break-all">{inviteUrl}</code>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
