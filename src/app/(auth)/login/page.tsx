'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PrimaryCta } from '@/components/ui/primary-cta'
import { loginAction } from './actions'

function LoginForm() {
  const params = useSearchParams()
  const redirectTo = params.get('redirect') ?? '/'
  const signedUp = params.get('signedup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const { execute, isPending } = useAction(loginAction, {
    onError: ({ error }) => {
      toast.error(error.serverError?.message ?? '登入失敗')
    },
  })

  return (
    <div className="rounded-2xl border border-border bg-card p-8 shadow-[0_1px_0_var(--border),0_8px_24px_-18px_rgba(0,0,0,0.18)]">
      <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        SIGN IN
      </div>
      <h2 className="font-display mb-6 text-3xl uppercase leading-none tracking-tight">
        歡迎<span className="font-cjk">回來</span>
      </h2>

      {signedUp && (
        <div className="mb-6 rounded-xl bg-accent px-4 py-3 font-cjk text-sm text-accent-foreground">
          ✓ 註冊成功，請使用該帳號登入
        </div>
      )}

      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault()
          execute({ email, password, redirectTo })
        }}
      >
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
            className="font-cjk h-12 rounded-xl border-2 border-border bg-background px-4 text-sm"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <PrimaryCta type="submit" disabled={isPending} className="w-full justify-between">
          {isPending ? '登入中...' : '登入'}
        </PrimaryCta>
      </form>

      <p className="mt-8 border-t border-border pt-6 text-center font-cjk text-sm text-muted-foreground">
        還沒有帳號？{' '}
        <Link href="/signup" className="font-semibold text-foreground underline-offset-4 hover:underline">
          建立帳號
        </Link>
      </p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
