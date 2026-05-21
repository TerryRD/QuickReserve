import Link from 'next/link'
import { requireTenantMember } from '@/lib/auth/get-session'
import { getTenantContext } from '@/lib/auth/get-tenant-context'

export default async function TenantLayout({ children }: { children: React.ReactNode }) {
  const session = await requireTenantMember()
  const tenant = await getTenantContext(session.tenantId)

  if (tenant.status === 'suspended') {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <div className="max-w-md text-center">
          <h2 className="text-2xl font-bold">您的租戶已被暫停</h2>
          <p className="mt-2 text-slate-600">請聯絡平台管理員。</p>
        </div>
      </main>
    )
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 bg-slate-800 p-4 text-slate-100">
        <h2 className="mb-1 text-lg font-bold">{tenant.name}</h2>
        <p className="mb-6 text-xs opacity-70">
          {session.role === 'tenant_owner' ? 'Owner' : 'Staff'}
        </p>
        <nav className="flex flex-col gap-2 text-sm">
          <Link href="/dashboard">儀表板</Link>
          <Link href="/calendar">行事曆</Link>
          <Link href="/bookings">預約管理</Link>
          <Link href="/services">服務項目</Link>
          {session.role === 'tenant_owner' && <Link href="/staff">助教管理</Link>}
          <Link href="/settings/notifications">通知設定</Link>
        </nav>
      </aside>
      <main className="flex-1 bg-slate-50 p-6">{children}</main>
    </div>
  )
}
