'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Building2, LayoutDashboard, type LucideIcon } from 'lucide-react'

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  Building2,
}

export default function PlatformSidebarNav({
  items,
}: {
  items: { href: string; label: string; icon: keyof typeof ICONS }[]
}) {
  const pathname = usePathname()
  return (
    <nav className="flex flex-col gap-0.5">
      {items.map((it) => {
        const active = pathname === it.href || pathname.startsWith(it.href + '/')
        const Icon = ICONS[it.icon]!
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
              active
                ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground'
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span>{it.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
