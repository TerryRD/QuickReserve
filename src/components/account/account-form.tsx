'use client'

import { useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  updateDisplayNameAction,
  updatePasswordAction,
  updateEmailAction,
} from './actions'

const inputClass = 'font-cjk h-11 rounded-xl border-2 border-border bg-background px-4 text-sm'

function Section({
  title,
  eng,
  hint,
  children,
}: {
  title: string
  eng: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        {eng}
      </div>
      <h2 className="font-display font-cjk mt-1 text-xl font-black uppercase">{title}</h2>
      {hint && <p className="font-cjk mt-1 text-sm text-muted-foreground">{hint}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  )
}

export default function AccountForm({
  initialName,
  email,
}: {
  initialName: string
  email: string
}) {
  // --- 姓名 ---
  const [fullName, setFullName] = useState(initialName)
  const nameAction = useAction(updateDisplayNameAction, {
    onSuccess: () => toast.success('姓名已更新'),
    onError: ({ error }) => toast.error(error.serverError?.message ?? '更新失敗'),
  })

  // --- 密碼 ---
  const [curPw, setCurPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const pwAction = useAction(updatePasswordAction, {
    onSuccess: () => {
      toast.success('密碼已更新')
      setCurPw('')
      setNewPw('')
    },
    onError: ({ error }) => toast.error(error.serverError?.message ?? '更新失敗'),
  })

  // --- Email ---
  const [emailPw, setEmailPw] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const emailAction = useAction(updateEmailAction, {
    onSuccess: ({ data }) => {
      toast.success(
        data?.newEmail
          ? `Email 已改為 ${data.newEmail}，下次請用新 email 登入`
          : 'Email 已更新，下次請用新 email 登入',
      )
      setEmailPw('')
      setNewEmail('')
    },
    onError: ({ error }) => toast.error(error.serverError?.message ?? '更新失敗'),
  })

  return (
    <div className="space-y-6">
      <div>
        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          ACCOUNT · 個人帳號
        </div>
        <h1 className="font-display font-cjk mt-1 text-3xl font-black uppercase">帳號設定</h1>
        <p className="font-cjk mt-1 text-sm text-muted-foreground">
          目前登入：<span className="font-medium text-foreground">{email}</span>
        </p>
      </div>

      <Section title="姓名" eng="NAME" hint="顯示在側欄/頂部，代表目前登入的你。">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            nameAction.execute({ fullName })
          }}
          className="space-y-3"
        >
          <Label htmlFor="fullName" className="font-mono text-[11px] uppercase tracking-wider">
            姓名
          </Label>
          <Input
            id="fullName"
            required
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={inputClass}
          />
          <Button type="submit" size="pill" disabled={nameAction.isPending || !fullName.trim()}>
            {nameAction.isPending ? '儲存中…' : '儲存姓名'}
          </Button>
        </form>
      </Section>

      <Section title="變更密碼" eng="PASSWORD" hint="需先輸入目前密碼以驗證身分。">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            pwAction.execute({ currentPassword: curPw, newPassword: newPw })
          }}
          className="space-y-3"
        >
          <Label htmlFor="curPw" className="font-mono text-[11px] uppercase tracking-wider">
            目前密碼
          </Label>
          <Input
            id="curPw"
            type="password"
            autoComplete="current-password"
            value={curPw}
            onChange={(e) => setCurPw(e.target.value)}
            className={inputClass}
          />
          <Label htmlFor="newPw" className="font-mono text-[11px] uppercase tracking-wider">
            新密碼（至少 6 字）
          </Label>
          <Input
            id="newPw"
            type="password"
            autoComplete="new-password"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            className={inputClass}
          />
          <Button
            type="submit"
            size="pill"
            disabled={pwAction.isPending || !curPw || newPw.length < 6}
          >
            {pwAction.isPending ? '更新中…' : '更新密碼'}
          </Button>
        </form>
      </Section>

      <Section
        title="變更 Email"
        eng="EMAIL"
        hint="email 是登入帳號。變更後即時生效，請改用新 email 登入。需先輸入目前密碼。"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            emailAction.execute({ currentPassword: emailPw, newEmail })
          }}
          className="space-y-3"
        >
          <Label htmlFor="emailPw" className="font-mono text-[11px] uppercase tracking-wider">
            目前密碼
          </Label>
          <Input
            id="emailPw"
            type="password"
            autoComplete="current-password"
            value={emailPw}
            onChange={(e) => setEmailPw(e.target.value)}
            className={inputClass}
          />
          <Label htmlFor="newEmail" className="font-mono text-[11px] uppercase tracking-wider">
            新 Email
          </Label>
          <Input
            id="newEmail"
            type="email"
            autoComplete="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className={inputClass}
          />
          <Button
            type="submit"
            size="pill"
            disabled={emailAction.isPending || !emailPw || !newEmail.trim()}
          >
            {emailAction.isPending ? '更新中…' : '更新 Email'}
          </Button>
        </form>
      </Section>
    </div>
  )
}
