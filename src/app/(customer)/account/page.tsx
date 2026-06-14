import { requireSession } from '@/lib/auth/get-session'
import AccountForm from '@/components/account/account-form'

export default async function CustomerAccountPage() {
  const session = await requireSession()
  return (
    <div className="max-w-2xl">
      <AccountForm initialName={session.displayName ?? ''} email={session.email ?? ''} />
    </div>
  )
}
