// src/app/(tenant)/settings/notifications/page.tsx
import { requireTenantMember } from '@/lib/auth/get-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { Kicker } from '@/components/ui/kicker'
import { SubNav } from '@/components/shell/sub-nav'
import { SectionHead } from '@/components/ui/section-head'
import PushOptIn from '@/components/push-opt-in'
import NotificationPrefsForm from './notification-prefs-form'
import type { NotificationPrefs } from '@/components/settings/notification-matrix'

const SETTINGS_NAV_ITEMS = [
  { href: '/settings/profile', label: '公開頁', eng: 'PROFILE' },
  { href: '/settings/notifications', label: '通知', eng: 'NOTIF' },
  { href: '/calendar/availability', label: '作息', eng: 'AVAILABILITY' },
  { href: '/calendar/rules', label: '重複', eng: 'RULES' },
]

const EVENTS: { key: string; label: string }[] = [
  { key: 'booking_created', label: '新預約' },
  { key: 'booking_confirmed', label: '預約已確認' },
  { key: 'booking_cancelled', label: '預約取消' },
  { key: 'booking_rescheduled', label: '預約改期' },
  { key: 'package_request', label: '套裝申請' },
  { key: 'package_approved', label: '套裝核准' },
  { key: 'pre_event', label: '課前提醒' },
  { key: 'daily_reminder', label: '每日提醒' },
  { key: 'weekly_summary', label: '每週摘要' },
]

const DEFAULT_CHANNELS: NotificationPrefs = {
  web_push: Object.fromEntries(EVENTS.map((e) => [e.key, true])),
  in_app: Object.fromEntries(EVENTS.map((e) => [e.key, true])),
}

function deviceLabelFromUA(ua: string | null): string {
  if (!ua) return '未知裝置'
  // OS
  let os = ''
  if (/iphone/i.test(ua)) os = 'iPhone'
  else if (/ipad/i.test(ua)) os = 'iPad'
  else if (/android/i.test(ua)) os = 'Android'
  else if (/macintosh|mac os x/i.test(ua)) os = 'Mac'
  else if (/windows/i.test(ua)) os = 'Windows'
  else if (/linux/i.test(ua)) os = 'Linux'
  // Browser
  let browser = ''
  if (/edg\//i.test(ua)) browser = 'Edge'
  else if (/chrome\//i.test(ua)) browser = 'Chrome'
  else if (/firefox\//i.test(ua)) browser = 'Firefox'
  else if (/safari\//i.test(ua)) browser = 'Safari'
  if (os && browser) return `${os} · ${browser}`
  if (os) return os
  if (browser) return browser
  return ua.split(' ')[0] ?? '未知裝置'
}

export default async function SettingsNotificationsPage() {
  const session = await requireTenantMember()
  const supabase = await createSupabaseServerClient()

  const [{ data: prefs }, { data: deviceRows }, { data: tenantRow }] = await Promise.all([
    supabase
      .from('notification_preferences')
      .select('channels, quiet_hours_start, quiet_hours_end')
      .eq('user_id', session.userId)
      .maybeSingle(),
    supabase
      .from('push_subscriptions')
      .select('id, user_agent, last_used_at')
      .eq('user_id', session.userId)
      .order('last_used_at', { ascending: false }),
    supabase
      .from('tenants')
      .select('checkin_reminder_minutes')
      .eq('id', session.tenantId)
      .maybeSingle(),
  ])

  const channelsRaw = prefs?.channels as
    | Partial<Record<keyof NotificationPrefs, Record<string, boolean>>>
    | null
    | undefined
  // Merge with defaults so newly added event keys default to `true` even if the
  // row was written when only a subset of events existed.
  const channels: NotificationPrefs = {
    web_push: { ...DEFAULT_CHANNELS.web_push, ...(channelsRaw?.web_push ?? {}) },
    in_app: { ...DEFAULT_CHANNELS.in_app, ...(channelsRaw?.in_app ?? {}) },
  }
  const quietStart = prefs?.quiet_hours_start ?? null
  const quietEnd = prefs?.quiet_hours_end ?? null

  const devices = (deviceRows ?? []).map((d) => ({
    id: d.id,
    label: deviceLabelFromUA(d.user_agent),
    ua: d.user_agent,
    last_used_at: d.last_used_at,
  }))

  return (
    <div className="space-y-7 pb-12">
      <div>
        <Kicker>SETTINGS · 教練設定</Kicker>
        <h1 className="font-display font-cjk mt-2 text-3xl font-black uppercase sm:text-4xl">
          通知偏好
        </h1>
        <p className="font-cjk mt-2 text-sm text-muted-foreground">
          選擇哪些事件要透過推播 / 站內通知,並設定勿擾時段
        </p>
      </div>

      <SubNav items={SETTINGS_NAV_ITEMS} active="/settings/notifications" />

      {/* Web Push subscription card (this device) */}
      <section>
        <SectionHead
          kicker="WEB PUSH · 推播訂閱"
          title="此裝置訂閱"
          eng="THIS DEVICE"
          hint="允許瀏覽器在背景接收提醒"
        />
        <PushOptIn />
      </section>

      {/* Device list + Matrix + Quiet hours (client form) */}
      <NotificationPrefsForm
        events={EVENTS}
        devices={devices}
        initialChannels={channels}
        initialQuietStart={quietStart}
        initialQuietEnd={quietEnd}
        checkinReminderMinutes={tenantRow?.checkin_reminder_minutes ?? null}
        isOwner={session.role === 'tenant_owner'}
      />
    </div>
  )
}
