'use client'

import { useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
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
      <DialogTrigger render={<Button className="w-full">申請購買</Button>} />
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>確認購買申請</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            送出後教練會在審核佇列看到此申請。請選擇您的付款狀態：
          </p>
          <div className="space-y-2">
            <label className="flex items-center gap-2 rounded border p-2 text-sm">
              <input
                type="radio"
                checked={paid === 'claimed_paid'}
                onChange={() => setPaid('claimed_paid')}
              />
              <span>已付款（現金 / 轉帳已完成）</span>
            </label>
            <label className="flex items-center gap-2 rounded border p-2 text-sm">
              <input
                type="radio"
                checked={paid === 'awaiting_payment'}
                onChange={() => setPaid('awaiting_payment')}
              />
              <span>未付款（會在後續支付）</span>
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button
            onClick={() => execute({ packageId, paymentSelfReported: paid })}
            disabled={isPending}
          >
            {isPending ? '送出中...' : '送出申請'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
