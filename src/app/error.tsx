'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Production-safe error boundary.
 * - Hides raw error messages (especially React minified errors / stack traces) from users.
 * - Shows the `digest` so users can quote it to support / we can grep server logs.
 * - In dev, shows the actual message for debugging.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[global-error]', error)
  }, [error])

  const isDev = process.env.NODE_ENV !== 'production'

  return (
    <main className="grid min-h-[60vh] place-items-center p-8">
      <div className="max-w-md text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-rose-50 text-rose-600">
          <AlertCircle className="h-7 w-7" />
        </div>
        <h2 className="mt-5 font-display text-2xl">
          <span className="italic">系統發生錯誤</span>
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          這個頁面暫時無法載入。請稍候片刻後再試一次，
          或回到首頁。若問題持續發生，請與我們聯絡並提供下方代碼。
        </p>
        {error.digest && (
          <p className="mt-4 font-mono text-xs text-muted-foreground/70">
            錯誤代碼：{error.digest}
          </p>
        )}
        {isDev && (
          <pre className="mt-4 max-h-40 overflow-auto rounded-md bg-muted p-3 text-left text-[10px] leading-tight">
            {error.stack ?? error.message}
          </pre>
        )}
        <div className="mt-6 flex items-center justify-center gap-2">
          <Button onClick={reset}>重試</Button>
          <Link
            href="/"
            className="inline-flex items-center rounded-md border bg-background px-3 py-1.5 text-sm hover:bg-muted"
          >
            回首頁
          </Link>
        </div>
      </div>
    </main>
  )
}
