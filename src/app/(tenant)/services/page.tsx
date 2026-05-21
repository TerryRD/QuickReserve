import { createSupabaseServerClient } from '@/lib/supabase/server'
import { requireTenantMember } from '@/lib/auth/get-session'
import ServiceFormDialog from './service-form-dialog'

export default async function ServicesPage() {
  const session = await requireTenantMember()
  const supabase = await createSupabaseServerClient()
  const { data: services } = await supabase
    .from('services')
    .select('id, name, description, duration_minutes, price, is_active, created_at')
    .order('created_at', { ascending: false })

  const canEdit = session.role === 'tenant_owner'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">服務項目</h1>
        {canEdit && <ServiceFormDialog mode="create" />}
      </div>
      <table className="w-full bg-white">
        <thead>
          <tr className="border-b text-left text-sm text-slate-600">
            <th className="p-3">名稱</th>
            <th className="p-3">時長</th>
            <th className="p-3">價格</th>
            <th className="p-3">狀態</th>
            <th className="p-3" />
          </tr>
        </thead>
        <tbody>
          {services?.map((s) => (
            <tr key={s.id} className="border-b text-sm">
              <td className="p-3">{s.name}</td>
              <td className="p-3">{s.duration_minutes} 分</td>
              <td className="p-3">{s.price ?? '—'}</td>
              <td className="p-3">{s.is_active ? '啟用' : '停用'}</td>
              <td className="p-3 text-right">
                {canEdit && <ServiceFormDialog mode="edit" service={s} />}
              </td>
            </tr>
          ))}
          {!services?.length && (
            <tr>
              <td colSpan={5} className="p-6 text-center text-slate-400">
                尚無服務，請新增
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
