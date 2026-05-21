'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">登入帳號</h1>
        <p className="mt-2 text-sm text-muted-foreground">輸入您的帳號密碼以繼續</p>
      </div>

      {signedUp && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          ✓ 註冊成功，請使用該帳號登入
        </div>
      )}

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          execute({ email, password, redirectTo })
        }}
      >
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
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={isPending} className="w-full" size="lg">
          {isPending ? '登入中...' : '登入'}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        還沒有帳號？{' '}
        <Link href="/signup" className="font-medium text-primary hover:underline">
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
