'use server'

import { z } from 'zod'
import { redirect } from 'next/navigation'
import { actionClient } from '@/lib/safe-action'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AppError } from '@/lib/errors'

const SignupSchema = z.object({
  email: z.string().email('Email 格式不正確'),
  password: z.string().min(8, '密碼至少 8 個字'),
  displayName: z.string().min(1, '請輸入姓名').max(50),
  inviteToken: z.string().optional(),
  redirectTo: z.string().optional(),
})

function safePath(path: string | undefined | null): string {
  if (!path) return '/'
  // Must be an internal absolute path. Block:
  //   - protocol-relative URLs (//evil.com)
  //   - backslash bypass (/\evil.com → browsers normalize to //evil.com)
  if (!path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) return '/'
  return path
}

export const signupAction = actionClient.inputSchema(SignupSchema).action(async ({ parsedInput }) => {
  const supabase = await createSupabaseServerClient()
  const { error, data } = await supabase.auth.signUp({
    email: parsedInput.email,
    password: parsedInput.password,
    options: {
      data: { display_name: parsedInput.displayName },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/callback`,
    },
  })
  if (error) throw new AppError('SIGNUP_FAILED', error.message)
  if (!data.user) throw new AppError('SIGNUP_FAILED', '註冊失敗')

  await supabase.from('customers').upsert({
    id: data.user.id,
    display_name: parsedInput.displayName,
  })

  // Invite token branch — keep existing flow (login → invite)
  if (parsedInput.inviteToken) {
    redirect(`/login?redirect=/invite/${parsedInput.inviteToken}`)
  }

  const target = safePath(parsedInput.redirectTo)

  // If Supabase auto-signed-in (no email confirmation required), redirect to target directly
  if (data.session) {
    redirect(target)
  }

  // Otherwise show login with signedup banner + carry redirect through
  redirect(`/login?signedup=1&redirect=${encodeURIComponent(target)}`)
})
