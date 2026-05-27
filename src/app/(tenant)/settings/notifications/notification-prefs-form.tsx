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
}: {
  events: { key: string; label: string }[]
  devices: DeviceRow[]
  initialChannels: NotificationPrefs
  initialQuietStart: string | null
  initialQuietEnd: string | null
}) {
  const [channels, setChannels] = useState<NotificationPrefs>(initialChannels)
  const [quietStart, setQuietStart] = useState<string | null>(initialQuietStart)
  const [quietEnd, setQuietEnd] = useState<string | null>(initialQuietEnd)
  const [savedAt, setSavedAt] = useState<Date | null>(null)

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
