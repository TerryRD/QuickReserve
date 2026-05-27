'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Kicker } from '@/components/ui/kicker'
import { SidePanel } from '../side-panel'
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
    <div className="flex w-full flex-col gap-6 self-center sm:max-w-[480px]">
      {inviteToken && (
        // TODO(src/app/(auth)/signup/page.tsx:34): Fetch tenant_name via a new
        // public-by-token endpoint (e.g. /api/invite/resolve?token=...) and
        // render "您被 {tenant_name} 邀請加入". Currently this is a client
        // component so the admin lookup in /invite/[token]/page.tsx is not
        // reusable here without a new server endpoint.
        <div className="rounded-2xl border border-accent bg-accent/30 p-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-foreground">
            INVITED ·
          </div>
          <div className="font-cjk mt-1 text-sm text-foreground">
            您正在接受教練邀請，完成註冊後將自動接受邀請、可立即購買該教練的套裝。
          </div>
        </div>
      )}

      <div>
        <Kicker className="mb-3 text-[11px] tracking-[0.2em]">STEP 01 · SIGN UP</Kicker>
        <h1 className="font-display font-cjk text-[56px] font-normal uppercase leading-[0.95] tracking-tight">
          建立帳號
        </h1>
        <p className="font-cjk mt-3.5 text-sm leading-relaxed text-muted-foreground">
          已有帳號？{' '}
          <Link
            href="/login"
            className="font-semibold text-foreground underline-offset-4 hover:underline"
          >
            登入
          </Link>
        </p>
      </div>

      <form
        className="flex flex-col gap-[18px]"
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
          <Label htmlFor="displayName" className="font-cjk text-[13px] font-semibold">
            姓名
          </Label>
          <Input
            id="displayName"
            required
            placeholder="王小明"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="font-cjk h-12 rounded-xl border-[1.5px] border-border bg-background px-4 text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className="font-cjk text-[13px] font-semibold">
            Email
          </Label>
          <p className="font-cjk text-[11.5px] text-muted-foreground">教練會以此 Email 寄送預約通知</p>
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
          <p className="font-cjk text-[11.5px] text-muted-foreground">至少 8 個字元、包含英文與數字</p>
          <Input
            id="password"
            type="password"
            required
            minLength={8}
            placeholder="至少 8 個字元"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="font-cjk h-12 rounded-xl border-[1.5px] border-border bg-background px-4 text-sm"
          />
        </div>

        <div className="mt-1">
          <Button
            type="submit"
            variant="default"
            size="pill"
            withArrow="inline"
            disabled={isPending}
          >
            {isPending ? '建立中...' : inviteToken ? '建立帳號並接受邀請' : '建立帳號'}
          </Button>
        </div>
        <div className="font-mono mt-1 text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">
          建立帳號即同意服務條款與隱私權政策
        </div>
      </form>
    </div>
  )
}

export default function SignupPage() {
  return (
    <div className="grid flex-1 grid-cols-1 lg:grid-cols-2">
      <div className="flex w-full flex-col px-6 py-10 sm:px-12 sm:py-14 lg:px-[88px] lg:py-[72px]">
        <Suspense fallback={null}>
          <SignupForm />
        </Suspense>
      </div>
      <SidePanel
        title="建立帳號　JOIN"
        lines={[
          '免費註冊，第一次預約教練前必需。',
          '註冊後可在不同教練之間共用同一個帳號。',
          '若是被教練邀請、請使用邀請信件裡的連結。',
        ]}
      />
    </div>
  )
}
