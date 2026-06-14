import Link from 'next/link'
import { resolveDisplayName } from '@/lib/auth/display-name'

/**
 * 顯示目前登入者（姓名 + email），整塊連到 /account。
 * tone='sidebar' 用於深色側欄；tone='light' 用於淺色 header。
 */
export function AccountChip({
  displayName,
  email,
  roleLabel,
  tone = 'sidebar',
}: {
  displayName: string | null
  email: string | null
  roleLabel?: string
  tone?: 'sidebar' | 'light'
}) {
  const name = resolveDisplayName({ displayName, email })
  const initial = name.slice(0, 1).toUpperCase()

  if (tone === 'light') {
    return (
      <Link
        href="/account"
        className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-slate-100"
      >
        <div className="grid size-7 shrink-0 place-items-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">
          {initial}
        </div>
        <div className="min-w-0 leading-tight">
          <div className="truncate text-sm font-medium text-slate-800">{name}</div>
          {email && <div className="truncate text-[11px] text-slate-400">{email}</div>}
        </div>
      </Link>
    )
  }

  return (
    <Link
      href="/account"
      className="flex items-center gap-3 rounded-xl border border-sidebar-border bg-sidebar-accent p-3 transition-colors hover:brightness-110"
    >
      <div className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
        <span className="font-display text-base">{initial}</span>
      </div>
      <div className="min-w-0 flex-1 leading-tight">
        <div className="font-cjk truncate text-sm font-semibold">{name}</div>
        {email && <div className="truncate text-[11px] opacity-70">{email}</div>}
        {roleLabel && (
          <div className="font-mono mt-0.5 text-[9px] uppercase tracking-wider opacity-60">
            {roleLabel}
          </div>
        )}
      </div>
    </Link>
  )
}
