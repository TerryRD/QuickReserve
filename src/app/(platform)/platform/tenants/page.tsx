import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import InviteCoachForm from './invite-coach-form'
import SuspendButton from './suspend-button'

export default async function TenantsListPage() {
  const supabase = await createSupabaseServerClient()
  const { data: tenants } = await supabase
    .from('tenants')
    .select('id, slug, name, status, created_at')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">租戶管理</h1>
      </div>

      <InviteCoachForm />

      <div>
        <h2 className="mb-2 text-lg font-semibold">租戶列表</h2>
        <table className="w-full bg-white">
          <thead>
            <tr className="border-b text-left text-sm text-slate-600">
              <th className="p-3">Slug</th>
              <th className="p-3">名稱</th>
              <th className="p-3">狀態</th>
              <th className="p-3">建立日期</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {tenants?.map((t) => (
              <tr key={t.id} className="border-b text-sm">
                <td className="p-3">
                  <Link
                    href={`/${t.slug}`}
                    target="_blank"
                    className="text-blue-600 hover:underline"
                  >
                    {t.slug}
                  </Link>
                </td>
                <td className="p-3">{t.name}</td>
                <td className="p-3">
                  {t.status === 'active' ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">
                      啟用中
                    </span>
                  ) : (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-800">
                      已暫停
                    </span>
                  )}
                </td>
                <td className="p-3 text-xs text-slate-500">
                  {new Date(t.created_at).toLocaleDateString('zh-TW')}
                </td>
                <td className="p-3 text-right">
                  <SuspendButton
                    tenantId={t.id}
                    currentStatus={t.status as 'active' | 'suspended'}
                  />
                </td>
              </tr>
            ))}
            {!tenants?.length && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-slate-400">
                  尚無租戶
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
