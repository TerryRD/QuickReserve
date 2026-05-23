import Link from 'next/link'
import { Calendar } from 'lucide-react'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen md:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-700 to-slate-900 p-10 text-white md:flex">
        <div className="pointer-events-none absolute -left-20 -top-20 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 bottom-0 h-96 w-96 rounded-full bg-indigo-400/20 blur-3xl" />
        <Link href="/" className="relative inline-flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-white/20 backdrop-blur">
            <Calendar className="h-4 w-4" strokeWidth={2.5} />
          </div>
          <span className="text-lg font-bold tracking-tight">QuickReserve</span>
        </Link>
        <div className="relative space-y-3">
          <p className="text-2xl font-semibold leading-snug">專業教練的預約管理工具</p>
          <p className="text-sm text-white/75">
            一次設好可用時段，開連結給學員預約，剩下交給我們。
          </p>
        </div>
        <div className="relative text-xs text-white/60">© 2026 QuickReserve</div>
      </div>
      <div className="flex items-center justify-center bg-background p-6 md:p-12">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-8 inline-flex items-center gap-2 md:hidden">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
              <Calendar className="h-4 w-4" strokeWidth={2.5} />
            </div>
            <span className="text-lg font-bold tracking-tight">QuickReserve</span>
          </Link>
          {children}
        </div>
      </div>
    </main>
  )
}
