import { requireTenantMember } from '@/lib/auth/get-session'
import NotificationPreferences from '@/components/settings/notification-preferences'

export default async function TenantNotificationSettingsPage() {
  const session = await requireTenantMember()
  return <NotificationPreferences userId={session.userId} />
}
