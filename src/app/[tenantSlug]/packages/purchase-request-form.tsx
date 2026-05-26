'use client'

import { useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { PrimaryCta } from '@/components/ui/primary-cta'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { requestPurchaseAction } from './purchase-request-action'

export default function PurchaseRequestForm({ packageId }: { packageId: string }) {
  const [open, setOpen] = useState(false)
  const [paid, setPaid] = useState<'claimed_paid' | 'awaiting_payment'>('claimed_paid')

  const { execute, isPending } = useAction(requestPurchaseAction, {
    onSuccess: () => {
      toast.success('申請已送出，請等教練確認')
      setOpen(false)
    },
    onError: ({ error }) => toast.error(error.serverError?.message ?? '送出失敗'),
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="accent" size="pill" className="w-full">
            申請購買
          </Button>
        }
      />
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-xl uppercase">確認購買申請</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="font-cjk text-sm text-muted-foreground">
            送出後教練會在審核佇列看到此申請。請選擇您的付款狀態：
          </p>
          <div className="space-y-2">
            <label
              className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 p-3 font-cjk text-sm transition ${
                paid === 'claimed_paid'
                  ? 'border-foreground bg-muted'
                  : 'border-border hover:border-foreground/40'
              }`}
            >
              <input
                type="radio"
                checked={paid === 'claimed_paid'}
                onChange={() => setPaid('claimed_paid')}
                className="size-4 accent-current"
              />
              <span>已付款（現金 / 轉帳已完成）</span>
            </label>
            <label
              className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 p-3 font-cjk text-sm transition ${
                paid === 'awaiting_payment'
                  ? 'border-foreground bg-muted'
                  : 'border-border hover:border-foreground/40'
              }`}
            >
              <input
                type="radio"
                checked={paid === 'awaiting_payment'}
                onChange={() => setPaid('awaiting_payment')}
                className="size-4 accent-current"
              />
              <span>未付款（會在後續支付）</span>
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="pill" onClick={() => setOpen(false)}>
            取消
          </Button>
          <PrimaryCta
            size="md"
            onClick={() => execute({ packageId, paymentSelfReported: paid })}
            disabled={isPending}
          >
            {isPending ? '送出中...' : '送出申請'}
          </PrimaryCta>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
