'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { signupAction } from './actions'

function SignupForm() {
  const params = useSearchParams()
  const inviteToken = params.get('invite')
  const redirectTo = params.get('redirect')
  const presetEmail = params.get('email') ?? ''
  const [email, setEmail] = useState(presetEmail)
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')

  const { execute, isPending } = useAction(signupAction, {
    onError: ({ error }) => {
      toast.error(error.serverError?.message ?? '註冊失敗')
    },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl tracking-tight">
          <span className="italic">建立</span>帳號
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {inviteToken ? '完成註冊後將自動接受邀請' : '註冊後即可預約教練的課程'}
        </p>
      </div>

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          execute({
              email,
              password,
              displayName,
              inviteToken: inviteToken ?? undefined,
              redirectTo: redirectTo ?? undefined,
            })
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="displayName">姓名</Label>
          <Input
            id="displayName"
            required
            placeholder="您的名字"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">密碼</Label>
          <Input
            id="password"
            type="password"
            required
            minLength={8}
            placeholder="至少 8 個字元"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={isPending} className="w-full" size="lg">
          {isPending ? '建立中...' : '建立帳號'}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        已有帳號？{' '}
        <Link href="/login" className="font-medium text-primary hover:underline">
          登入
        </Link>
      </p>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  )
}
