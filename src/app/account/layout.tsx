import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-5 py-8 sm:py-12">
        <Link
          href="/"
          className="font-mono inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          返回
        </Link>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  )
}
