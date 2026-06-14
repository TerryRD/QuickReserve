import Link from 'next/link'
import { redirect } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { getSession, requirePlatformAdmin } from '@/lib/auth/get-session'
import { QRMark } from '@/components/brand/qr-mark'
import { ThemeToggle } from '@/components/theme-toggle'
import { AccountChip } from '@/components/shell/account-chip'
import PlatformSidebarNav from './platform-sidebar-nav'

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const pre = await getSession()
  if (pre && pre.role === 'customer') redirect('/my-bookings')
  if (pre && (pre.role === 'tenant_owner' || pre.role === 'tenant_staff')) redirect('/dashboard')
  const session = await requirePlatformAdmin()
  return (
    <div className="md:grid md:min-h-screen md:grid-cols-[240px_1fr]">
      <aside className="hidden flex-col bg-sidebar text-sidebar-foreground md:sticky md:top-0 md:flex md:h-screen">
        {/* Logo block */}
        <div className="border-b border-sidebar-border p-4">
          <Link href="/platform/dashboard" className="flex items-center gap-3">
            <QRMark size={36} />
            <div className="min-w-0 flex-1 leading-tight">
              <div className="font-display text-base uppercase tracking-wider">QuickReserve</div>
              <div className="font-mono text-[9px] uppercase tracking-[0.15em] opacity-70">
                PLATFORM · 平台後台
              </div>
            </div>
          </Link>
        </div>

        {/* Nav */}
        <div className="flex-1 overflow-y-auto p-3">
          <PlatformSidebarNav
            items={[
              { href: '/platform/dashboard', label: '儀表板', icon: 'LayoutDashboard' },
              { href: '/platform/tenants', label: '租戶管理', icon: 'Building2' },
              { href: '/platform/bookings', label: '所有預約', icon: 'ClipboardList' },
            ]}
          />
        </div>

        {/* Bottom: theme toggle + logout */}
        <div className="space-y-2 border-t border-sidebar-border p-3">
          <AccountChip
            displayName={session.displayName}
            email={session.email}
            roleLabel="Platform Admin"
          />
          <div className="px-1">
            <ThemeToggle className="w-full justify-center" />
          </div>
          <form action="/api/logout" method="post">
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 font-cjk text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              <LogOut className="size-4" />
              登出
            </button>
          </form>
        </div>
      </aside>
      <main className="bg-background">
        <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-12">
          {children}
        </div>
      </main>
    </div>
  )
}
