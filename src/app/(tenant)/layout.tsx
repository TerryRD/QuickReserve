import Link from 'next/link'
import { Calendar, LogOut } from 'lucide-react'
import { requireTenantMember } from '@/lib/auth/get-session'
import { getTenantContext } from '@/lib/auth/get-tenant-context'
import SidebarNav from './sidebar-nav'

export default async function TenantLayout({ children }: { children: React.ReactNode }) {
  const session = await requireTenantMember()
  const tenant = await getTenantContext(session.tenantId)

  if (tenant.status === 'suspended') {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 p-8">
        <div className="max-w-md rounded-xl border bg-white p-8 text-center shadow-sm">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-amber-50 text-amber-600">
            ⏸️
          </div>
          <h2 className="mt-4 text-xl font-semibold">您的租戶已被暫停</h2>
          <p className="mt-2 text-sm text-slate-600">請聯絡平台管理員恢復服務。</p>
        </div>
      </main>
    )
  }

  const roleLabel = session.role === 'tenant_owner' ? 'Owner' : 'Staff'

  return (
    <div className="grid min-h-screen md:grid-cols-[240px_1fr]">
      <aside className="flex flex-col bg-sidebar text-sidebar-foreground md:sticky md:top-0 md:h-screen">
        <div className="border-b border-sidebar-border p-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
              <Calendar className="h-4 w-4" strokeWidth={2.5} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{tenant.name}</div>
              <div className="text-xs text-sidebar-foreground/60">{roleLabel}</div>
            </div>
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <SidebarNav isOwner={session.role === 'tenant_owner'} />
        </div>
        <div className="border-t border-sidebar-border p-3">
          <Link
            href={`/${tenant.slug}`}
            target="_blank"
            className="block rounded-md px-3 py-2 text-xs text-sidebar-foreground/60 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground"
          >
            🔗 公開預約頁 /{tenant.slug}
          </Link>
          <form action="/api/logout" method="post">
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground"
            >
              <LogOut className="h-4 w-4" />
              登出
            </button>
          </form>
        </div>
      </aside>
      <main className="bg-background">
        <div className="mx-auto max-w-6xl p-6 md:p-8">{children}</div>
      </main>
    </div>
  )
}
