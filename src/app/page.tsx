import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Calendar, Clock, Bell, ShieldCheck } from 'lucide-react'
import { getSession } from '@/lib/auth/get-session'
import { buttonVariants } from '@/components/ui/button'

export default async function HomePage() {
  const session = await getSession()
  if (session) {
    if (session.role === 'platform_admin') redirect('/platform/dashboard')
    if (session.role === 'tenant_owner' || session.role === 'tenant_staff') redirect('/dashboard')
    if (session.role === 'customer') redirect('/my-bookings')
  }

  const features = [
    {
      icon: Calendar,
      title: '彈性行事曆',
      body: '一次設定每週固定時段，重複規則自動展開 90 天。',
    },
    {
      icon: Clock,
      title: '即時預約',
      body: '學員透過專屬連結預約，原子鎖定不超賣。',
    },
    {
      icon: Bell,
      title: 'Web Push 通知',
      body: '新預約、確認、取消即時通知，再也不錯過。',
    },
    {
      icon: ShieldCheck,
      title: '租戶資料隔離',
      body: 'PostgreSQL Row Level Security 強制保護每位教練的資料。',
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-blue-50/40">
      <header className="border-b bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
              <Calendar className="h-4 w-4" strokeWidth={2.5} />
            </div>
            <span className="text-lg font-bold tracking-tight">QuickReserve</span>
          </div>
          <div className="flex gap-2">
            <Link href="/login" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
              登入
            </Link>
            <Link href="/signup" className={buttonVariants({ size: 'sm' })}>
              註冊
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-20">
        <section className="text-center">
          <div className="mx-auto inline-flex items-center rounded-full border bg-white px-3 py-1 text-xs text-slate-600 shadow-sm">
            <span className="mr-2 h-1.5 w-1.5 rounded-full bg-emerald-500" />
            B2B2C 預約 SaaS 平台
          </div>
          <h1 className="mt-6 text-balance text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
            專業教練的
            <br className="sm:hidden" />
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              預約管理工具
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-base text-slate-600 sm:text-lg">
            設定可用時段、開放專屬連結給學員預約、自動處理衝突、即時推播通知。
            一個工具搞定排程、收單、客戶關係。
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className={buttonVariants({ size: 'lg' }) + ' shadow-sm'}
            >
              免費註冊
            </Link>
            <Link
              href="/login"
              className={buttonVariants({ variant: 'outline', size: 'lg' })}
            >
              我已有帳號
            </Link>
          </div>
        </section>

        <section className="mt-24 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="group rounded-xl border bg-white p-6 shadow-sm transition hover:shadow-md"
            >
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-600">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-slate-900">{f.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{f.body}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t bg-white/60">
        <div className="mx-auto max-w-6xl px-6 py-6 text-center text-xs text-slate-500">
          © 2026 QuickReserve · B2B2C 預約系統 SaaS
        </div>
      </footer>
    </div>
  )
}
