'use client'

import { useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import {
  NotificationMatrix,
  type NotificationChannel,
  type NotificationPrefs,
} from '@/components/settings/notification-matrix'
import { QuietHoursInput } from '@/components/settings/quiet-hours-input'
import { SectionHead } from '@/components/ui/section-head'
import { Button } from '@/components/ui/button'
import {
  saveNotificationPrefsAction,
  removePushDeviceAction,
  updateCheckinReminderAction,
} from './actions'

type DeviceRow = {
  id: string
  label: string
  ua: string | null
  last_used_at: string | null
}

export default function NotificationPrefsForm({
  events,
  devices,
  initialChannels,
  initialQuietStart,
  initialQuietEnd,
  checkinReminderMinutes,
  isOwner,
}: {
  events: { key: string; label: string }[]
  devices: DeviceRow[]
  initialChannels: NotificationPrefs
  initialQuietStart: string | null
  initialQuietEnd: string | null
  checkinReminderMinutes: number | null
  isOwner: boolean
}) {
  const [channels, setChannels] = useState<NotificationPrefs>(initialChannels)
  const [quietStart, setQuietStart] = useState<string | null>(initialQuietStart)
  const [quietEnd, setQuietEnd] = useState<string | null>(initialQuietEnd)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [checkinEnabled, setCheckinEnabled] = useState(checkinReminderMinutes !== null)
  const [checkinMinutes, setCheckinMinutes] = useState<number>(checkinReminderMinutes ?? 15)

  const { execute: executeSave, isPending: savePending } = useAction(
    saveNotificationPrefsAction,
    {
      onSuccess: () => {
        setSavedAt(new Date())
        toast.success('已儲存通知偏好')
      },
      onError: ({ error }) =>
        toast.error(error.serverError?.message ?? '儲存失敗'),
    },
  )

  const { execute: saveCheckin, isPending: checkinPending } = useAction(
    updateCheckinReminderAction,
    {
      onSuccess: () => toast.success('已更新簽到提醒設定'),
      onError: ({ error }) =>
        toast.error(error.serverError?.message ?? '更新失敗'),
    },
  )

  const { execute: executeRemove, isPending: removePending } = useAction(
    removePushDeviceAction,
    {
      onSuccess: () => toast.success('已移除裝置'),
      onError: ({ error }) =>
        toast.error(error.serverError?.message ?? '移除失敗'),
    },
  )

  const onToggle = (
    channel: NotificationChannel,
    eventKey: string,
    next: boolean,
  ) => {
    setChannels((prev) => ({
      ...prev,
      [channel]: { ...prev[channel], [eventKey]: next },
    }))
  }

  const onQuietHoursChange = (next: {
    start: string | null
    end: string | null
  }) => {
    setQuietStart(next.start)
    setQuietEnd(next.end)
  }

  const onSave = () => {
    // Strip seconds if the DB returned HH:MM:SS — schema accepts both, but
    // normalise to HH:MM so the value round-trips cleanly through <input type="time">.
    const normalise = (v: string | null) => (v ? v.slice(0, 5) : null)
    executeSave({
      channels,
      quiet_hours_start: normalise(quietStart),
      quiet_hours_end: normalise(quietEnd),
    })
  }

  return (
    <>
      {/* Device list */}
      <section>
        <SectionHead
          kicker="DEVICES · 已訂閱裝置"
          title="所有裝置"
          eng="DEVICES"
          hint="已訂閱推播的裝置清單。移除後該裝置不再收到推播。"
        />
        {devices.length === 0 ? (
          <div className="font-cjk rounded-2xl border border-dashed border-border bg-muted/40 p-6 text-center text-sm text-muted-foreground">
            尚無訂閱裝置 — 請先在上方「此裝置訂閱」啟用推播
          </div>
        ) : (
          <ul className="space-y-2">
            {devices.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-[0_8px_24px_-18px_rgba(0,0,0,0.18)]"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-cjk truncate text-sm font-semibold">
                    {d.label}
                  </div>
                  <div className="font-mono mt-0.5 text-xs text-muted-foreground">
                    最後使用{' '}
                    {d.last_used_at
                      ? new Date(d.last_used_at).toLocaleString('zh-TW')
                      : '—'}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={removePending}
                  onClick={() => executeRemove({ id: d.id })}
                  className="text-destructive"
                >
                  <Trash2 className="size-3.5" />
                  移除
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Matrix */}
      <section>
        <SectionHead
          kicker="CHANNELS · 通道矩陣"
          title="事件 × 通道"
          eng="MATRIX"
          hint="每個事件可獨立勾選要透過哪個通道通知 (Email 不在 Phase 1 範圍)"
        />
        <NotificationMatrix
          events={events}
          prefs={channels}
          onToggle={onToggle}
        />
      </section>

      {/* Quiet hours */}
      <section>
        <SectionHead
          kicker="DND · 勿擾時段"
          title="勿擾時段"
          eng="QUIET HOURS"
          hint="勿擾時段內推播會延後到結束時段後發送"
        />
        <QuietHoursInput
          start={quietStart}
          end={quietEnd}
          onChange={onQuietHoursChange}
        />
      </section>

      {/* Checkin reminder (owner-only) */}
      {isOwner && (
        <section>
          <SectionHead
            kicker="CHECKIN · 課前提醒"
            title="課前簽到提醒"
            eng="PRE-CLASS REMINDER"
            hint="開課前提醒學員完成簽到，適用於整個工作室"
          />
          <div className="rounded-2xl border border-border bg-card p-5">
            <label className="flex items-center gap-2 font-cjk text-sm font-semibold">
              <input
                type="checkbox"
                checked={checkinEnabled}
                disabled={checkinPending}
                onChange={(e) => {
                  const next = e.target.checked
                  setCheckinEnabled(next)
                  saveCheckin({ minutes: next ? checkinMinutes : null })
                }}
                className="size-4 accent-foreground"
              />
              課前提醒學員簽到
            </label>
            {checkinEnabled && (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <input
                  type="number"
                  min={1}
                  max={180}
                  step={1}
                  value={checkinMinutes}
                  disabled={checkinPending}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10)
                    if (!isNaN(val) && val >= 1 && val <= 180) {
                      setCheckinMinutes(val)
                    }
                  }}
                  onBlur={(e) => {
                    const val = parseInt(e.target.value, 10)
                    const clamped = isNaN(val) ? 15 : Math.min(180, Math.max(1, val))
                    setCheckinMinutes(clamped)
                    saveCheckin({ minutes: clamped })
                  }}
                  className="font-mono w-20 rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-40"
                />
                <span className="font-cjk text-sm text-muted-foreground">分鐘前</span>
              </div>
            )}
            <p className="font-cjk mt-3 text-xs text-muted-foreground">
              預設 15 分鐘；關閉則不提醒。
            </p>
          </div>
        </section>
      )}

      {/* Save bar */}
      <div className="flex items-center justify-end gap-3 pt-2">
        {savedAt && !savePending && (
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            已儲存 {savedAt.toLocaleTimeString('zh-TW')}
          </span>
        )}
        <Button
          type="button"
          variant="default"
          size="pill"
          withArrow="inline"
          onClick={onSave}
          disabled={savePending}
        >
          {savePending ? '儲存中…' : '儲存設定'}
        </Button>
      </div>
    </>
  )
}
