import Link from 'next/link'
import { Clock, DollarSign, Package } from 'lucide-react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { requireTenantMember } from '@/lib/auth/get-session'
import { Card, CardContent } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
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
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">服務項目</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {showArchived ? '已刪除的服務' : '您提供的所有服務'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={showArchived ? '/services' : '/services?archived=1'}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            {showArchived ? '看使用中' : '看已刪除'}
          </Link>
          {canEdit && !showArchived && <ServiceFormDialog mode="create" />}
        </div>
      </header>

      {!services || services.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Package className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 font-medium text-slate-700">
              {showArchived ? '沒有已刪除的服務' : '尚無服務'}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {showArchived ? '所有服務都在使用中' : '建立第一個服務開始接受預約'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <Card key={s.id} className="overflow-hidden">
              <CardContent className="p-5">
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
                    <span className="shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] text-slate-700">
                      已刪除
                    </span>
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
