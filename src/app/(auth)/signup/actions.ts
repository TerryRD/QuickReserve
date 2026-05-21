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
})

export const signupAction = actionClient
  .inputSchema(SignupSchema)
  .action(async ({ parsedInput }) => {
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

    // Create customer profile (idempotent via on-conflict)
    await supabase.from('customers').upsert({
      id: data.user.id,
      display_name: parsedInput.displayName,
    })

    // If we have an invite token, redirect to login → invite page
    if (parsedInput.inviteToken) {
      redirect(`/login?redirect=/invite/${parsedInput.inviteToken}`)
    }
    redirect('/login?signedup=1')
  })
