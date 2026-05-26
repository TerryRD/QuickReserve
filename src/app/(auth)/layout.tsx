import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { QRMark } from '@/components/brand/qr-mark'
import { ThemeToggle } from '@/components/theme-toggle'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
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
          <Link
            href="/"
            className="font-mono inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-[11px] uppercase tracking-wider hover:bg-muted"
          >
            <ArrowLeft className="size-3" />
            返回首頁
          </Link>
          <ThemeToggle />
        </div>
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  )
}
