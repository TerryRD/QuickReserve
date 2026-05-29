import Link from 'next/link'
import { Plus } from 'lucide-react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { requireTenantMember } from '@/lib/auth/get-session'
import { buttonVariants } from '@/components/ui/button'
import { SectionHead } from '@/components/ui/section-head'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import ServiceFormDialog from './service-form-dialog'
import ServiceActionsRow from './service-actions-row'
import SortableServicesGrid from './sortable-services-grid'

type Tab = 'all' | '1on1' | 'group'

type Service = {
  id: string
  name: string
  description: string | null
  duration_minutes: number
  price: number | null
  is_active: boolean
  max_capacity: number
  min_attendance: number
  cancel_deadline_hours: number
  created_at: string
}

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string; tab?: Tab }>
}) {
  const session = await requireTenantMember()
  const params = await searchParams
  const showArchived = params.archived === '1'
  const tab: Tab = params.tab === '1on1' || params.tab === 'group' ? params.tab : 'all'
  const supabase = await createSupabaseServerClient()
  const { data: services } = await supabase
    .from('services')
    .select(
      'id, name, description, duration_minutes, price, is_active, max_capacity, min_attendance, cancel_deadline_hours, created_at',
    )
    .eq('tenant_id', session.tenantId)
    .eq('is_active', !showArchived)
    .order('display_order', { ascending: true })
    .order('name', { ascending: true })

  const all = (services as Service[] | null) ?? []
  const filtered = all.filter((s) => {
    if (tab === '1on1') return s.max_capacity === 1
    if (tab === 'group') return s.max_capacity > 1
    return true
  })

  const canEdit = session.role === 'tenant_owner'

  const tabs: { id: Tab; label: string; eng: string }[] = [
    { id: 'all', label: '全部', eng: 'ALL' },
    { id: '1on1', label: '一對一', eng: '1-ON-1' },
    { id: 'group', label: '團班', eng: 'GROUP' },
  ]

  return (
    <div className="space-y-6">
      <SectionHead
        kicker="SERVICES · 服務項目"
        title="服務項目"
        eng="SERVICES"
        hint={showArchived ? '已刪除的服務' : '您提供的所有服務'}
        right={
          <>
            <Link
              href={showArchived ? '/services' : '/services?archived=1'}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              {showArchived ? '看使用中' : '看已刪除'}
            </Link>
            {canEdit && !showArchived && <ServiceFormDialog mode="create" />}
          </>
        }
      />

      {!showArchived && (
        <nav
          aria-label="服務分類"
          className="inline-flex rounded-full border border-border bg-card p-1 shadow-[0_8px_24px_-18px_rgba(0,0,0,0.18)]"
        >
          {tabs.map((t) => {
            const isActive = t.id === tab
            return (
              <Link
                key={t.id}
                href={{ pathname: '/services', query: t.id === 'all' ? {} : { tab: t.id } }}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex items-baseline gap-2 rounded-full px-4 py-2 text-sm transition',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <span className="font-cjk">{t.label}</span>
                <span className="font-mono text-[10px] tracking-[0.15em] opacity-70">
                  {t.eng}
                </span>
              </Link>
            )
          })}
        </nav>
      )}

      {filtered.length === 0 && !canEdit ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-16 text-center">
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            NO SERVICES
          </div>
          <p className="font-cjk mt-2 text-sm text-muted-foreground">
            {showArchived ? '所有服務都在使用中' : '尚無符合的服務'}
          </p>
        </div>
      ) : canEdit && !showArchived && tab === 'all' && filtered.length > 1 ? (
        <>
          <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
            DRAG · 拖曳卡片右上角的把手調整公開頁顯示順序
          </p>
          <SortableServicesGrid
            items={filtered.map((s) => ({
              id: s.id,
              node: <ServiceCard service={s} canEdit={canEdit} />,
            }))}
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <ServiceFormDialog
              mode="create"
              trigger={
                <button
                  type="button"
                  className="grid min-h-[180px] place-items-center rounded-2xl border-[1.5px] border-dashed border-border bg-muted/40 p-6 text-center transition hover:border-foreground/40 hover:bg-muted/60"
                >
                  <div className="space-y-2">
                    <div className="mx-auto grid size-12 place-items-center rounded-full bg-secondary text-muted-foreground">
                      <Plus className="size-5" />
                    </div>
                    <div className="font-cjk text-sm font-semibold">新增服務</div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      CREATE NEW
                    </div>
                  </div>
                </button>
              }
            />
          </div>
        </>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => (
            <ServiceCard key={s.id} service={s} canEdit={canEdit} />
          ))}
          {canEdit && !showArchived && (
            <ServiceFormDialog
              mode="create"
              trigger={
                <button
                  type="button"
                  className="grid min-h-[180px] place-items-center rounded-2xl border-[1.5px] border-dashed border-border bg-muted/40 p-6 text-center transition hover:border-foreground/40 hover:bg-muted/60"
                >
                  <div className="space-y-2">
                    <div className="mx-auto grid size-12 place-items-center rounded-full bg-secondary text-muted-foreground">
                      <Plus className="size-5" />
                    </div>
                    <div className="font-cjk text-sm font-semibold">新增服務</div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      CREATE NEW
                    </div>
                  </div>
                </button>
              }
            />
          )}
        </div>
      )}
    </div>
  )
}

function ServiceCard({ service, canEdit }: { service: Service; canEdit: boolean }) {
  const isGroup = service.max_capacity > 1
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-6 shadow-[0_8px_24px_-18px_rgba(0,0,0,0.18)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {isGroup ? `GROUP · ${service.max_capacity}` : '1-ON-1'}
          </div>
          <h3 className="font-display font-cjk mt-1 truncate text-xl font-black">
            {service.name}
          </h3>
        </div>
        {!service.is_active && (
          <Badge variant="outline" className="shrink-0">
            已停用
          </Badge>
        )}
      </div>
      {service.description && (
        <p className="font-cjk line-clamp-2 text-xs text-muted-foreground">
          {service.description}
        </p>
      )}
      <div className="flex items-baseline gap-2">
        <span className="font-display text-3xl">
          {service.price !== null && service.price !== undefined
            ? `NT$ ${Number(service.price).toLocaleString()}`
            : '洽詢'}
        </span>
        <span className="font-cjk text-xs text-muted-foreground">
          / {service.duration_minutes} 分鐘
        </span>
      </div>
      {isGroup && (
        <div className="grid grid-cols-3 gap-2 border-t border-border pt-3">
          <div>
            <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
              CAP
            </div>
            <div className="font-display text-base tabular-nums">{service.max_capacity}</div>
          </div>
          <div>
            <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
              MIN
            </div>
            <div className="font-display text-base tabular-nums">{service.min_attendance}</div>
          </div>
          <div>
            <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
              CXL
            </div>
            <div className="font-display text-base tabular-nums">
              {service.cancel_deadline_hours}h
            </div>
          </div>
        </div>
      )}
      {canEdit && (
        <div className="flex justify-end gap-2 border-t border-border pt-3">
          {service.is_active && <ServiceFormDialog mode="edit" service={service} />}
          <ServiceActionsRow id={service.id} isActive={service.is_active} />
        </div>
      )}
    </div>
  )
}
