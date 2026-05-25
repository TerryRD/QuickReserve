'use client'

import { useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'
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
import ConfirmDialog from '@/components/confirm-dialog'
import {
  createUnavailableEventAction,
  deleteUnavailableEventAction,
} from './unavailable-actions'

type Preset = 'full' | 'half-am' | 'half-pm' | 'custom'

export default function UnavailableEventDialog() {
  const [open, setOpen] = useState(false)
  const today = new Date().toISOString().slice(0, 10)
  const [preset, setPreset] = useState<Preset>('full')
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(today)
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('17:00')
  const [reason, setReason] = useState('')

  const { execute, isPending } = useAction(createUnavailableEventAction, {
    onSuccess: () => {
      toast.success('已新增不可用事件')
      setOpen(false)
      setReason('')
    },
    onError: ({ error }) => toast.error(error.serverError?.message ?? '建立失敗'),
  })

  function submit() {
    let startAt: string
    let endAt: string
    if (preset === 'full') {
      startAt = new Date(`${startDate}T00:00:00+08:00`).toISOString()
      endAt = new Date(`${endDate}T23:59:59+08:00`).toISOString()
    } else if (preset === 'half-am') {
      startAt = new Date(`${startDate}T00:00:00+08:00`).toISOString()
      endAt = new Date(`${startDate}T12:00:00+08:00`).toISOString()
    } else if (preset === 'half-pm') {
      startAt = new Date(`${startDate}T12:00:00+08:00`).toISOString()
      endAt = new Date(`${startDate}T23:59:59+08:00`).toISOString()
    } else {
      startAt = new Date(`${startDate}T${startTime}:00+08:00`).toISOString()
      endAt = new Date(`${endDate}T${endTime}:00+08:00`).toISOString()
    }
    execute({ startAt, endAt, reason: reason.trim() || null })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline">
            <Plus className="mr-1 h-3.5 w-3.5" />
            新增不可用事件
          </Button>
        }
      />
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>新增不可用事件</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>類型</Label>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {(
                [
                  ['full', '全日休（可跨多日）'],
                  ['half-am', '半日休（上午）'],
                  ['half-pm', '半日休（下午）'],
                  ['custom', '自訂時間'],
                ] as const
              ).map(([val, label]) => (
                <button
                  type="button"
                  key={val}
                  onClick={() => setPreset(val)}
                  className={`rounded border p-2 ${
                    preset === val
                      ? 'border-blue-500 bg-blue-50 font-medium'
                      : 'border-slate-300 bg-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {preset === 'full' ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="from">起始日</Label>
                <Input
                  id="from"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="to">結束日</Label>
                <Input
                  id="to"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          ) : preset === 'custom' ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="cs-date">起始日</Label>
                <Input
                  id="cs-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cs-time">起始時間</Label>
                <Input
                  id="cs-time"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ce-date">結束日</Label>
                <Input
                  id="ce-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ce-time">結束時間</Label>
                <Input
                  id="ce-time"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="half-date">日期</Label>
              <Input
                id="half-date"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value)
                  setEndDate(e.target.value)
                }}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="reason">原因（選填）</Label>
            <Input
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="看醫生 / 休假 / 開會"
            />
          </div>

          <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            ℹ️ 若此時段內已有學員預約，建立後不會自動取消；行事曆會顯示 ⚠ 警示徽章，請自行決定是否取消。
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button onClick={submit} disabled={isPending}>
            {isPending ? '建立中...' : '建立'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function DeleteEventButton({ eventId }: { eventId: string }) {
  const { execute, isPending } = useAction(deleteUnavailableEventAction, {
    onSuccess: () => toast.success('已刪除'),
    onError: ({ error }) => toast.error(error.serverError?.message ?? '刪除失敗'),
  })
  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline" size="sm" disabled={isPending}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      }
      title="刪除此不可用事件？"
      description="刪除後該時段重新允許接受預約。"
      confirmLabel="刪除"
      variant="destructive"
      onConfirm={() => execute({ eventId })}
    />
  )
}
