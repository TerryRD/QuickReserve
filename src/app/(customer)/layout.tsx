import { requireSession } from '@/lib/auth/get-session'

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  await requireSession()
  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-3xl">{children}</div>
    </main>
  )
}
