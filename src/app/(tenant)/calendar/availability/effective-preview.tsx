import { requireTenantMember } from '@/lib/auth/get-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { fetchActiveTemplate, fetchUnavailableEvents } from '@/lib/availability-server'
import { effectiveAvailability } from '@/lib/availability'
import { formatTaipeiTime, taipeiDateKey, taipeiDayStart, taipeiParts } from '@/lib/taipei-time'

const TZ_OFFSET_HOURS = 8
const PREVIEW_DAYS = 14
// 台灣無日光節約，一天固定 24 小時
const DAY_MS = 86400000

const pad = (n: number) => String(n).padStart(2, '0')

export default async function EffectivePreview() {
  const session = await requireTenantMember()
  const supabase = await createSupabaseServerClient()

  // 台灣今天 00:00
  const today = taipeiDayStart(taipeiDateKey(new Date()))
  const rangeEnd = new Date(today.getTime() + PREVIEW_DAYS * DAY_MS)

  const template = await fetchActiveTemplate(supabase, session.memberId, today)
  const events = await fetchUnavailableEvents(supabase, session.memberId, today, rangeEnd)

  const days = Array.from(
    { length: PREVIEW_DAYS },
    (_, i) => new Date(today.getTime() + i * DAY_MS),
  )

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      {template === null ? (
        <p className="font-cjk text-sm text-muted-foreground">
          目前未指定生效模板。所有時段不受作息限制；學員端只看實際存在的 slot。
        </p>
      ) : (
        <div className="space-y-2">
          {days.map((d) => {
            const ranges = effectiveAvailability({
              date: d,
              activeTemplate: template,
              unavailableEvents: events,
              tzOffsetHours: TZ_OFFSET_HOURS,
            })
            const p = taipeiParts(d)
            return (
              <div key={d.toISOString()} className="flex items-center gap-3 text-sm">
                <div className="w-24 shrink-0 font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  {pad(p.month)}/{pad(p.day)}（{p.weekday}）
                </div>
                <div className="flex-1">
                  {ranges.length === 0 ? (
                    <span className="font-cjk text-xs text-muted-foreground">休</span>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {ranges.map((r, idx) => (
                        <span
                          key={idx}
                          className="font-mono rounded-md border border-border bg-muted px-2 py-0.5 text-xs text-foreground"
                        >
                          {formatTaipeiTime(r.start)}–{formatTaipeiTime(r.end)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
