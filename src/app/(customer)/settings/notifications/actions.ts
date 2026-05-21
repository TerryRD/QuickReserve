'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { actionClient } from '@/lib/safe-action'
import { requireSession } from '@/lib/auth/get-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AppError } from '@/lib/errors'

const PreferenceSchema = z.object({
  weeklySummary: z.boolean(),
  dailyReminder: z.boolean(),
  dailyReminderHour: z.coerce.number().int().min(0).max(23),
  preEventEnabled: z.boolean(),
  preEventMinutes: z.array(z.coerce.number().int().positive()).max(5),
  bookingStatusChanges: z.boolean(),
})

export const updateNotificationPreferencesAction = actionClient
  .inputSchema(PreferenceSchema)
  .action(async ({ parsedInput }) => {
    const session = await requireSession()
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase.from('notification_preferences').upsert(
      {
        user_id: session.userId,
        weekly_summary_enabled: parsedInput.weeklySummary,
        daily_reminder_enabled: parsedInput.dailyReminder,
        daily_reminder_hour: parsedInput.dailyReminderHour,
        pre_event_enabled: parsedInput.preEventEnabled,
        pre_event_minutes: parsedInput.preEventMinutes,
        booking_status_changes_enabled: parsedInput.bookingStatusChanges,
      },
      { onConflict: 'user_id' },
    )
    if (error) throw new AppError('PREFS_UPDATE_FAILED', error.message)
    revalidatePath('/settings/notifications')
    return { ok: true }
  })
