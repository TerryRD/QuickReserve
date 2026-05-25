import { addDays, format, startOfDay } from 'date-fns'
import { requireTenantMember } from '@/lib/auth/get-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  fetchActiveTemplate,
  fetchUnavailableEvents,
} from '@/lib/availability-server'
import { effectiveAvailability } from '@/lib/availability'

const TZ_OFFSET_HOURS = 8
const PREVIEW_DAYS = 14

const WEEKDAY_LABEL = ['日', '一', '二', '三', '四', '五', '六']

export default async function EffectivePreview() {
  const session = await requireTenantMember()
  const supabase = await createSupabaseServerClient()

  const today = startOfDay(new Date())
  const rangeEnd = addDays(today, PREVIEW_DAYS)

  const template = await fetchActiveTemplate(supabase, session.memberId, today)
  const events = await fetchUnavailableEvents(supabase, session.memberId, today, rangeEnd)

  const days = Array.from({ length: PREVIEW_DAYS }, (_, i) => addDays(today, i))

  return (
    <div className="rounded-xl border bg-card p-4">
      {template === null ? (
        <p className="text-xs text-muted-foreground">
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
            const jsDay = d.getDay()
            return (
              <div key={d.toISOString()} className="flex items-center gap-3 text-sm">
                <div className="w-24 shrink-0 font-mono text-xs">
                  {format(d, 'MM/dd')}（{WEEKDAY_LABEL[jsDay]}）
                </div>
                <div className="flex-1">
                  {ranges.length === 0 ? (
                    <span className="text-xs text-muted-foreground">休</span>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {ranges.map((r, idx) => (
                        <span
                          key={idx}
                          className="rounded bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800"
                        >
                          {format(r.start, 'HH:mm')}–{format(r.end, 'HH:mm')}
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
