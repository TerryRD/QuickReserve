import { requireSession } from '@/lib/auth/get-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import PushOptIn from '@/components/push-opt-in'
import PreferencesForm from './preferences-form'

export default async function NotificationSettingsPage() {
  const session = await requireSession()
  const supabase = await createSupabaseServerClient()
  const { data: prefs } = await supabase
    .from('notification_preferences')
    .select(
      'weekly_summary_enabled, daily_reminder_enabled, daily_reminder_hour, pre_event_enabled, pre_event_minutes, booking_status_changes_enabled',
    )
    .eq('user_id', session.userId)
    .maybeSingle()

  const initial = prefs ?? {
    weekly_summary_enabled: true,
    daily_reminder_enabled: true,
    daily_reminder_hour: 7,
    pre_event_enabled: true,
    pre_event_minutes: [30],
    booking_status_changes_enabled: true,
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">通知設定</h1>
      <PushOptIn />
      <PreferencesForm initial={initial} />
    </div>
  )
}
