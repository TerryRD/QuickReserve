import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { Repeat, ArrowLeft, Calendar } from 'lucide-react'
import { requireTenantMember } from '@/lib/auth/get-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { buttonVariants } from '@/components/ui/button'
import { RuleToggle, RuleDeleteButton } from './rule-row-actions'

const WEEKDAY_LABEL = ['', '一', '二', '三', '四', '五', '六', '日']

function describeRule(r: {
  freq: string
  interval_n: number
  by_weekday: number[] | null
  by_month_day: number | null
}): string {
  if (r.freq === 'daily') {
    return r.interval_n === 1 ? '每天' : `每 ${r.interval_n} 天`
  }
  if (r.freq === 'every_n_days') {
    return `每 ${r.interval_n} 天`
  }
  if (r.freq === 'weekly') {
    const days = (r.by_weekday ?? []).map((w) => WEEKDAY_LABEL[w] ?? '?').join('、')
    return r.interval_n === 1 ? `每週 ${days}` : `每 ${r.interval_n} 週的 ${days}`
  }
  if (r.freq === 'monthly') {
    return r.interval_n === 1
      ? `每月 ${r.by_month_day} 號`
      : `每 ${r.interval_n} 月 ${r.by_month_day} 號`
  }
  return r.freq
}

function describeEnd(r: {
  end_condition: string
  end_count: number | null
  end_until: string | null
}): string {
  if (r.end_condition === 'count') return `共 ${r.end_count} 次`
  if (r.end_condition === 'until' && r.end_until)
    return `至 ${format(parseISO(r.end_until), 'yyyy/MM/dd')}`
  return '無限期（90 天滑動視窗）'
}

export default async function RecurringRulesPage() {
  const session = await requireTenantMember()
  const supabase = await createSupabaseServerClient()

  // Owner sees all; Staff sees own only
  let query = supabase
    .from('recurring_rules')
    .select(
      'id, freq, interval_n, by_weekday, by_month_day, start_time, end_time, start_date, end_condition, end_count, end_until, is_active, member_id, services(name), tenant_members(role, invited_email)',
    )
    .eq('tenant_id', session.tenantId)
    .order('created_at', { ascending: false })
  if (session.role !== 'tenant_owner') query = query.eq('member_id', session.memberId)
  const { data: rules } = await query

  // Count slots per rule (active only, future)
  const ruleIds = (rules ?? []).map((r) => r.id)
  const slotCounts: Record<string, number> = {}
  if (ruleIds.length) {
    const { data: slots } = await supabase
      .from('availability_slots')
      .select('recurring_rule_id')
      .in('recurring_rule_id', ruleIds)
      .gte('start_at', new Date().toISOString())
      .neq('status', 'cancelled')
    for (const s of slots ?? []) {
      if (s.recurring_rule_id)
        slotCounts[s.recurring_rule_id] = (slotCounts[s.recurring_rule_id] ?? 0) + 1
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/calendar"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          回行事曆
        </Link>
        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">CALENDAR · 重複規則</div>
        <h1 className="font-display mt-2 text-3xl uppercase">
          重複<span className="font-cjk">規則</span>
        </h1>
        <p className="font-cjk mt-1 text-sm text-muted-foreground">管理「批量 / 重複」建立的所有規則</p>
      </div>

      {!rules || rules.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center">
          <Repeat className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 font-medium">尚無重複規則</p>
          <p className="mt-1 text-sm text-muted-foreground">
            在行事曆按「⚡ 批量 / 重複」建立第一個規則
          </p>
          <Link
            href="/calendar"
            className={buttonVariants({ variant: 'outline', size: 'sm' }) + ' mt-6'}
          >
            前往行事曆
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((r) => {
            const svc = r.services as { name: string } | null
            const member = r.tenant_members as {
              role: string
              invited_email: string | null
            } | null
            const memberLabel =
              member?.role === 'owner' ? 'Owner' : (member?.invited_email ?? 'Staff')
            return (
              <div
                key={r.id}
                className={`rounded-2xl border border-border bg-card p-5${r.is_active ? '' : ' opacity-60'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-xl italic">{svc?.name ?? '—'}</h3>
                      {session.role === 'tenant_owner' && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase text-muted-foreground">
                          {memberLabel}
                        </span>
                      )}
                      {!r.is_active && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase text-muted-foreground">
                          停用中
                        </span>
                      )}
                    </div>
                    <div className="mt-2 grid gap-1 text-sm text-foreground/80 sm:grid-cols-2">
                      <div>
                        <span className="text-muted-foreground">時間：</span>
                        {describeRule(r)} {r.start_time?.slice(0, 5)}–{r.end_time?.slice(0, 5)}
                      </div>
                      <div>
                        <span className="text-muted-foreground">起：</span>
                        {format(parseISO(r.start_date), 'yyyy/MM/dd')}
                      </div>
                      <div>
                        <span className="text-muted-foreground">結束：</span>
                        {describeEnd(r)}
                      </div>
                      <div>
                        <span className="text-muted-foreground">未來時段：</span>
                        <span className="inline-flex items-center gap-1 font-medium">
                          <Calendar className="h-3.5 w-3.5" />
                          {slotCounts[r.id] ?? 0} 個
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <RuleToggle ruleId={r.id} isActive={r.is_active} />
                    <RuleDeleteButton ruleId={r.id} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
