import { requireSession } from '@/lib/auth/get-session'
import NotificationPreferences from '@/components/settings/notification-preferences'

export default async function CustomerNotificationSettingsPage() {
  const session = await requireSession()
  return <NotificationPreferences userId={session.userId} />
}
