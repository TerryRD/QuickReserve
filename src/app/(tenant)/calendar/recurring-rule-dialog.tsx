'use client'

import { useMemo, useState } from 'react'
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
import { createRecurringRuleAction } from './recurring-actions'

type Service = { id: string; name: string; duration_minutes: number }

type ConflictDetail = {
  id: string
  startAt: string
  endAt?: string
  serviceName?: string
}

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日']

export default function RecurringRuleDialog({ services }: { services: Service[] }) {
  const [open, setOpen] = useState(false)
  const [serviceId, setServiceId] = useState(services[0]?.id ?? '')
  const [freq, setFreq] = useState<'daily' | 'weekly' | 'monthly' | 'every_n_days'>('weekly')
  const [intervalN, setIntervalN] = useState('1')
  const [byWeekday, setByWeekday] = useState<number[]>([1, 3, 5]) // Mon Wed Fri default
  const [byMonthDay, setByMonthDay] = useState('1')

  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const [startDate, setStartDate] = useState(todayStr)
  const [startTime, setStartTime] = useState('19:00')
  const [endTime, setEndTime] = useState('21:00')

  const [endCondition, setEndCondition] = useState<'count' | 'until' | 'none'>('count')
  const [endCount, setEndCount] = useState('12')
  const [endUntil, setEndUntil] = useState('')

  const [conflicts, setConflicts] = useState<ConflictDetail[]>([])
  const [skipMode, setSkipMode] = useState(false)

  // Rough preview count (frontend approximation, real count computed server-side)
  const previewCount = useMemo(() => {
    if (freq === 'weekly') {
      const occPerWeek = byWeekday.length
      if (endCondition === 'count') return Number(endCount) || 0
      return occPerWeek * 12 // visual estimate
    }
    if (endCondition === 'count') return Number(endCount) || 0
    return 30 // fallback estimate
  }, [freq, byWeekday, endCondition, endCount])

  const { execute, isPending } = useAction(createRecurringRuleAction, {
    onSuccess: ({ data }) => {
      if (!data) return
      if (data.conflicts.length > 0 && !skipMode) {
        setConflicts(data.conflicts)
        toast.error(`有 ${data.conflicts.length} 個時段衝突`)
      } else {
        const parts = [`已建立 ${data.created} 個時段`]
        if (data.skipped > 0) parts.push(`略過 ${data.skipped} 個衝突`)
        if (data.skippedAvailability > 0)
          parts.push(`略過 ${data.skippedAvailability} 個不在作息時段內`)
        toast.success(parts.length > 1 ? `${parts[0]}（${parts.slice(1).join('、')}）` : parts[0]!)
        setConflicts([])
        setSkipMode(false)
        setOpen(false)
      }
    },
    onError: ({ error }) => {
      toast.error(error.serverError?.message ?? '建立失敗')
    },
  })

  function buildPayload(skipConflicts: boolean) {
    return {
      serviceId,
      freq,
      intervalN,
      byWeekday: freq === 'weekly' ? byWeekday : undefined,
      byMonthDay: freq === 'monthly' ? Number(byMonthDay) : undefined,
      startDate,
      startTime,
      endTime,
      endCondition,
      endCount: endCondition === 'count' ? Number(endCount) : undefined,
      endUntil: endCondition === 'until' ? endUntil : undefined,
      skipConflicts,
    }
  }

  function submit() {
    setSkipMode(false)
    setConflicts([])
    execute(buildPayload(false))
  }

  function submitSkip() {
    setSkipMode(true)
    execute(buildPayload(true))
  }

  function toggleWeekday(d: number) {
    setByWeekday((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort()))
  }

  function jumpToConflict(c: ConflictDetail) {
    const localDate = new Date(c.startAt)
    const yyyy = localDate.getFullYear()
    const mm = String(localDate.getMonth() + 1).padStart(2, '0')
    const dd = String(localDate.getDate()).padStart(2, '0')
    setOpen(false)
    window.location.href = `/calendar?week=${yyyy}-${mm}-${dd}&fromConflict=1`
  }

  if (services.length === 0) {
    return (
      <Button disabled variant="outline" title="請先新增服務">
        ⚡ 批量 / 重複
      </Button>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline">⚡ 批量 / 重複</Button>} />
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>批量建立 / 重複規則</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="service-r">服務</Label>
            <select
              id="service-r"
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
            <Label>重複方式</Label>
            <div className="grid grid-cols-4 gap-2 text-sm">
              {(
                [
                  ['daily', '每天'],
                  ['weekly', '每週'],
                  ['monthly', '每月'],
                  ['every_n_days', '每 N 天'],
                ] as const
              ).map(([val, label]) => (
                <button
                  type="button"
                  key={val}
                  onClick={() => setFreq(val)}
                  className={`rounded border p-2 ${
                    freq === val
                      ? 'border-blue-500 bg-blue-50 font-medium'
                      : 'border-slate-300 bg-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {(freq === 'daily' || freq === 'every_n_days') && (
            <div className="space-y-2">
              <Label htmlFor="interval">每 N {freq === 'daily' ? '' : '天'}</Label>
              <Input
                id="interval"
                type="number"
                min={1}
                value={intervalN}
                onChange={(e) => setIntervalN(e.target.value)}
                className="w-24"
              />
            </div>
          )}

          {freq === 'weekly' && (
            <div className="space-y-2">
              <Label>星期幾 (可複選)</Label>
              <div className="flex gap-2">
                {WEEKDAY_LABELS.map((label, idx) => {
                  const wd = idx + 1
                  const active = byWeekday.includes(wd)
                  return (
                    <button
                      type="button"
                      key={wd}
                      onClick={() => toggleWeekday(wd)}
                      className={`h-10 w-10 rounded-full text-sm font-medium ${
                        active
                          ? 'bg-blue-500 text-white'
                          : 'border border-slate-300 bg-white text-slate-700'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {freq === 'monthly' && (
            <div className="space-y-2">
              <Label htmlFor="month-day">每月第幾號</Label>
              <Input
                id="month-day"
                type="number"
                min={1}
                max={31}
                value={byMonthDay}
                onChange={(e) => setByMonthDay(e.target.value)}
                className="w-24"
              />
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="start-date-r">開始日期</Label>
              <Input
                id="start-date-r"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="start-r">開始時間</Label>
              <Input
                id="start-r"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-r">結束時間</Label>
              <Input
                id="end-r"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>何時結束</Label>
            <div className="flex gap-2 text-sm">
              {(
                [
                  ['count', 'N 次後'],
                  ['until', '截止日'],
                  ['none', '不限'],
                ] as const
              ).map(([val, label]) => (
                <button
                  type="button"
                  key={val}
                  onClick={() => setEndCondition(val)}
                  className={`rounded border px-3 py-1.5 ${
                    endCondition === val
                      ? 'border-blue-500 bg-blue-50 font-medium'
                      : 'border-slate-300 bg-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {endCondition === 'count' && (
              <Input
                type="number"
                min={1}
                value={endCount}
                onChange={(e) => setEndCount(e.target.value)}
                className="w-32"
                placeholder="次數"
              />
            )}
            {endCondition === 'until' && (
              <Input
                type="date"
                value={endUntil}
                onChange={(e) => setEndUntil(e.target.value)}
                className="w-48"
              />
            )}
            {endCondition === 'none' && (
              <p className="text-xs text-slate-500">每日 00:30 自動往前推 1 天（90 天滑動視窗）</p>
            )}
          </div>

          <div className="rounded border border-blue-200 bg-blue-50 p-3 text-sm">
            📋 預覽：將建立約 <strong>{previewCount}</strong> 個時段
          </div>

          {conflicts.length > 0 && (
            <div className="rounded border-2 border-red-300 bg-red-50 p-4">
              <p className="mb-2 font-semibold text-red-700">
                ⚠️ 與以下 {conflicts.length} 個既有時段衝突：
              </p>
              <ul className="max-h-40 space-y-2 overflow-y-auto text-xs">
                {conflicts.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between gap-2 rounded bg-white p-2"
                  >
                    <span>
                      {new Date(c.startAt).toLocaleString('zh-TW')}
                      {c.endAt && ` — ${new Date(c.endAt).toLocaleString('zh-TW')}`}
                      {c.serviceName ? ` (${c.serviceName})` : ''}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => jumpToConflict(c)}
                    >
                      跳轉去調整 →
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            取消
          </Button>
          {conflicts.length > 0 && (
            <Button variant="outline" onClick={submitSkip} disabled={isPending}>
              略過衝突日，建立其他
            </Button>
          )}
          <Button
            onClick={submit}
            disabled={isPending || (freq === 'weekly' && byWeekday.length === 0)}
          >
            {isPending ? '處理中...' : '建立'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
