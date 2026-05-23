'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Calendar,
  ClipboardList,
  Contact,
  LayoutDashboard,
  Package,
  Settings,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react'

type Item = { href: string; label: string; icon: LucideIcon }

export default function SidebarNav({
  isOwner,
  onNavigate,
}: {
  isOwner: boolean
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const items: Item[] = [
    { href: '/dashboard', label: '儀表板', icon: LayoutDashboard },
    { href: '/calendar', label: '行事曆', icon: Calendar },
    { href: '/bookings', label: '預約管理', icon: ClipboardList },
    { href: '/customers', label: '學員', icon: Contact },
    { href: '/services', label: '服務項目', icon: Package },
    ...(isOwner ? [{ href: '/staff', label: '助教管理', icon: Users }] : []),
    ...(isOwner ? [{ href: '/settings/profile', label: '租戶資料', icon: UserCog }] : []),
    { href: '/notifications', label: '通知設定', icon: Settings },
  ]

  return (
    <nav className="flex flex-col gap-0.5">
      {items.map((it) => {
        const active = pathname === it.href || pathname.startsWith(it.href + '/')
        return (
          <Link
            key={it.href}
            href={it.href}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
              active
                ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground'
            }`}
          >
            <it.icon className="h-4 w-4 shrink-0" />
            <span>{it.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
