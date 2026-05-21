'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { User, Trash2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import ConfirmDialog from '@/components/confirm-dialog'
import { deleteSlotAction } from './actions'

const STATUS_LABEL: Record<string, { label: string; class: string }> = {
  available: { label: '可預約', class: 'bg-blue-100 text-blue-900' },
  pending: { label: '待確認', class: 'bg-amber-100 text-amber-900' },
  booked: { label: '已預約', class: 'bg-emerald-100 text-emerald-900' },
  cancelled: { label: '已取消', class: 'bg-slate-200 text-slate-700' },
}

export default function SlotPopover({
  slot,
  timeLabel,
  children,
}: {
  slot: {
    id: string
    status: string
    serviceName: string | null
    customerName: string | null
    bookingId: string | null
    memberLabel: string
    isOwn: boolean
  }
  timeLabel: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const status = STATUS_LABEL[slot.status] ?? STATUS_LABEL.available!

  const { execute: deleteSlot, isPending: deleting } = useAction(deleteSlotAction, {
    onSuccess: () => {
      toast.success('已刪除時段')
      setOpen(false)
    },
    onError: ({ error }) => toast.error(error.serverError?.message ?? '刪除失敗'),
  })

  const canDelete = slot.isOwn && (slot.status === 'available' || slot.status === 'cancelled')

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={children as React.ReactElement} />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            <span className="font-display italic">{slot.serviceName ?? '時段'}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
            <span className="text-sm text-muted-foreground">時間</span>
            <span className="font-mono text-sm font-medium">{timeLabel}</span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
            <span className="text-sm text-muted-foreground">負責成員</span>
            <span className="text-sm font-medium">{slot.memberLabel}</span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
            <span className="text-sm text-muted-foreground">狀態</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.class}`}
            >
              {status.label}
            </span>
          </div>
          {slot.customerName && (
            <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
              <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                <User className="h-3.5 w-3.5" /> 學員
              </span>
              <span className="text-sm font-medium">{slot.customerName}</span>
            </div>
          )}
          {!slot.isOwn && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              這是其他成員的時段，您只能檢視。
            </div>
          )}
          {(slot.status === 'pending' || slot.status === 'booked') && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
              此時段已有預約，請至「預約管理」操作確認 / 取消。
            </div>
          )}
        </div>

        <DialogFooter>
          {slot.status === 'pending' || slot.status === 'booked' ? (
            <Link
              href="/bookings"
              className="inline-flex items-center justify-center rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              前往預約管理
            </Link>
          ) : null}
          {canDelete && (
            <ConfirmDialog
              trigger={
                <Button variant="outline" size="sm" disabled={deleting}>
                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                  {deleting ? '刪除中...' : '刪除時段'}
                </Button>
              }
              title="確定要刪除此時段嗎？"
              description="刪除後將從行事曆移除。若此時段屬於重複規則，下一輪會重新產生。"
              confirmLabel="刪除"
              variant="destructive"
              onConfirm={() => deleteSlot({ id: slot.id })}
            />
          )}
          {!canDelete && slot.status === 'available' && !slot.isOwn && (
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              關閉
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
