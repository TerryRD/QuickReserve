'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Check, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PrimaryCta } from '@/components/ui/primary-cta'
import { cn } from '@/lib/utils'
import { requestPurchaseAction } from './purchase-request-action'

type Props = {
  packageId: string
  packageName: string
  signedIn: boolean
  loginHref: string
}

type PaymentChoice = 'claimed_paid' | 'awaiting_payment'

const PAYMENT_OPTIONS: { value: PaymentChoice; label: string }[] = [
  { value: 'claimed_paid', label: '已轉帳 / 已付款' },
  { value: 'awaiting_payment', label: '未付款(預約後再付)' },
]

export default function PurchaseRequestForm({
  packageId,
  packageName,
  signedIn,
  loginHref,
}: Props) {
  const [open, setOpen] = useState(false)
  const [paid, setPaid] = useState<PaymentChoice>('claimed_paid')

  const { execute, isPending } = useAction(requestPurchaseAction, {
    onSuccess: () => {
      toast.success(`「${packageName}」申請已送出,等教練核可`)
      setOpen(false)
    },
    onError: ({ error }) =>
      toast.error(error.serverError?.message ?? '送出失敗'),
  })

  if (!signedIn) {
    return (
      <Link href={loginHref} className="block">
        <Button variant="outline" size="pill" fullWidth>
          登入後申請
        </Button>
      </Link>
    )
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="default"
        size="pill"
        fullWidth
        withArrow="inline"
        onClick={() => setOpen(true)}
      >
        申請此套裝
      </Button>
    )
  }

  return (
    <div className="-mx-6 -mb-6 mt-1 flex flex-col gap-4 border-t border-border bg-muted/60 p-6 sm:-mx-7 sm:-mb-7 sm:p-7">
      <div className="flex items-center gap-2.5">
        <span className="inline-flex size-[22px] items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Info className="size-3" />
        </span>
        <span className="font-cjk text-[13px] font-semibold">申請套裝</span>
        <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground">
          · 教練核可後生效
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
          PAYMENT · 付款狀態
        </div>
        <div className="flex flex-wrap gap-2">
          {PAYMENT_OPTIONS.map((opt) => {
            const selected = paid === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPaid(opt.value)}
                aria-pressed={selected}
                className={cn(
                  'font-cjk inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[12.5px] transition',
                  selected
                    ? 'border-foreground bg-primary text-primary-foreground'
                    : 'border-border bg-card text-foreground hover:border-foreground/40',
                )}
              >
                {selected && <Check className="size-3" strokeWidth={3} />}
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-2.5 pt-1">
        <Button
          type="button"
          variant="ghost"
          size="pill"
          onClick={() => setOpen(false)}
          disabled={isPending}
        >
          收起
        </Button>
        <PrimaryCta
          size="md"
          onClick={() => execute({ packageId, paymentSelfReported: paid })}
          disabled={isPending}
        >
          {isPending ? '送出中…' : '送出申請'}
        </PrimaryCta>
      </div>
    </div>
  )
}
