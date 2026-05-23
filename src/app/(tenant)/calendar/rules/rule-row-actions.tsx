'use client'

import { useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { deleteRuleAction, toggleRuleActiveAction } from './actions'

export function RuleToggle({ ruleId, isActive }: { ruleId: string; isActive: boolean }) {
  const { execute, isPending } = useAction(toggleRuleActiveAction, {
    onSuccess: () => toast.success(isActive ? '已停用' : '已啟用'),
    onError: ({ error }) => toast.error(error.serverError?.message ?? '失敗'),
  })
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => execute({ id: ruleId, isActive: !isActive })}
      className={`relative h-6 w-11 rounded-full transition-colors disabled:opacity-50 ${
        isActive ? 'bg-emerald-500' : 'bg-slate-300'
      }`}
    >
      <div
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
          isActive ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

export function RuleDeleteButton({ ruleId }: { ruleId: string }) {
  const [open, setOpen] = useState(false)
  const [deleteSlots, setDeleteSlots] = useState(true)

  const { execute, isPending } = useAction(deleteRuleAction, {
    onSuccess: ({ data }) => {
      toast.success(
        data?.removedSlots
          ? `已刪除規則 + ${data.removedSlots} 個時段`
          : '已刪除規則（保留已生成的時段）',
      )
      setOpen(false)
    },
    onError: ({ error }) => toast.error(error.serverError?.message ?? '刪除失敗'),
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="sm">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        }
      />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>刪除重複規則</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            這只會刪除「規則」本身。已生成的時段預設會保留（仍可預約 / 取消），
            可勾選下方一併清除未來尚未被預約的時段。
          </p>
          <label className="flex cursor-pointer items-start gap-2 rounded-lg border bg-muted/30 p-3">
            <input
              type="checkbox"
              checked={deleteSlots}
              onChange={(e) => setDeleteSlots(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-primary"
            />
            <span className="text-sm">
              <strong>同時刪除</strong>未來尚未被預約的時段
              <span className="block text-xs text-muted-foreground">
                已有學員預約（pending / booked）的時段不會被刪
              </span>
            </span>
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button
            variant="destructive"
            disabled={isPending}
            onClick={() => execute({ id: ruleId, deleteFutureSlots: deleteSlots })}
          >
            {isPending ? '刪除中...' : '確認刪除'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
