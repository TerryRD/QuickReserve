'use client'

import { useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateNotificationPreferencesAction } from './actions'

type Prefs = {
  weekly_summary_enabled: boolean
  daily_reminder_enabled: boolean
  daily_reminder_hour: number
  pre_event_enabled: boolean
  pre_event_minutes: number[]
  booking_status_changes_enabled: boolean
}

const AVAILABLE_PRE_EVENT_OPTIONS = [5, 10, 15, 30, 60, 1440]

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 rounded-full transition-colors ${
        checked ? 'bg-emerald-500' : 'bg-slate-300'
      }`}
    >
      <div
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

export default function PreferencesForm({ initial }: { initial: Prefs }) {
  const [weeklySummary, setWeeklySummary] = useState(initial.weekly_summary_enabled)
  const [dailyReminder, setDailyReminder] = useState(initial.daily_reminder_enabled)
  const [dailyReminderHour, setDailyReminderHour] = useState(initial.daily_reminder_hour)
  const [preEventEnabled, setPreEventEnabled] = useState(initial.pre_event_enabled)
  const [preEventMinutes, setPreEventMinutes] = useState<number[]>(
    initial.pre_event_minutes ?? [30],
  )
  const [bookingStatusChanges, setBookingStatusChanges] = useState(
    initial.booking_status_changes_enabled,
  )

  const { execute, isPending } = useAction(updateNotificationPreferencesAction, {
    onSuccess: () => toast.success('已儲存'),
    onError: ({ error }) => toast.error(error.serverError?.message ?? '儲存失敗'),
  })

  function togglePreEvent(m: number) {
    setPreEventMinutes((cur) =>
      cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m].sort((a, b) => a - b),
    )
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault()
        execute({
          weeklySummary,
          dailyReminder,
          dailyReminderHour,
          preEventEnabled,
          preEventMinutes,
          bookingStatusChanges,
        })
      }}
    >
      <Row
        title="每週日 20:00 收到下週預覽"
        subtitle="看到下週所有預約安排"
        checked={weeklySummary}
        onChange={setWeeklySummary}
      />

      <Row
        title="每天早晨提醒今日行程"
        subtitle="可調整時間 06:00–12:00"
        checked={dailyReminder}
        onChange={setDailyReminder}
      >
        {dailyReminder && (
          <div className="flex items-center gap-2 pt-2">
            <Label htmlFor="hour" className="text-sm">
              提醒時間：
            </Label>
            <Input
              id="hour"
              type="number"
              min={6}
              max={12}
              value={dailyReminderHour}
              onChange={(e) => setDailyReminderHour(Number(e.target.value))}
              className="w-20"
            />
            <span className="text-sm text-slate-500">：00</span>
          </div>
        )}
      </Row>

      <Row
        title="預約前提醒"
        subtitle="可勾選多個時間點"
        checked={preEventEnabled}
        onChange={setPreEventEnabled}
      >
        {preEventEnabled && (
          <div className="flex flex-wrap gap-2 pt-2">
            {AVAILABLE_PRE_EVENT_OPTIONS.map((m) => {
              const active = preEventMinutes.includes(m)
              const label = m >= 60 ? (m === 1440 ? '1 天前' : `${m / 60} 小時前`) : `${m} 分前`
              return (
                <button
                  type="button"
                  key={m}
                  onClick={() => togglePreEvent(m)}
                  className={`rounded border px-3 py-1 text-xs ${
                    active ? 'border-blue-500 bg-blue-50 font-medium' : 'border-slate-300 bg-white'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        )}
      </Row>

      <Row
        title="預約狀態變更立即通知"
        subtitle="新預約、確認、取消"
        checked={bookingStatusChanges}
        onChange={setBookingStatusChanges}
      />

      <Button type="submit" disabled={isPending}>
        {isPending ? '儲存中...' : '儲存設定'}
      </Button>
    </form>
  )
}

function Row({
  title,
  subtitle,
  checked,
  onChange,
  children,
}: {
  title: string
  subtitle: string
  checked: boolean
  onChange: (v: boolean) => void
  children?: React.ReactNode
}) {
  return (
    <div className="border-b pb-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-medium">{title}</div>
          <div className="mt-1 text-xs text-slate-500">{subtitle}</div>
        </div>
        <Toggle checked={checked} onChange={onChange} />
      </div>
      {children}
    </div>
  )
}
