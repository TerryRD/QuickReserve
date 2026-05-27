import { format } from 'date-fns'
import { requireTenantMember } from '@/lib/auth/get-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import UnavailableEventDialog, { DeleteEventButton } from './unavailable-event-dialog'

const TZ_OFFSET_HOURS = 8
const toLocal = (iso: string) =>
  new Date(new Date(iso).getTime() + TZ_OFFSET_HOURS * 3600 * 1000)

export default async function EventsSection() {
  const session = await requireTenantMember()
  const supabase = await createSupabaseServerClient()

  const now = new Date().toISOString()
  const { data: events } = await supabase
    .from('unavailable_events')
    .select('id, start_at, end_at, reason')
    .eq('member_id', session.memberId)
    .gte('end_at', now)
    .order('start_at', { ascending: true })

  return (
    <div className="space-y-3">
      <UnavailableEventDialog />

      {(events ?? []).length === 0 ? (
        <div className="rounded-2xl border border-border bg-muted p-6 text-center">
          <p className="font-cjk text-sm text-muted-foreground">尚無未來不可用事件</p>
        </div>
      ) : (
        <div className="divide-y divide-border rounded-2xl border border-border bg-card">
          {(events ?? []).map((e) => {
            const s = toLocal(e.start_at)
            const en = toLocal(e.end_at)
            const sameDay = format(s, 'yyyy-MM-dd') === format(en, 'yyyy-MM-dd')
            const label = sameDay
              ? `${format(s, 'yyyy/MM/dd HH:mm')}–${format(en, 'HH:mm')}`
              : `${format(s, 'yyyy/MM/dd HH:mm')} – ${format(en, 'yyyy/MM/dd HH:mm')}`
            return (
              <div key={e.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="font-cjk text-sm font-medium">{label}</div>
                  {e.reason && (
                    <div className="font-cjk mt-0.5 text-xs text-muted-foreground">{e.reason}</div>
                  )}
                </div>
                <DeleteEventButton eventId={e.id} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
