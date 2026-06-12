// src/app/(tenant)/settings/notifications/actions.ts
'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { actionClient } from '@/lib/safe-action'
import { requireSession, requireTenantOwner } from '@/lib/auth/get-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AppError } from '@/lib/errors'

const TimeOrNull = z
  .string()
  .regex(/^\d{2}:\d{2}(:\d{2})?$/, '時間格式錯誤 (HH:MM)')
  .nullable()

const SavePrefsSchema = z.object({
  channels: z.record(z.string(), z.record(z.string(), z.boolean())),
  quiet_hours_start: TimeOrNull,
  quiet_hours_end: TimeOrNull,
})

export const saveNotificationPrefsAction = actionClient
  .inputSchema(SavePrefsSchema)
  .action(async ({ parsedInput }) => {
    const session = await requireSession()
    const supabase = await createSupabaseServerClient()

    // Either both start/end set, or both null
    const bothSet =
      parsedInput.quiet_hours_start !== null && parsedInput.quiet_hours_end !== null
    const bothNull =
      parsedInput.quiet_hours_start === null && parsedInput.quiet_hours_end === null
    if (!bothSet && !bothNull) {
      throw new AppError(
        'QUIET_HOURS_INVALID',
        '勿擾時段的開始與結束必須同時設定或同時清空',
      )
    }

    const { error } = await supabase.from('notification_preferences').upsert(
      {
        user_id: session.userId,
        channels: parsedInput.channels,
        quiet_hours_start: parsedInput.quiet_hours_start,
        quiet_hours_end: parsedInput.quiet_hours_end,
      },
      { onConflict: 'user_id' },
    )
    if (error) throw new AppError('PREFS_UPDATE_FAILED', error.message)

    revalidatePath('/settings/notifications')
    return { ok: true }
  })

const RemoveDeviceSchema = z.object({
  id: z.string().uuid(),
})

const UpdateCheckinReminderSchema = z.object({
  // null = disabled; otherwise minutes-before-start (1..180, matches the DB CHECK constraint)
  minutes: z.number().int().min(1).max(180).nullable(),
})

export const updateCheckinReminderAction = actionClient
  .inputSchema(UpdateCheckinReminderSchema)
  .action(async ({ parsedInput }) => {
    const session = await requireTenantOwner()
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase
      .from('tenants')
      .update({ checkin_reminder_minutes: parsedInput.minutes })
      .eq('id', session.tenantId)
    if (error) throw new AppError('CHECKIN_REMINDER_UPDATE_FAILED', error.message)
    revalidatePath('/settings/notifications')
    return { ok: true }
  })

export const removePushDeviceAction = actionClient
  .inputSchema(RemoveDeviceSchema)
  .action(async ({ parsedInput }) => {
    const session = await requireSession()
    const supabase = await createSupabaseServerClient()

    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('id', parsedInput.id)
      .eq('user_id', session.userId)
    if (error) throw new AppError('PUSH_DEVICE_REMOVE_FAILED', error.message)

    revalidatePath('/settings/notifications')
    return { ok: true }
  })
