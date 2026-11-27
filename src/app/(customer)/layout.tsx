import Link from 'next/link'
import { Calendar, LogOut } from 'lucide-react'
import { requireSession } from '@/lib/auth/get-session'
import { AccountChip } from '@/components/shell/account-chip'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { countUnread } from '@/lib/notifications'
import { NotificationPopover } from '@/components/notifications/notification-popover'

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession()
  const supabase = await createSupabaseServerClient()
  // 讀不到時是 null：鈴鐺照樣顯示，只是不顯示數字
  const unread = await countUnread(supabase, session.userId)

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="border-b bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
              <Calendar className="h-3.5 w-3.5" strokeWidth={2.5} />
            </div>
            <span className="font-semibold tracking-tight">QuickReserve</span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="hidden sm:block">
              <AccountChip displayName={session.displayName} email={session.email} tone="light" />
            </div>
            <NotificationPopover href="/my-notifications" unread={unread} />
            <form action="/api/logout" method="post">
              <button
                type="submit"
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              >
                <LogOut className="h-3.5 w-3.5" />
                登出
              </button>
            </form>
          </div>
        </div>
      </header>
      <main>
        <div className="mx-auto max-w-3xl px-4 py-6">{children}</div>
      </main>
    </div>
  )
}
