import { requirePlatformAdmin } from '@/lib/auth/get-session'
import Link from 'next/link'

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  await requirePlatformAdmin()
  return (
    <div className="flex min-h-screen">
      <aside className="w-56 bg-slate-900 p-4 text-slate-100">
        <h2 className="mb-6 text-lg font-bold">平台後台</h2>
        <nav className="flex flex-col gap-2 text-sm">
          <Link href="/platform/dashboard">儀表板</Link>
          <Link href="/platform/tenants">租戶管理</Link>
        </nav>
      </aside>
      <main className="flex-1 bg-slate-50 p-6">{children}</main>
    </div>
  )
}
