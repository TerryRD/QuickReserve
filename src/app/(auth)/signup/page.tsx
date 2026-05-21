'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { signupAction } from './actions'

export default function SignupPage() {
  const params = useSearchParams()
  const inviteToken = params.get('invite')
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
    <Card>
      <CardHeader>
        <CardTitle>建立帳號</CardTitle>
      </CardHeader>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          execute({ email, password, displayName, inviteToken: inviteToken ?? undefined })
        }}
      >
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="displayName">姓名</Label>
            <Input
              id="displayName"
              required
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Link href="/login" className="text-sm text-blue-600 hover:underline">
            已有帳號？登入
          </Link>
          <Button type="submit" disabled={isPending}>
            {isPending ? '建立中...' : '註冊'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
