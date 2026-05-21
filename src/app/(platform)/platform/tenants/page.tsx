import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function TenantsListPage() {
  const supabase = await createSupabaseServerClient()
  const { data: tenants } = await supabase
    .from('tenants')
    .select('id, slug, name, status, created_at')
    .order('created_at', { ascending: false })

  return (
    <div>
      <h1 className="text-2xl font-bold">租戶管理</h1>
      <table className="mt-6 w-full bg-white">
        <thead>
          <tr className="border-b text-left text-sm text-slate-600">
            <th className="p-3">Slug</th>
            <th className="p-3">名稱</th>
            <th className="p-3">狀態</th>
            <th className="p-3">建立日期</th>
          </tr>
        </thead>
        <tbody>
          {tenants?.map((t) => (
            <tr key={t.id} className="border-b text-sm">
              <td className="p-3">{t.slug}</td>
              <td className="p-3">{t.name}</td>
              <td className="p-3">{t.status}</td>
              <td className="p-3">{new Date(t.created_at).toLocaleDateString('zh-TW')}</td>
            </tr>
          ))}
          {!tenants?.length && (
            <tr>
              <td colSpan={4} className="p-6 text-center text-slate-400">
                尚無租戶
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
