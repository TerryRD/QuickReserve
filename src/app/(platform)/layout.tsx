import Link from 'next/link'
import { Building2, Calendar, LayoutDashboard, LogOut } from 'lucide-react'
import { requirePlatformAdmin } from '@/lib/auth/get-session'
import PlatformSidebarNav from './platform-sidebar-nav'

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  await requirePlatformAdmin()
  return (
    <div className="grid min-h-screen md:grid-cols-[240px_1fr]">
      <aside className="flex flex-col bg-sidebar text-sidebar-foreground md:sticky md:top-0 md:h-screen">
        <div className="border-b border-sidebar-border p-4">
          <Link href="/platform/dashboard" className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
              <Calendar className="h-4 w-4" strokeWidth={2.5} />
            </div>
            <div>
              <div className="text-sm font-semibold">QuickReserve</div>
              <div className="text-xs text-sidebar-foreground/60">平台後台</div>
            </div>
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <PlatformSidebarNav
            items={[
              { href: '/platform/dashboard', label: '儀表板', icon: 'LayoutDashboard' },
              { href: '/platform/tenants', label: '租戶管理', icon: 'Building2' },
            ]}
          />
        </div>
        <div className="border-t border-sidebar-border p-3">
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
