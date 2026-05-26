'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PrimaryCta } from '@/components/ui/primary-cta'
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
    <div className="rounded-2xl border border-border bg-card p-8 shadow-[0_1px_0_var(--border),0_8px_24px_-18px_rgba(0,0,0,0.18)]">
      <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        CREATE ACCOUNT
      </div>
      <h2 className="font-display mb-2 text-3xl uppercase leading-none tracking-tight">
        建立<span className="font-cjk">帳號</span>
      </h2>
      <p className="font-cjk mb-6 text-sm text-muted-foreground">
        {inviteToken ? '完成註冊後將自動接受邀請' : '註冊後即可預約教練的課程'}
      </p>

      <form
        className="space-y-5"
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
          <Label htmlFor="displayName" className="font-mono text-[11px] uppercase tracking-wider">
            姓名 NAME
          </Label>
          <Input
            id="displayName"
            required
            className="font-cjk h-12 rounded-xl border-2 border-border bg-background px-4 text-sm"
            placeholder="您的名字"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email" className="font-mono text-[11px] uppercase tracking-wider">
            EMAIL
          </Label>
          <Input
            id="email"
            type="email"
            required
            className="font-cjk h-12 rounded-xl border-2 border-border bg-background px-4 text-sm"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password" className="font-mono text-[11px] uppercase tracking-wider">
            PASSWORD
          </Label>
          <Input
            id="password"
            type="password"
            required
            minLength={8}
            className="font-cjk h-12 rounded-xl border-2 border-border bg-background px-4 text-sm"
            placeholder="至少 8 個字元"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <PrimaryCta type="submit" disabled={isPending} className="w-full justify-between">
          {isPending ? '建立中...' : '建立帳號'}
        </PrimaryCta>
      </form>

      <p className="mt-8 border-t border-border pt-6 text-center font-cjk text-sm text-muted-foreground">
        已有帳號？{' '}
        <Link href="/login" className="font-semibold text-foreground underline-offset-4 hover:underline">
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
