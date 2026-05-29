'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { actionClient } from '@/lib/safe-action'
import { requireSession } from '@/lib/auth/get-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AppError } from '@/lib/errors'

const MarkReadSchema = z.object({ id: z.string().uuid() })

export const markNotificationReadAction = actionClient
  .inputSchema(MarkReadSchema)
  .action(async ({ parsedInput }) => {
    const session = await requireSession()
    const supabase = await createSupabaseServerClient()

    // RLS policy (20260529120000) already gates USING + WITH CHECK on
    // user_id = auth.uid(); the explicit user_id filter is belt-and-suspenders
    // in case the policy is ever loosened.
    const { error } = await supabase
      .from('notification_log')
      .update({ read_at: new Date().toISOString() })
      .eq('id', parsedInput.id)
      .eq('user_id', session.userId)
      .is('read_at', null)
    if (error) throw new AppError('MARK_READ_FAILED', error.message)

    revalidatePath('/notifications')
    return { ok: true }
  })

export const markAllNotificationsReadAction = actionClient
  .inputSchema(z.object({}))
  .action(async () => {
    const session = await requireSession()
    const supabase = await createSupabaseServerClient()

    const { error } = await supabase
      .from('notification_log')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', session.userId)
      .is('read_at', null)
    if (error) throw new AppError('MARK_ALL_READ_FAILED', error.message)

    revalidatePath('/notifications')
    return { ok: true }
  })
