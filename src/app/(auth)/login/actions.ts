'use server'

import { z } from 'zod'
import { redirect } from 'next/navigation'
import { actionClient } from '@/lib/safe-action'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AppError } from '@/lib/errors'

const LoginSchema = z.object({
  email: z.string().email('Email 格式不正確'),
  password: z.string().min(6, '密碼至少 6 個字'),
  redirectTo: z.string().optional(),
})

export const loginAction = actionClient.inputSchema(LoginSchema).action(async ({ parsedInput }) => {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: parsedInput.email,
    password: parsedInput.password,
  })
  if (error) throw new AppError('AUTH_FAILED', '帳號或密碼錯誤')
  redirect(parsedInput.redirectTo || '/')
})
