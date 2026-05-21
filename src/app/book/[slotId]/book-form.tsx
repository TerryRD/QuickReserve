'use client'

import { useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createBookingAction } from './actions'

export default function BookForm({ slotId }: { slotId: string }) {
  const [customerNotes, setCustomerNotes] = useState('')
  const { execute, isPending } = useAction(createBookingAction, {
    onError: ({ error }) => toast.error(error.serverError?.message ?? '預約失敗'),
  })

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        execute({ slotId, customerNotes: customerNotes || null })
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="notes">備註（選填）</Label>
        <Input
          id="notes"
          value={customerNotes}
          onChange={(e) => setCustomerNotes(e.target.value)}
          placeholder="例如：第一次上課、想學發球..."
        />
      </div>
      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? '送出中...' : '送出預約申請'}
      </Button>
      <p className="text-xs text-slate-500">
        送出後狀態為「待確認」，教練確認後正式成立。
      </p>
    </form>
  )
}
