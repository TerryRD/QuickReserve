import Link from 'next/link'
import { format } from 'date-fns'
import { Search, Users } from 'lucide-react'
import { requireTenantMember } from '@/lib/auth/get-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { SectionHead } from '@/components/ui/section-head'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'
import CustomerRow, {
  type CustomerDrawerData,
  type CustomerRowData,
  type DrawerBooking,
  type DrawerPackage,
} from './customer-row'
import type { StatusType } from '@/components/ui/badge'

const TZ_OFFSET_HOURS = 8
const toLocal = (iso: string) =>
  new Date(new Date(iso).getTime() + TZ_OFFSET_HOURS * 3600 * 1000)

type StatusFilter = 'all' | 'active' | 'blocked'

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'active', label: '啟用' },
  { key: 'blocked', label: '封鎖' },
]

const ALLOWED_BOOKING_STATUSES = new Set<StatusType>([
  'pending',
  'confirmed',
  'cancelled',
  'completed',
])

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: StatusFilter }>
}) {
  const session = await requireTenantMember()
  const supabase = await createSupabaseServerClient()
  const { q: rawQ, status: rawStatus } = await searchParams
  const q = (rawQ ?? '').trim()
  const status: StatusFilter =
    rawStatus === 'active' || rawStatus === 'blocked' ? rawStatus : 'all'

  // 1) Tenant customers + nested customer profile
  const { data: customerRows } = await supabase
    .from('tenant_customers')
    .select(
      'customer_id, is_blocked, created_at, customers(id, display_name, phone)',
    )
    .eq('tenant_id', session.tenantId)
    .order('created_at', { ascending: false })

  // 2) Bookings (single tenant-wide fetch, group in JS)
  const { data: bookings } = await supabase
    .from('bookings')
    .select(
      'id, customer_id, status, created_at, services(name), availability_slots(start_at)',
    )
    .eq('tenant_id', session.tenantId)
    .order('created_at', { ascending: false })

  // 3) Active package purchases (single tenant-wide fetch)
  const { data: purchases } = await supabase
    .from('customer_purchases')
    .select(
      'id, customer_id, classes_total, classes_used, expires_at, service_packages(name), services(name)',
    )
    .eq('tenant_id', session.tenantId)
    .eq('approval_status', 'confirmed')

  // Group bookings per customer
  type BookingRecord = {
    id: string
    customer_id: string
    status: string
    created_at: string
    services: { name: string } | null
    availability_slots: { start_at: string } | null
  }
  const bookingsByCustomer = new Map<string, BookingRecord[]>()
  for (const b of (bookings ?? []) as unknown as BookingRecord[]) {
    const list = bookingsByCustomer.get(b.customer_id) ?? []
    list.push(b)
    bookingsByCustomer.set(b.customer_id, list)
  }

  // Group active purchases per customer
  type PurchaseRecord = {
    id: string
    customer_id: string
    classes_total: number
    classes_used: number
    expires_at: string | null
    service_packages: { name: string } | null
    services: { name: string } | null
  }
  const purchasesByCustomer = new Map<string, PurchaseRecord[]>()
  for (const p of (purchases ?? []) as unknown as PurchaseRecord[]) {
    const list = purchasesByCustomer.get(p.customer_id) ?? []
    list.push(p)
    purchasesByCustomer.set(p.customer_id, list)
  }

  // Build per-customer view-model
  const rows = customerRows ?? []
  const enriched = rows
    .map((r) => {
      const c = r.customers as {
        id: string
        display_name: string | null
        phone: string | null
      } | null
      if (!c) return null

      const displayName = c.display_name ?? '匿名學員'
      const phone = c.phone ?? null
      const isBlocked = r.is_blocked ?? false
      const custBookings = bookingsByCustomer.get(c.id) ?? []
      const custPurchases = purchasesByCustomer.get(c.id) ?? []

      const totalBookings = custBookings.length
      // remaining classes = sum of (total - used) for active purchases
      const remainingClasses = custPurchases.reduce(
        (sum, p) => sum + Math.max(0, p.classes_total - p.classes_used),
        0,
      )

      // last seen = latest slot start_at (preferred) else latest booking created_at
      let lastSeenIso: string | null = null
      for (const b of custBookings) {
        const ts = b.availability_slots?.start_at ?? b.created_at
        if (ts && (!lastSeenIso || ts > lastSeenIso)) lastSeenIso = ts
      }
      const lastSeenLabel = lastSeenIso
        ? format(toLocal(lastSeenIso), 'MM/dd')
        : null

      const rowData: CustomerRowData = {
        customerId: c.id,
        displayName,
        phone,
        isBlocked,
        totalBookings,
        remainingClasses,
        lastSeenLabel,
      }

      // Drawer data: top 10 bookings (newest by slot start_at desc, fallback created_at)
      const sortedBookings = [...custBookings].sort((a, b) => {
        const aTs = a.availability_slots?.start_at ?? a.created_at
        const bTs = b.availability_slots?.start_at ?? b.created_at
        if (aTs === bTs) return 0
        return aTs < bTs ? 1 : -1
      })
      const drawerBookings: DrawerBooking[] = sortedBookings
        .slice(0, 10)
        .map((b) => {
          const startIso = b.availability_slots?.start_at ?? null
          const startAtLabel = startIso
            ? format(toLocal(startIso), 'MM/dd HH:mm')
            : format(toLocal(b.created_at), 'MM/dd HH:mm')
          const bookingStatus = (
            ALLOWED_BOOKING_STATUSES.has(b.status as StatusType)
              ? (b.status as StatusType)
              : 'pending'
          ) as StatusType
          return {
            id: b.id,
            serviceName: b.services?.name ?? '—',
            startAtLabel,
            status: bookingStatus,
          }
        })

      const drawerPackages: DrawerPackage[] = custPurchases
        .map((p) => {
          const total = p.classes_total ?? 0
          const used = p.classes_used ?? 0
          const remaining = Math.max(0, total - used)
          const expiresLabel = p.expires_at
            ? format(toLocal(p.expires_at), 'yyyy-MM-dd')
            : '無期限'
          const pkgName =
            p.service_packages?.name ??
            (p.services?.name ? `${p.services.name} · ${total} 堂` : '套裝')
          return {
            id: p.id,
            name: pkgName,
            remaining,
            total,
            expiresLabel,
          }
        })
        .sort((a, b) => b.remaining - a.remaining)

      const drawerData: CustomerDrawerData = {
        bookings: drawerBookings,
        packages: drawerPackages,
      }

      return { row: rowData, drawer: drawerData }
    })
    .filter((x): x is { row: CustomerRowData; drawer: CustomerDrawerData } =>
      Boolean(x),
    )

  // Apply search + status filter
  const filtered = enriched.filter(({ row }) => {
    const matchQ =
      !q ||
      row.displayName.toLowerCase().includes(q.toLowerCase()) ||
      (row.phone ?? '').includes(q)
    const matchStatus =
      status === 'all'
        ? true
        : status === 'blocked'
          ? row.isBlocked
          : !row.isBlocked
    return matchQ && matchStatus
  })

  const counts = {
    all: enriched.length,
    active: enriched.filter((e) => !e.row.isBlocked).length,
    blocked: enriched.filter((e) => e.row.isBlocked).length,
  }

  return (
    <div className="space-y-6">
      <SectionHead
        kicker="CUSTOMERS · 學員管理"
        title="學員"
        eng="CUSTOMERS"
        hint="所有預約過你服務的學員。點開查看預約紀錄與持有套裝。"
      />

      {/* Search row */}
      <form method="GET" className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-[480px]">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="搜尋名字 / 電話…"
            className="font-cjk h-11 w-full rounded-full border-[1.5px] border-border bg-card pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none focus:ring-3 focus:ring-ring/40"
          />
        </div>
        {status !== 'all' && (
          <input type="hidden" name="status" value={status} />
        )}
        <button
          type="submit"
          className="font-mono rounded-full bg-primary px-4 py-2 text-[11px] uppercase tracking-[0.15em] text-primary-foreground transition hover:opacity-90"
        >
          SEARCH
        </button>
        {q && (
          <Link
            href={{
              pathname: '/customers',
              query: status !== 'all' ? { status } : {},
            }}
            className="font-mono inline-flex items-center rounded-full border border-border bg-card px-4 py-2 text-[11px] uppercase tracking-[0.15em] text-muted-foreground transition hover:text-foreground"
          >
            CLEAR
          </Link>
        )}
      </form>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => {
          const isActive = status === tab.key
          const href = {
            pathname: '/customers',
            query: {
              ...(q && { q }),
              ...(tab.key !== 'all' && { status: tab.key }),
            },
          }
          return (
            <Link
              key={tab.key}
              href={href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'font-mono inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.18em] transition',
                isActive
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
              <span
                className={cn(
                  'rounded-full px-1.5 text-[9px] tabular-nums',
                  isActive
                    ? 'bg-primary-foreground/15 text-primary-foreground'
                    : 'bg-muted text-foreground',
                )}
              >
                {counts[tab.key]}
              </span>
            </Link>
          )
        })}
      </div>

      {enriched.length === 0 ? (
        <EmptyState
          icon={<Users className="size-5" />}
          title="NO CUSTOMERS"
          hint="學員透過您的公開連結預約後會顯示在此"
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Search className="size-5" />}
          title="NO MATCH"
          hint={q ? `找不到符合「${q}」的學員` : '沒有符合條件的學員'}
        />
      ) : (
        <>
          {/* List column header (desktop) */}
          <div className="hidden items-center gap-4 px-5 sm:flex">
            <div className="size-11" aria-hidden />
            <div className="font-mono flex-1 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
              NAME / PHONE
            </div>
            <div className="font-mono w-[60px] text-right text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
              BOOKINGS
            </div>
            <div className="font-mono w-[70px] text-right text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
              BALANCE
            </div>
            <div className="font-mono hidden w-[88px] text-right text-[10px] uppercase tracking-[0.15em] text-muted-foreground lg:block">
              LAST SEEN
            </div>
            <div className="size-3.5" aria-hidden />
          </div>

          <div className="flex flex-col gap-2">
            {filtered.map(({ row, drawer }) => (
              <CustomerRow key={row.customerId} row={row} drawer={drawer} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
