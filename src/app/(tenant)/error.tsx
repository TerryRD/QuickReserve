'use client'

import { Button } from '@/components/ui/button'

export default function TenantError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="p-6">
      <h2 className="text-xl font-bold">教練後台載入失敗</h2>
      <p className="mt-2 text-slate-600">{error.message}</p>
      <Button className="mt-4" onClick={reset}>
        重試
      </Button>
    </div>
  )
}
