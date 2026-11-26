'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { actionClient } from '@/lib/safe-action'
import { requireSession } from '@/lib/auth/get-session'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server'
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

    // customer 的姓名另存在 customers.display_name（教練端清單顯示來源），保持同步。
    // 用 upsert：尚未預約過的客戶可能還沒有 customers 列。
    if (session.role === 'customer') {
      const { error: cErr } = await supabase
        .from('customers')
        .upsert({ id: session.userId, display_name: parsedInput.fullName }, { onConflict: 'id' })
      if (cErr) throw new AppError('PROFILE_UPDATE_FAILED', cErr.message)
    }

    // 教練／助教的姓名另存在 tenant_members.display_name（教練端預約清單、明細、歷程的成員名稱），
    // 這個使用者的所有成員列一併同步；不是成員時更新 0 列。本人更新自己的列由既有 RLS（tenant_members_update）允許。
    const { data: memberRows, error: mErr } = await supabase
      .from('tenant_members')
      .update({ display_name: parsedInput.fullName })
      .eq('user_id', session.userId)
      .select('id')
    // 目前登入中的成員列沒有被更新到（例如被權限擋下而回傳 0 列）也算失敗，不當作已同步
    const missedCurrentMember =
      !mErr && !!session.memberId && !(memberRows ?? []).some((m) => m.id === session.memberId)
    if (mErr || missedCurrentMember) {
      console.error('[account] 同步成員名稱失敗', mErr ?? { memberId: session.memberId })
      throw new AppError(
        'PROFILE_UPDATE_FAILED',
        '姓名已儲存，但教練後台顯示的名稱沒有更新成功，請再儲存一次',
      )
    }

    revalidatePath('/', 'layout')
    return { ok: true, fullName: parsedInput.fullName }
  })

const PasswordSchema = z
  .object({
    currentPassword: z.string().min(1, '請輸入目前密碼'),
    newPassword: z.string().min(6, '新密碼至少 6 個字').max(72, '新密碼過長（上限 72 字）'),
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

const EmailSchema = z.object({
  currentPassword: z.string().min(1, '請輸入目前密碼'),
  newEmail: z.string().trim().email('email 格式不正確'),
})

export const updateEmailAction = actionClient
  .inputSchema(EmailSchema)
  .action(async ({ parsedInput }) => {
    const session = await requireSession()
    if (!session.email) throw new AppError('EMAIL_UPDATE_FAILED', '帳號缺少 email')
    if (parsedInput.newEmail.toLowerCase() === session.email.toLowerCase()) {
      throw new AppError('EMAIL_UPDATE_FAILED', '新 email 與目前相同')
    }

    const ok = await verifyCurrentPassword(session.email, parsedInput.currentPassword)
    if (!ok) throw new AppError('INVALID_CURRENT_PASSWORD', '目前密碼不正確')

    // 無可靠寄信管道 → 用 service-role admin API 即時變更、不寄確認信
    const admin = createSupabaseAdminClient()
    const { error } = await admin.auth.admin.updateUserById(session.userId, {
      email: parsedInput.newEmail,
      email_confirm: true,
    })
    if (error) {
      const code = (error as { code?: string }).code ?? ''
      const msg = error.message.toLowerCase()
      if (
        code === 'email_exists' ||
        msg.includes('already') ||
        msg.includes('exists') ||
        msg.includes('registered')
      ) {
        throw new AppError('EMAIL_TAKEN', '此 email 已被使用')
      }
      throw new AppError('EMAIL_UPDATE_FAILED', error.message)
    }

    revalidatePath('/', 'layout')
    return { ok: true, newEmail: parsedInput.newEmail }
  })
