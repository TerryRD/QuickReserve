import { createSupabaseServerClient } from '@/lib/supabase/server'
import PushOptIn from '@/components/push-opt-in'
import PreferencesForm from '@/app/(customer)/account/notifications/preferences-form'

const DEFAULT_PREFS = {
  weekly_summary_enabled: true,
  daily_reminder_enabled: true,
  daily_reminder_hour: 7,
  pre_event_enabled: true,
  pre_event_minutes: [30],
  booking_status_changes_enabled: true,
}

export default async function NotificationPreferences({ userId }: { userId: string }) {
  const supabase = await createSupabaseServerClient()
  const { data: prefs } = await supabase
    .from('notification_preferences')
    .select(
      'weekly_summary_enabled, daily_reminder_enabled, daily_reminder_hour, pre_event_enabled, pre_event_minutes, booking_status_changes_enabled',
    )
    .eq('user_id', userId)
    .maybeSingle()

  return (
    <div className="space-y-6">
      <header>
        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">SETTINGS · 通知</div>
        <h1 className="font-display mt-2 text-3xl uppercase">
          通知<span className="font-cjk">設定</span>
        </h1>
      </header>
      <PushOptIn />
      <PreferencesForm initial={prefs ?? DEFAULT_PREFS} />
    </div>
  )
}
