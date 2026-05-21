'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function CustomerError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[customer-error]', error)
  }, [error])
  const isDev = process.env.NODE_ENV !== 'production'

  return (
    <div className="grid place-items-center p-10">
      <div className="max-w-md text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-rose-50 text-rose-600">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h2 className="mt-4 font-display text-xl italic">載入失敗</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          頁面暫時無法載入，請稍候再試。
        </p>
        {error.digest && (
          <p className="mt-3 font-mono text-xs text-muted-foreground/70">
            錯誤代碼：{error.digest}
          </p>
        )}
        {isDev && (
          <pre className="mt-3 max-h-40 overflow-auto rounded bg-muted p-2 text-left text-[10px]">
            {error.stack ?? error.message}
          </pre>
        )}
        <div className="mt-5 flex items-center justify-center gap-2">
          <Button onClick={reset}>重試</Button>
          <Link
            href="/my-bookings"
            className="inline-flex items-center rounded-md border bg-background px-3 py-1.5 text-sm hover:bg-muted"
          >
            回我的預約
          </Link>
        </div>
      </div>
    </div>
  )
}
