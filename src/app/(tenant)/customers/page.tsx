import Link from 'next/link'
import { format } from 'date-fns'
import { Users, ClipboardList, Ban } from 'lucide-react'
import { requireTenantMember } from '@/lib/auth/get-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { SectionHead } from '@/components/ui/section-head'
import { Badge } from '@/components/ui/badge'
import BlockButton from './block-button'

export default async function CustomersPage() {
  const session = await requireTenantMember()
  const supabase = await createSupabaseServerClient()

  // Pull customers via tenant_customers + counts of bookings
  const { data: rows } = await supabase
    .from('tenant_customers')
    .select('customer_id, tenant_notes, created_at, is_blocked, customers(id, display_name, phone)')
    .eq('tenant_id', session.tenantId)
    .order('created_at', { ascending: false })

  // Booking counts per customer (single query, group in JS)
  const { data: bookings } = await supabase
    .from('bookings')
    .select('customer_id, status, created_at')
    .eq('tenant_id', session.tenantId)
  const stats: Record<
    string,
    { total: number; pending: number; confirmed: number; cancelled: number; latest: string | null }
  > = {}
  for (const b of bookings ?? []) {
    const s = (stats[b.customer_id] ??= {
      total: 0,
      pending: 0,
      confirmed: 0,
      cancelled: 0,
      latest: null,
    })
    s.total++
    if (b.status === 'pending') s.pending++
    if (b.status === 'confirmed' || b.status === 'completed') s.confirmed++
    if (b.status === 'cancelled') s.cancelled++
    if (!s.latest || b.created_at > s.latest) s.latest = b.created_at
  }

  return (
    <div className="space-y-6">
      <SectionHead
        kicker="CUSTOMERS · 學員管理"
        title="學員"
        eng="CUSTOMERS"
        hint={`有預約紀錄的所有客戶 · 共 ${rows?.length ?? 0} 位`}
      />

      {!rows || rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-16 text-center">
          <Users className="mx-auto size-10 text-muted-foreground" />
          <div className="font-mono mt-4 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            NO CUSTOMERS
          </div>
          <p className="font-cjk mt-2 text-sm text-muted-foreground">
            學員透過您的公開連結預約後會顯示在此
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => {
            const c = r.customers as {
              id: string
              display_name: string | null
              phone: string | null
            } | null
            if (!c) return null
            const s = stats[c.id]
            return (
              <div
                key={c.id}
                className={`rounded-2xl border border-border bg-card p-5 ${r.is_blocked ? 'border-red-300 bg-red-50/30' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-base font-bold ${
                      r.is_blocked ? 'bg-red-200 text-red-900' : 'bg-foreground text-background'
                    }`}
                  >
                    {(c.display_name ?? '?').slice(0, 1)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-semibold">
                        {c.display_name ?? '匿名學員'}
                      </span>
                      {r.is_blocked && (
                        <Badge variant="outline" className="shrink-0">
                          <Ban className="h-2.5 w-2.5" />
                          已封鎖
                        </Badge>
                      )}
                    </div>
                    {c.phone && (
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        {c.phone}
                      </div>
                    )}
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                      <Stat label="總計" value={s?.total ?? 0} />
                      <Stat label="待確認" value={s?.pending ?? 0} accent="amber" />
                      <Stat label="已完成" value={s?.confirmed ?? 0} accent="emerald" />
                    </div>
                    {s?.latest && (
                      <div className="mt-2 text-[10px] text-muted-foreground">
                        最近預約：{format(new Date(s.latest), 'yyyy/MM/dd')}
                      </div>
                    )}
                    <div className="mt-3 flex justify-end">
                      <BlockButton customerId={c.id} isBlocked={r.is_blocked ?? false} />
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="rounded-lg border bg-muted/30 p-4 text-xs text-muted-foreground">
        <ClipboardList className="mr-1 inline h-3.5 w-3.5" />
        想看單一學員的所有預約紀錄？前往{' '}
        <Link href="/bookings" className="text-primary hover:underline">
          預約管理
        </Link>{' '}
        並用 filter 篩選狀態。
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string
  value: number
  accent?: 'amber' | 'emerald'
}) {
  const color =
    accent === 'amber'
      ? 'text-amber-700'
      : accent === 'emerald'
        ? 'text-emerald-700'
        : 'text-foreground'
  return (
    <div className="text-center">
      <div className={`font-display text-xl ${color}`}>{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  )
}
