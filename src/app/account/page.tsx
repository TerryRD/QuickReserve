import { requireSession } from '@/lib/auth/get-session'
import AccountForm from './account-form'

export default async function AccountPage() {
  const session = await requireSession()
  return (
    <AccountForm initialName={session.displayName ?? ''} email={session.email ?? ''} />
  )
}
