import { redirect } from 'next/navigation'
import { requireTenantMember } from '@/lib/auth/get-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import InviteStaffForm from './invite-staff-form'
import RemoveStaffButton from './remove-staff-button'

export default async function StaffPage() {
  const session = await requireTenantMember()
  if (session.role !== 'tenant_owner') redirect('/dashboard')

  const supabase = await createSupabaseServerClient()
  const { data: members } = await supabase
    .from('tenant_members')
    .select('id, role, status, invited_email, created_at')
    .eq('tenant_id', session.tenantId)
    .neq('status', 'removed')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">助教管理</h1>
      <InviteStaffForm />

      <div>
        <h2 className="mb-2 text-lg font-semibold">租戶成員</h2>
        <table className="w-full bg-white">
          <thead>
            <tr className="border-b text-left text-sm text-slate-600">
              <th className="p-3">Email / 角色</th>
              <th className="p-3">狀態</th>
              <th className="p-3">建立日期</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {members?.map((m) => (
              <tr key={m.id} className="border-b text-sm">
                <td className="p-3">
                  <div className="font-medium">
                    {m.invited_email ?? (m.role === 'owner' ? '（您本人）' : '已加入')}
                  </div>
                  <div className="text-xs text-slate-500">
                    {m.role === 'owner' ? 'Owner' : 'Staff'}
                  </div>
                </td>
                <td className="p-3">
                  {m.status === 'active' && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">
                      已加入
                    </span>
                  )}
                  {m.status === 'invited' && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                      邀請中
                    </span>
                  )}
                </td>
                <td className="p-3 text-xs text-slate-500">
                  {new Date(m.created_at).toLocaleDateString('zh-TW')}
                </td>
                <td className="p-3 text-right">
                  {m.role === 'staff' && <RemoveStaffButton memberId={m.id} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
