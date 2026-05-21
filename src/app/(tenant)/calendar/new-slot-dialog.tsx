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
import { createSlotAction } from './actions'

type Service = { id: string; name: string; duration_minutes: number }

type ConflictDetail = {
  id: string
  startAt: string
  endAt: string
  serviceName?: string
}

export default function NewSlotDialog({
  services,
  weekStart,
}: {
  services: Service[]
  weekStart: string
}) {
  const defaultDate = weekStart.slice(0, 10)
  const [open, setOpen] = useState(false)
  const [serviceId, setServiceId] = useState(services[0]?.id ?? '')
  const [date, setDate] = useState(defaultDate)
  const [startTime, setStartTime] = useState('19:00')
  const [endTime, setEndTime] = useState('20:00')
  const [conflicts, setConflicts] = useState<ConflictDetail[]>([])

  const { execute, isPending } = useAction(createSlotAction, {
    onSuccess: () => {
      toast.success('已新增時段')
      setConflicts([])
      setOpen(false)
    },
    onError: ({ error }) => {
      const code = error.serverError?.code
      if (code === 'SLOT_CONFLICT') {
        setConflicts((error.serverError?.details ?? []) as ConflictDetail[])
        toast.error('與既有時段衝突')
      } else {
        toast.error(error.serverError?.message ?? '新增失敗')
      }
    },
  })

  function submit() {
    const startAt = `${date}T${startTime}:00+08:00`
    const endAt = `${date}T${endTime}:00+08:00`
    execute({
      serviceId,
      startAt: new Date(startAt).toISOString(),
      endAt: new Date(endAt).toISOString(),
    })
  }

  if (services.length === 0) {
    return (
      <Button disabled title="請先新增服務">
        + 新增時段
      </Button>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>+ 新增時段</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新增可預約時段</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="service">服務</Label>
            <select
              id="service"
              className="w-full rounded border p-2 text-sm"
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
            >
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.duration_minutes} 分)
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="date">日期</Label>
            <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="start">開始</Label>
              <Input
                id="start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end">結束</Label>
              <Input
                id="end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>
          {conflicts.length > 0 && (
            <div className="rounded border border-red-300 bg-red-50 p-3 text-xs">
              <p className="mb-2 font-semibold text-red-700">與以下時段衝突：</p>
              <ul className="space-y-1">
                {conflicts.map((c) => (
                  <li key={c.id}>
                    {new Date(c.startAt).toLocaleString('zh-TW')} —{' '}
                    {new Date(c.endAt).toLocaleString('zh-TW')}
                    {c.serviceName ? ` (${c.serviceName})` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button onClick={submit} disabled={isPending}>
            {isPending ? '新增中...' : '新增'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
