'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { actionClient } from '@/lib/safe-action'
import { requireSession } from '@/lib/auth/get-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { verifyCurrentPassword } from '@/lib/auth/verify-password'
import { AppError } from '@/lib/errors'

const DisplayNameSchema = z.object({
  fullName: z.string().trim().min(1, '請填姓名').max(60),
})

export const updateDisplayNameAction = actionClient
  .inputSchema(DisplayNameSchema)
  .action(async ({ parsedInput }) => {
    const session = await requireSession()
    const supabase = await createSupabaseServerClient()

    const { error } = await supabase.auth.updateUser({
      data: { full_name: parsedInput.fullName },
    })
    if (error) throw new AppError('PROFILE_UPDATE_FAILED', error.message)

    // customer 的姓名另存在 customers.display_name（教練端清單顯示來源），保持同步
    if (session.role === 'customer') {
      const { error: cErr } = await supabase
        .from('customers')
        .update({ display_name: parsedInput.fullName })
        .eq('id', session.userId)
      if (cErr) throw new AppError('PROFILE_UPDATE_FAILED', cErr.message)
    }

    revalidatePath('/account')
    return { ok: true, fullName: parsedInput.fullName }
  })

const PasswordSchema = z
  .object({
    currentPassword: z.string().min(1, '請輸入目前密碼'),
    newPassword: z.string().min(6, '新密碼至少 6 個字'),
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ['newPassword'],
    message: '新密碼不可與目前密碼相同',
  })

export const updatePasswordAction = actionClient
  .inputSchema(PasswordSchema)
  .action(async ({ parsedInput }) => {
    const session = await requireSession()
    if (!session.email) throw new AppError('PASSWORD_UPDATE_FAILED', '帳號缺少 email')

    const ok = await verifyCurrentPassword(session.email, parsedInput.currentPassword)
    if (!ok) throw new AppError('INVALID_CURRENT_PASSWORD', '目前密碼不正確')

    const supabase = await createSupabaseServerClient()
    const { error } = await supabase.auth.updateUser({ password: parsedInput.newPassword })
    if (error) throw new AppError('PASSWORD_UPDATE_FAILED', error.message)

    return { ok: true }
  })
