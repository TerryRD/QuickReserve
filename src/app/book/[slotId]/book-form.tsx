'use client'

import { useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PrimaryCta } from '@/components/ui/primary-cta'
import { createBookingAction } from './actions'

export default function BookForm({
  slotId,
  rescheduleFrom,
}: {
  slotId: string
  rescheduleFrom?: string | null
}) {
  const [customerNotes, setCustomerNotes] = useState('')
  const { execute, isPending } = useAction(createBookingAction, {
    onError: ({ error }) =>
      toast.error(error.serverError?.message ?? (rescheduleFrom ? '改期失敗' : '預約失敗')),
  })

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        execute({
          slotId,
          customerNotes: customerNotes || null,
          rescheduleFrom: rescheduleFrom ?? null,
        })
      }}
    >
      {!rescheduleFrom && (
        <div className="space-y-2">
          <Label htmlFor="notes" className="font-mono text-[11px] uppercase tracking-wider">
            備註（選填） NOTES
          </Label>
          <Input
            id="notes"
            value={customerNotes}
            onChange={(e) => setCustomerNotes(e.target.value)}
            placeholder="例如：第一次上課、想學發球..."
            className="font-cjk h-12 rounded-xl border-2 border-border bg-background px-4 text-sm"
          />
        </div>
      )}
      <PrimaryCta type="submit" disabled={isPending} className="w-full justify-between">
        {isPending
          ? rescheduleFrom
            ? '改期中...'
            : '送出中...'
          : rescheduleFrom
            ? '確認改期'
            : '送出預約申請'}
      </PrimaryCta>
      <p className="font-cjk text-center text-xs text-muted-foreground">
        {rescheduleFrom
          ? '原預約將被取消，並建立新的「待確認」預約。'
          : '送出後狀態為「待確認」，教練確認後即正式成立。'}
      </p>
    </form>
  )
}
