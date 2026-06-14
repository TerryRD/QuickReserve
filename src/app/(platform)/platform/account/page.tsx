import { requirePlatformAdmin } from '@/lib/auth/get-session'
import AccountForm from '@/components/account/account-form'

export default async function PlatformAccountPage() {
  const session = await requirePlatformAdmin()
  return (
    <div className="max-w-2xl">
      <AccountForm initialName={session.displayName ?? ''} email={session.email ?? ''} />
    </div>
  )
}
