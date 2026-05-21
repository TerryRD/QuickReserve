'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

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

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="max-w-md text-center">
        <h2 className="text-2xl font-bold">發生錯誤</h2>
        <p className="mt-2 text-slate-600">{error.message || '系統錯誤，請稍後再試'}</p>
        <Button className="mt-6" onClick={reset}>
          重試
        </Button>
      </div>
    </main>
  )
}
