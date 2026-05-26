import Link from 'next/link'
import { QRMark } from '@/components/brand/qr-mark'
import { ThemeToggle } from '@/components/theme-toggle'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-10">
        <Link href="/" className="flex items-center gap-3">
          <QRMark size={36} />
          <div className="leading-tight">
            <div className="font-display text-base uppercase tracking-wider">QuickReserve</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
              BOOK · YOUR · COACH
            </div>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto flex max-w-[1200px] flex-col gap-12 px-5 py-10 sm:px-10 lg:flex-row lg:items-center lg:gap-20 lg:py-20">
        {/* hero side */}
        <section className="lg:flex-1">
          <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            QUICKRESERVE · LOG IN
          </div>
          <h1 className="font-display text-[64px] uppercase leading-[0.9] tracking-tight sm:text-[88px] lg:text-[110px]">
            BOOK
            <br />
            YOUR
            <br />
            <span className="relative inline-block">
              COACH
              <span aria-hidden className="absolute -bottom-1 left-0 right-0 h-2 rounded bg-accent" />
            </span>
          </h1>
          <p className="font-cjk mt-6 max-w-md text-[15px] leading-relaxed text-muted-foreground">
            登入或建立帳號後，即可開始預約您專屬教練的時段。
          </p>
        </section>
        {/* form side */}
        <section className="w-full lg:max-w-[440px]">{children}</section>
      </main>
    </div>
  )
}
