import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export default function AuthCta({ returnPath }: { returnPath: string }) {
  const enc = encodeURIComponent(returnPath)
  return (
    <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">
      <p className="font-medium text-amber-900">尚未登入</p>
      <p className="mt-1 text-amber-800">登入或註冊後即可購買套裝 / 預約時段。</p>
      <div className="mt-3 flex gap-2">
        <Link href={`/login?redirect=${enc}`} className={cn(buttonVariants({ size: 'sm' }))}>
          登入
        </Link>
        <Link href={`/signup?redirect=${enc}`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
          註冊
        </Link>
      </div>
    </div>
  )
}
