import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/get-session'
import { buttonVariants } from '@/components/ui/button'

export default async function HomePage() {
  const session = await getSession()
  if (session) {
    if (session.role === 'platform_admin') redirect('/platform/dashboard')
    if (session.role === 'tenant_owner' || session.role === 'tenant_staff') redirect('/dashboard')
    if (session.role === 'customer') redirect('/my-bookings')
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold">QuickReserve</h1>
      <p className="text-slate-600">預約系統 SaaS 平台</p>
      <div className="flex gap-4">
        <Link href="/login" className={buttonVariants()}>
          登入
        </Link>
        <Link href="/signup" className={buttonVariants({ variant: 'outline' })}>
          註冊
        </Link>
      </div>
    </main>
  )
}
