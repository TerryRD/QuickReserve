import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import {
  Repeat,
  ArrowLeft,
  Calendar as CalendarIcon,
  Sparkles,
  Hash,
  Star,
} from 'lucide-react'
import { requireTenantMember } from '@/lib/auth/get-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { buttonVariants } from '@/components/ui/button'
import { Kicker } from '@/components/ui/kicker'
import { SubNav } from '@/components/shell/sub-nav'
import { RuleToggle, RuleDeleteButton } from './rule-row-actions'

const SETTINGS_NAV_ITEMS = [
  { href: '/settings/profile', label: '公開頁', eng: 'PROFILE' },
  { href: '/settings/notifications', label: '通知', eng: 'NOTIF' },
  { href: '/calendar/availability', label: '作息', eng: 'AVAILABILITY' },
  { href: '/calendar/rules', label: '重複', eng: 'RULES' },
]

const WEEKDAY_LABEL = ['', '一', '二', '三', '四', '五', '六', '日']

function freqKicker(freq: string): { code: string; cjk: string } {
  switch (freq) {
    case 'daily':
      return { code: 'DAILY', cjk: '每天' }
    case 'every_n_days':
      return { code: 'EVERY-N', cjk: '每 N 天' }
    case 'weekly':
      return { code: 'WEEKLY', cjk: '每週' }
    case 'monthly':
      return { code: 'MONTHLY', cjk: '每月' }
    default:
      return { code: freq.toUpperCase(), cjk: freq }
  }
}

function freqIcon(freq: string) {
  switch (freq) {
    case 'daily':
      return <Sparkles className="size-4" />
    case 'weekly':
      return <CalendarIcon className="size-4" />
    case 'monthly':
      return <Star className="size-4" />
    case 'every_n_days':
      return <Hash className="size-4" />
    default:
      return <Repeat className="size-4" />
  }
}

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
    <div className="space-y-7 pb-12">
      <div>
        <Link
          href="/calendar"
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          回行事曆
        </Link>
        <Kicker>SETTINGS · 教練設定</Kicker>
        <h1 className="font-display font-cjk mt-2 text-3xl font-black uppercase sm:text-4xl">
          重複規則
        </h1>
        <p className="font-cjk mt-2 text-sm text-muted-foreground">
          管理「批量 / 重複」建立的所有規則
        </p>
      </div>

      <SubNav items={SETTINGS_NAV_ITEMS} active="/calendar/rules" />

      {!rules || rules.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
          <Repeat className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="font-cjk mt-3 font-medium">尚無重複規則</p>
          <p className="font-cjk mt-1 text-sm text-muted-foreground">
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
            const kicker = freqKicker(r.freq)
            const slotCount = slotCounts[r.id] ?? 0
            return (
              <div
                key={r.id}
                className={`rounded-2xl border border-border bg-card p-5 shadow-[0_8px_24px_-18px_rgba(0,0,0,0.18)] ${
                  r.is_active ? '' : 'opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-3">
                      <span
                        aria-hidden
                        className="grid size-11 shrink-0 place-items-center rounded-xl bg-secondary text-foreground"
                      >
                        {freqIcon(r.freq)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <Kicker className="mb-1">
                          {kicker.code} · {kicker.cjk}
                        </Kicker>
                        <div className="flex flex-wrap items-baseline gap-2">
                          <h3 className="font-display font-cjk text-lg font-black">
                            {svc?.name ?? '—'}
                          </h3>
                          {session.role === 'tenant_owner' && (
                            <span className="font-mono rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                              {memberLabel}
                            </span>
                          )}
                          {!r.is_active && (
                            <span className="font-mono rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                              停用中
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div>
                        <dt className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                          TIME · 時間
                        </dt>
                        <dd className="font-cjk mt-0.5 text-sm">
                          {describeRule(r)}{' '}
                          <span className="font-display tabular-nums">
                            {r.start_time?.slice(0, 5)}–{r.end_time?.slice(0, 5)}
                          </span>
                        </dd>
                      </div>
                      <div>
                        <dt className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                          START · 起
                        </dt>
                        <dd className="font-display mt-0.5 text-sm tabular-nums">
                          {format(parseISO(r.start_date), 'yyyy/MM/dd')}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                          END · 結束
                        </dt>
                        <dd className="font-cjk mt-0.5 text-sm">{describeEnd(r)}</dd>
                      </div>
                      <div>
                        <dt className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                          FUTURE · 未來時段
                        </dt>
                        <dd className="mt-0.5 inline-flex items-baseline gap-1.5">
                          <CalendarIcon className="size-3.5 self-center text-muted-foreground" />
                          <span className="font-display text-lg font-black tabular-nums">
                            {slotCount}
                          </span>
                          <span className="font-cjk text-xs text-muted-foreground">
                            個
                          </span>
                        </dd>
                      </div>
                    </dl>
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
