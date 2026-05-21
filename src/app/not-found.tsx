import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold">頁面不存在</h2>
        <Link href="/" className={buttonVariants({ className: 'mt-6' })}>
          回首頁
        </Link>
      </div>
    </main>
  )
}
