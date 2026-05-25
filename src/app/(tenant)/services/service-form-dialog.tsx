'use client'

import { useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
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
import { createServiceAction, updateServiceAction } from './actions'

type Service = {
  id: string
  name: string
  description: string | null
  duration_minutes: number
  price: number | null
  is_active: boolean
  max_capacity?: number
  min_attendance?: number
  cancel_deadline_hours?: number
}

type Props = { mode: 'create'; service?: undefined } | { mode: 'edit'; service: Service }

export default function ServiceFormDialog(props: Props) {
  const isEdit = props.mode === 'edit'
  const initial = props.service
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [durationMinutes, setDurationMinutes] = useState(String(initial?.duration_minutes ?? 60))
  const [price, setPrice] = useState(
    initial?.price !== undefined && initial?.price !== null ? String(initial.price) : '',
  )
  const [isActive, setIsActive] = useState(initial?.is_active ?? true)
  const [maxCapacity, setMaxCapacity] = useState(String(initial?.max_capacity ?? 1))
  const [minAttendance, setMinAttendance] = useState(String(initial?.min_attendance ?? 1))
  const [cancelDeadlineHours, setCancelDeadlineHours] = useState(
    String(initial?.cancel_deadline_hours ?? 24),
  )

  const onSuccess = () => {
    toast.success(isEdit ? '已更新' : '已新增')
    setOpen(false)
  }
  const onError = ({ error }: { error: { serverError?: { message?: string } } }) =>
    toast.error(error.serverError?.message ?? '失敗')

  const createMut = useAction(createServiceAction, { onSuccess, onError })
  const updateMut = useAction(updateServiceAction, { onSuccess, onError })
  const isPending = createMut.isPending || updateMut.isPending

  function submit() {
    const payload = {
      name,
      description: description || null,
      durationMinutes,
      price: price === '' ? null : price,
      maxCapacity,
      minAttendance,
      cancelDeadlineHours,
    }
    if (isEdit) updateMut.execute({ ...payload, id: initial!.id, isActive })
    else createMut.execute(payload)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant={isEdit ? 'ghost' : 'default'} size={isEdit ? 'sm' : 'default'}>
            {isEdit ? '編輯' : '+ 新增服務'}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? '編輯服務' : '新增服務'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">名稱</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">描述</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="duration">時長 (分)</Label>
              <Input
                id="duration"
                type="number"
                min={1}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="price">價格 (可空)</Label>
              <Input
                id="price"
                type="number"
                min={0}
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2 rounded border border-dashed p-3">
            <Label className="text-sm font-medium">團班設定（預設 1 對 1）</Label>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label htmlFor="svc-capacity" className="text-xs">
                  最大人數
                </Label>
                <Input
                  id="svc-capacity"
                  type="number"
                  min={1}
                  value={maxCapacity}
                  onChange={(e) => setMaxCapacity(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="svc-min" className="text-xs">
                  最少人數
                </Label>
                <Input
                  id="svc-min"
                  type="number"
                  min={1}
                  value={minAttendance}
                  onChange={(e) => setMinAttendance(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="svc-deadline" className="text-xs">
                  取消截止 (小時)
                </Label>
                <Input
                  id="svc-deadline"
                  type="number"
                  min={1}
                  value={cancelDeadlineHours}
                  onChange={(e) => setCancelDeadlineHours(e.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              達最少人數時自動確認；過取消截止 (slot 開始前 N 小時) 仍不足、自動取消並退課數。
            </p>
          </div>
          {isEdit && (
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border bg-muted/30 p-3">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-primary"
              />
              <span className="text-sm">
                <strong>啟用此服務</strong>
                <span className="block text-xs text-muted-foreground">
                  停用後，公開預約頁不會顯示，但既有預約保留
                </span>
              </span>
            </label>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button onClick={submit} disabled={isPending}>
            {isPending ? '儲存中...' : '儲存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
