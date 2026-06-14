import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ExternalLink, LogOut } from 'lucide-react'
import { getSession, requireTenantMember } from '@/lib/auth/get-session'
import { getTenantContext } from '@/lib/auth/get-tenant-context'
import { QRMark } from '@/components/brand/qr-mark'
import { ThemeToggle } from '@/components/theme-toggle'
import { AccountChip } from '@/components/shell/account-chip'
import SidebarNav from './sidebar-nav'
import MobileSidebar from './mobile-sidebar'

export default async function TenantLayout({ children }: { children: React.ReactNode }) {
  // Redirect users in the wrong role group BEFORE throwing inside requireTenantMember.
  // Middleware only enforces auth; role-mismatch redirect is the layout's job.
  const pre = await getSession()
  if (pre && pre.role === 'customer') redirect('/my-bookings')
  if (pre && pre.role === 'platform_admin') redirect('/platform/dashboard')

  const session = await requireTenantMember()
  const tenant = await getTenantContext(session.tenantId)

  if (tenant.status === 'suspended') {
    return (
      <main className="grid min-h-screen place-items-center bg-background p-8">
        <div className="max-w-md rounded-2xl border border-border bg-card p-10 text-center">
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            SUSPENDED
          </div>
          <h2 className="font-display mt-4 text-2xl uppercase">租戶已被暫停</h2>
          <p className="font-cjk mt-2 text-sm text-muted-foreground">請聯絡平台管理員恢復服務。</p>
        </div>
      </main>
    )
  }

  const roleLabel = session.role === 'tenant_owner' ? 'Owner' : 'Staff'
  const isOwner = session.role === 'tenant_owner'

  return (
    <div className="md:grid md:min-h-screen md:grid-cols-[240px_1fr]">
      <MobileSidebar
        tenantName={tenant.name}
        tenantSlug={tenant.slug}
        roleLabel={roleLabel}
        isOwner={isOwner}
        displayName={session.displayName}
        email={session.email}
      />
      <aside className="hidden flex-col bg-sidebar text-sidebar-foreground md:sticky md:top-0 md:flex md:h-screen">
        {/* Logo block */}
        <div className="border-b border-sidebar-border p-4">
          <Link href="/dashboard" className="flex items-center gap-3">
            <QRMark size={36} />
            <div className="min-w-0 flex-1 leading-tight">
              <div className="font-display text-base uppercase tracking-wider">QuickReserve</div>
              <div className="font-mono text-[9px] uppercase tracking-[0.15em] opacity-70">
                BOOK · YOUR · COACH
              </div>
            </div>
          </Link>
        </div>

        {/* Tenant card */}
        <div className="border-b border-sidebar-border p-4">
          <div className="rounded-xl border border-sidebar-border bg-sidebar-accent p-3">
            <div className="flex items-center gap-3">
              <div className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
                <span className="font-display text-base">{tenant.name.slice(0, 1)}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-cjk truncate text-sm font-semibold">{tenant.name}</div>
                <div className="font-mono mt-0.5 text-[9px] uppercase tracking-wider opacity-70">
                  {roleLabel}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <div className="flex-1 overflow-y-auto p-3">
          <SidebarNav isOwner={isOwner} />
        </div>

        {/* Bottom: public link + theme toggle + logout */}
        <div className="space-y-2 border-t border-sidebar-border p-3">
          <AccountChip
            displayName={session.displayName}
            email={session.email}
            roleLabel={roleLabel}
            href="/settings/account"
          />
          <Link
            href={`/${tenant.slug}`}
            target="_blank"
            className="flex items-center gap-2 rounded-xl px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <ExternalLink className="size-3" />
            公開頁 /{tenant.slug}
          </Link>
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
        <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-12">{children}</div>
      </main>
    </div>
  )
}
