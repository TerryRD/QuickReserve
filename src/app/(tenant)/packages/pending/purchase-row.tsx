'use client'

import { useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { approvePurchaseAction, rejectPurchaseAction } from './purchase-actions'

type Props = {
  purchase: {
    id: string
    customerName: string
    serviceName: string
    packageName: string
    classesTotal: number
    paymentSelfReported: 'claimed_paid' | 'awaiting_payment'
    createdAt: string
  }
  emphasized?: boolean
}

export default function PurchaseRow({ purchase, emphasized = false }: Props) {
  const [rejectOpen, setRejectOpen] = useState(false)
  const [reason, setReason] = useState('')

  const approve = useAction(approvePurchaseAction, {
    onSuccess: () => toast.success('已確認'),
    onError: ({ error }) => toast.error(error.serverError?.message ?? '失敗'),
  })
  const reject = useAction(rejectPurchaseAction, {
    onSuccess: () => {
      toast.success('已拒絕')
      setRejectOpen(false)
    },
    onError: ({ error }) => toast.error(error.serverError?.message ?? '失敗'),
  })

  const paidLabel =
    purchase.paymentSelfReported === 'claimed_paid' ? '學員自報：已付款' : '學員自報：未付款'
  const paidColor =
    purchase.paymentSelfReported === 'claimed_paid'
      ? 'bg-emerald-100 text-emerald-800'
      : 'bg-amber-100 text-amber-800'

  return (
    <Card
      className={cn(
        'transition',
        emphasized && 'bg-accent/15 ring-2 ring-accent',
      )}
    >
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-xl italic">{purchase.customerName}</h3>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${paidColor}`}>
              {paidLabel}
            </span>
          </div>
          <div className="mt-1.5 text-sm">
            <span className="text-muted-foreground">想買：</span>
            {purchase.serviceName} · {purchase.packageName}（{purchase.classesTotal} 堂）
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">申請於 {purchase.createdAt}</div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => approve.execute({ id: purchase.id })}
            disabled={approve.isPending}
          >
            {approve.isPending ? '處理中...' : '確認'}
          </Button>
          <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
            <DialogTrigger render={<Button variant="outline">拒絕</Button>} />
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>拒絕購買申請</DialogTitle>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="rej-reason">原因（必填）</Label>
                <Input
                  id="rej-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="尚未收到款項 / 學員已取消 ..."
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setRejectOpen(false)}>
                  取消
                </Button>
                <Button
                  onClick={() => reject.execute({ id: purchase.id, reason })}
                  disabled={reject.isPending || !reason.trim()}
                  variant="destructive"
                >
                  確定拒絕
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  )
}
