'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PrimaryCta } from '@/components/ui/primary-cta'
import { SectionHead } from '@/components/ui/section-head'
import { createBookingAction } from './actions'

type PurchaseOption = {
  id: string
  classes_total: number
  classes_used: number
  expires_at: string | null
  service_packages: { name: string } | null
}

export default function BookForm({
  slotId,
  rescheduleFrom,
  purchases,
  defaultPurchaseId,
}: {
  slotId: string
  rescheduleFrom?: string | null
  purchases: PurchaseOption[]
  defaultPurchaseId: string
}) {
  const [customerNotes, setCustomerNotes] = useState('')
  const [selectedPurchaseId, setSelectedPurchaseId] = useState(defaultPurchaseId)
  const { execute, isPending } = useAction(createBookingAction, {
    onError: ({ error }) =>
      toast.error(error.serverError?.message ?? (rescheduleFrom ? '改期失敗' : '預約失敗')),
  })

  return (
    <form
      className="space-y-7"
      onSubmit={(e) => {
        e.preventDefault()
        execute({
          slotId,
          customerNotes: customerNotes || null,
          rescheduleFrom: rescheduleFrom ?? null,
          purchaseId: rescheduleFrom ? null : selectedPurchaseId,
        })
      }}
    >
      {!rescheduleFrom && (
        <>
          <section>
            <SectionHead
              kicker="PACKAGE · 套裝餘額"
              title="本次將扣除"
              eng="DEDUCT"
              hint="預設挑最快到期的；可手動切換成其他有效套裝。"
            />
            <div className="grid gap-3">
              {purchases.map((p) => {
                const remaining = p.classes_total - p.classes_used
                const total = p.classes_total
                const percent = total > 0 ? (remaining / total) * 100 : 0
                const pkgName = p.service_packages?.name ?? '套裝'
                return (
                  <label
                    key={p.id}
                    className="flex cursor-pointer items-center gap-4 rounded-2xl border border-border bg-card p-5 transition-colors has-[:checked]:border-foreground has-[:checked]:bg-accent has-[:checked]:text-accent-foreground"
                  >
                    <input
                      type="radio"
                      name="package"
                      value={p.id}
                      checked={p.id === selectedPurchaseId}
                      onChange={() => setSelectedPurchaseId(p.id)}
                      className="size-4 accent-foreground"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-cjk truncate text-sm font-semibold">{pkgName}</div>
                      <div className="font-mono mt-1 text-xs tracking-wider text-muted-foreground">
                        {remaining}/{total} 堂
                        {p.expires_at ? (
                          <>
                            {' · '}期限 {format(new Date(p.expires_at), 'yyyy/MM/dd')}
                          </>
                        ) : null}
                      </div>
                      <div className="bg-muted mt-2 h-1 overflow-hidden rounded-full">
                        <div
                          className="bg-foreground h-full"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                    <div className="font-display text-2xl leading-none">{remaining}</div>
                  </label>
                )
              })}
            </div>
          </section>

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
        </>
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
