import Link from 'next/link'
import { Clock, DollarSign, Package } from 'lucide-react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { requireTenantMember } from '@/lib/auth/get-session'
import { buttonVariants } from '@/components/ui/button'
import { SectionHead } from '@/components/ui/section-head'
import { Badge } from '@/components/ui/badge'
import ServiceFormDialog from './service-form-dialog'
import ServiceActionsRow from './service-actions-row'

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>
}) {
  const session = await requireTenantMember()
  const params = await searchParams
  const showArchived = params.archived === '1'
  const supabase = await createSupabaseServerClient()
  const { data: services } = await supabase
    .from('services')
    .select(
      'id, name, description, duration_minutes, price, is_active, max_capacity, min_attendance, cancel_deadline_hours, created_at',
    )
    .eq('tenant_id', session.tenantId)
    .eq('is_active', !showArchived)
    .order('created_at', { ascending: false })

  const canEdit = session.role === 'tenant_owner'

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

      {!services || services.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-16 text-center">
          <Package className="mx-auto size-10 text-muted-foreground" />
          <div className="font-mono mt-4 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            NO SERVICES
          </div>
          <p className="font-cjk mt-2 text-sm text-muted-foreground">
            {showArchived ? '所有服務都在使用中' : '建立第一個服務開始接受預約'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <div key={s.id} className="rounded-2xl border border-border bg-card p-5 overflow-hidden">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold">{s.name}</h3>
                  {s.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {s.description}
                    </p>
                  )}
                </div>
                {!s.is_active && (
                  <Badge variant="outline" className="shrink-0">已刪除</Badge>
                )}
              </div>
              <div className="mt-4 flex items-center gap-3 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {s.duration_minutes} 分
                </span>
                <span className="inline-flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  {s.price ? Number(s.price).toLocaleString() : '洽詢'}
                </span>
              </div>
              {canEdit && (
                <div className="mt-4 flex justify-end gap-2 border-t pt-3">
                  {s.is_active && <ServiceFormDialog mode="edit" service={s} />}
                  <ServiceActionsRow id={s.id} isActive={s.is_active} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
