import { requireTenantMember } from '@/lib/auth/get-session'
import AccountForm from '@/components/account/account-form'

export default async function TenantAccountPage() {
  const session = await requireTenantMember()
  return (
    <div className="max-w-2xl">
      <AccountForm initialName={session.displayName ?? ''} email={session.email ?? ''} />
    </div>
  )
}
