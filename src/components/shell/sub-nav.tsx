import Link from 'next/link'
import { cn } from '@/lib/utils'

type SubNavItem = { href: string; label: string; eng: string }

export function SubNav({
  items,
  active,
  className,
}: {
  items: SubNavItem[]
  active: string
  className?: string
}) {
  return (
    <nav
      className={cn(
        'inline-flex rounded-full border border-border bg-card p-1 shadow-[0_8px_24px_-18px_rgba(0,0,0,0.18)]',
        className,
      )}
    >
      {items.map((it) => {
        const isActive = it.href === active
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'flex items-baseline gap-2 rounded-full px-4 py-2 text-sm transition',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <span className="font-cjk">{it.label}</span>
            <span className="font-mono text-[10px] tracking-[0.15em] opacity-70">
              {it.eng}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
