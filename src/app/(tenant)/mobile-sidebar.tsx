'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Calendar, LogOut, Menu } from 'lucide-react'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { AccountChip } from '@/components/shell/account-chip'
import SidebarNav from './sidebar-nav'

export default function MobileSidebar({
  tenantName,
  tenantSlug,
  roleLabel,
  isOwner,
  displayName,
  email,
}: {
  tenantName: string
  tenantSlug: string
  roleLabel: string
  isOwner: boolean
  displayName: string | null
  email: string | null
}) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)
  return (
    <div className="sticky top-0 z-30 flex items-center justify-between border-b bg-background px-4 py-3 md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          }
        />
        <SheetContent
          side="left"
          className="flex w-64 flex-col bg-sidebar p-0 text-sidebar-foreground"
        >
          <div className="border-b border-sidebar-border p-4">
            <Link href="/dashboard" onClick={close} className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                <Calendar className="h-4 w-4" strokeWidth={2.5} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{tenantName}</div>
                <span className="mt-0.5 inline-block rounded-full bg-sidebar-accent px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider">
                  {roleLabel}
                </span>
              </div>
            </Link>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <SidebarNav isOwner={isOwner} onNavigate={close} />
          </div>
          <div className="border-t border-sidebar-border p-3">
            <div className="pb-2">
              <AccountChip displayName={displayName} email={email} roleLabel={roleLabel} />
            </div>
            <Link
              href={`/${tenantSlug}`}
              target="_blank"
              onClick={close}
              className="block rounded-md px-3 py-2 text-xs text-sidebar-foreground/60 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground"
            >
              🔗 公開預約頁 /{tenantSlug}
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
        </SheetContent>
      </Sheet>
      <Link href="/dashboard" className="flex items-center gap-2">
        <div className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
          <Calendar className="h-3.5 w-3.5" strokeWidth={2.5} />
        </div>
        <span className="text-sm font-semibold">{tenantName}</span>
      </Link>
      <div className="w-9" />
    </div>
  )
}
