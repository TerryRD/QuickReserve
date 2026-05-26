'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Calendar,
  CalendarClock,
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
    { href: '/calendar/availability', label: '可用時段', icon: CalendarClock },
    { href: '/bookings', label: '預約管理', icon: ClipboardList },
    { href: '/customers', label: '學員', icon: Contact },
    { href: '/services', label: '服務項目', icon: Package },
    { href: '/packages', label: '套裝管理', icon: Package },
    ...(isOwner ? [{ href: '/staff', label: '助教管理', icon: Users }] : []),
    ...(isOwner ? [{ href: '/settings/profile', label: '租戶資料', icon: UserCog }] : []),
    { href: '/notifications', label: '通知設定', icon: Settings },
  ]

  return (
    <nav className="flex flex-col gap-1">
      {items.map((it) => {
        const active =
          it.href === '/calendar'
            ? pathname === '/calendar'
            : pathname === it.href || pathname.startsWith(it.href + '/')
        return (
          <Link
            key={it.href}
            href={it.href}
            onClick={onNavigate}
            className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
              active
                ? 'bg-sidebar-primary text-sidebar-primary-foreground font-semibold'
                : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground'
            }`}
          >
            <it.icon className="size-4 shrink-0" />
            <span className="font-cjk">{it.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
