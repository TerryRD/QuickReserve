'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Check } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { PrimaryCta } from '@/components/ui/primary-cta'
import { SidePanel } from '../side-panel'
import { loginAction } from './actions'

const SIDE_LINES = [
  '登入後可購買套裝、預約時段、改期或取消預約。',
  '教練核可後會以 Email 與 Web Push 通知你。',
  '資料安全：密碼以 bcrypt 雜湊儲存、session 採 httpOnly cookie。',
]

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
    <div className="flex w-full flex-col gap-6 self-center sm:max-w-[480px]">
      {signedUp && (
        <div className="flex items-start gap-3 rounded-2xl bg-primary px-4 py-3 text-primary-foreground">
          <Check className="mt-0.5 size-4 shrink-0" />
          <div>
            <div className="font-cjk text-sm font-bold">註冊成功</div>
            <div className="font-cjk mt-0.5 text-xs opacity-90">請使用剛建立的帳號登入。</div>
          </div>
        </div>
      )}

      <div>
        <div className="font-mono mb-3 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          STEP 01 · LOGIN
        </div>
        <h1 className="font-display font-cjk text-[56px] font-normal uppercase leading-[0.95] tracking-tight">
          歡迎回來
        </h1>
        <p className="font-cjk mt-3.5 text-sm leading-relaxed text-muted-foreground">
          還沒有帳號？{' '}
          <Link
            href="/signup"
            className="font-semibold text-foreground underline-offset-4 hover:underline"
          >
            建立帳號
          </Link>
          {' · '}學員 / 教練共用同一個入口。
        </p>
      </div>

      <form
        className="flex flex-col gap-[18px]"
        onSubmit={(e) => {
          e.preventDefault()
          execute({ email, password, redirectTo })
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="email" className="font-cjk text-[13px] font-semibold">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="font-cjk h-12 rounded-xl border-[1.5px] border-border bg-background px-4 text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="font-cjk text-[13px] font-semibold">
            密碼
          </Label>
          <Input
            id="password"
            type="password"
            required
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="font-cjk h-12 rounded-xl border-[1.5px] border-border bg-background px-4 text-sm"
          />
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-3">
          <PrimaryCta type="submit" disabled={isPending} className="justify-between">
            {isPending ? '登入中...' : '登入'}
          </PrimaryCta>
          <Button
            type="button"
            variant="pill-outline"
            size="xl"
            render={
              <Link
                href={`/signup${redirectTo !== '/' ? `?redirect=${encodeURIComponent(redirectTo)}` : ''}`}
              />
            }
          >
            建立帳號
          </Button>
        </div>
        <div className="font-mono mt-1 text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground">
          登入即表示同意服務條款 · 隱私權政策
        </div>
      </form>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="grid flex-1 grid-cols-1 lg:grid-cols-2">
      <div className="flex w-full flex-col px-6 py-10 sm:px-12 sm:py-14 lg:px-[88px] lg:py-[72px]">
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
      <SidePanel title="登入　WELCOME BACK" lines={SIDE_LINES} />
    </div>
  )
}
