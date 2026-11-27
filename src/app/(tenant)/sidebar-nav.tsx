'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Bell,
  Calendar,
  CalendarClock,
  ClipboardList,
  Contact,
  LayoutDashboard,
  Package,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { UnreadBadge } from '@/components/notifications/unread-badge'

type Item = { href: string; label: string; icon: LucideIcon; badge?: number | null }

export default function SidebarNav({
  isOwner,
  unread,
  onNavigate,
}: {
  isOwner: boolean
  /** 未讀通知數；查詢失敗為 null（不顯示數字） */
  unread: number | null
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
    { href: '/packages', label: '課堂管理', icon: Package },
    ...(isOwner ? [{ href: '/staff', label: '助教管理', icon: Users }] : []),
    ...(isOwner ? [{ href: '/settings/profile', label: '租戶資料', icon: UserCog }] : []),
    { href: '/notifications', label: '通知', icon: Bell, badge: unread },
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
            {it.badge !== undefined && <UnreadBadge unread={it.badge} className="ml-auto" />}
          </Link>
        )
      })}
    </nav>
  )
}
