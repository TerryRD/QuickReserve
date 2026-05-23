import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowRight, Sparkles } from 'lucide-react'
import { getSession } from '@/lib/auth/get-session'
import { buttonVariants } from '@/components/ui/button'

export default async function HomePage() {
  const session = await getSession()
  if (session) {
    if (session.role === 'platform_admin') redirect('/platform/dashboard')
    if (session.role === 'tenant_owner' || session.role === 'tenant_staff') redirect('/dashboard')
    if (session.role === 'customer') redirect('/my-bookings')
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 dot-grid text-foreground/[0.04]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[600px] w-[1200px] -translate-x-1/2 rounded-full bg-gradient-to-br from-[oklch(0.85_0.1_38)] via-[oklch(0.88_0.08_50)] to-transparent opacity-50 blur-3xl"
        aria-hidden
      />

      <header className="relative">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <Link href="/" className="font-display text-2xl tracking-tight">
            <span className="italic">Quick</span>Reserve
          </Link>
          <nav className="flex items-center gap-1">
            <Link href="/login" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
              登入
            </Link>
            <Link href="/signup" className={buttonVariants({ size: 'sm' })}>
              開始使用
            </Link>
          </nav>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-6 pb-32 pt-12 md:pt-24">
        <section className="grid items-end gap-10 md:grid-cols-12">
          <div className="md:col-span-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-foreground/20 bg-background/70 px-3 py-1 text-xs uppercase tracking-wider text-foreground/70 backdrop-blur">
              <Sparkles className="h-3 w-3 text-accent" />
              B2B2C 預約 SaaS · 為教練而生
            </div>
            <h1 className="mt-6 font-display text-[clamp(2.75rem,8vw,5.5rem)] leading-[0.95] tracking-tight">
              讓學員 <em className="italic text-accent">真的</em>
              <br />
              預約得到你。
            </h1>
            <p className="mt-8 max-w-xl text-lg leading-relaxed text-foreground/70">
              設定可預約時段、開放專屬連結、自動偵測衝突、即時推播通知 ——
              一個工具搞定排程、收單、客戶關係。
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Link href="/signup" className={buttonVariants({ size: 'lg' }) + ' group gap-2'}>
                免費開始
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </Link>
              <Link href="/login" className={buttonVariants({ variant: 'ghost', size: 'lg' })}>
                已有帳號 →
              </Link>
            </div>
          </div>

          <div className="relative md:col-span-4">
            <div className="relative aspect-[3/4] overflow-hidden rounded-3xl bg-foreground text-background shadow-2xl">
              <div className="absolute inset-0 bg-gradient-to-br from-foreground via-foreground to-[oklch(0.3_0.14_280)]" />
              <div className="relative flex h-full flex-col justify-between p-6">
                <div className="text-xs uppercase tracking-[0.2em] opacity-60">Tue · Apr 14</div>
                <div>
                  <div className="font-display text-5xl italic leading-none">14:00</div>
                  <div className="mt-2 text-xs uppercase tracking-wider opacity-80">
                    桌球 1 對 1 課
                  </div>
                  <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent-foreground" /> 待確認
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute -bottom-6 -left-6 rotate-[-4deg] rounded-2xl border bg-card p-4 shadow-lg">
              <div className="font-display text-xl">12 / 36</div>
              <div className="text-xs text-muted-foreground">本週時段已預約</div>
            </div>
          </div>
        </section>

        <section className="mt-24 border-y border-foreground/10 py-8">
          <div className="grid divide-y divide-foreground/10 md:grid-cols-4 md:divide-x md:divide-y-0">
            {[
              { k: '時段管理', v: '批量 / 重複規則', tag: '01' },
              { k: '衝突偵測', v: '原子鎖定不超賣', tag: '02' },
              { k: '推播通知', v: '預約異動即時推', tag: '03' },
              { k: '資料隔離', v: '租戶層級 RLS', tag: '04' },
            ].map((it) => (
              <div key={it.tag} className="px-6 py-4 md:py-2">
                <div className="font-mono text-[10px] uppercase tracking-widest text-foreground/40">
                  {it.tag} —
                </div>
                <div className="mt-1 font-display text-2xl italic">{it.k}</div>
                <div className="mt-1 text-sm text-foreground/60">{it.v}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-24 grid gap-8 md:grid-cols-3">
          {[
            {
              n: '一',
              h: '註冊 / 接受邀請',
              p: '平台管理員邀請你成為教練，你接受邀請後立即進入後台。',
            },
            {
              n: '二',
              h: '設定服務與時段',
              p: '建立服務項目與價格，再用重複規則一次排好整月行程。',
            },
            { n: '三', h: '分享專屬連結', p: '把 /your-slug 分享給學員，他們登入後即可預約。' },
          ].map((s) => (
            <article key={s.n} className="relative">
              <div className="font-display text-6xl italic text-accent/40">{s.n}</div>
              <h3 className="mt-2 font-display text-2xl">{s.h}</h3>
              <p className="mt-2 text-sm leading-relaxed text-foreground/70">{s.p}</p>
            </article>
          ))}
        </section>
      </main>

      <footer className="relative border-t border-foreground/10 bg-foreground/[0.02]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 text-xs text-foreground/50">
          <span className="font-display italic">© 2026 QuickReserve</span>
          <span className="font-mono uppercase tracking-widest">B2B2C · Made in Taiwan</span>
        </div>
      </footer>
    </div>
  )
}
