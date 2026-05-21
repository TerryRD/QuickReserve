import { redirect } from 'next/navigation'
import { requireTenantMember } from '@/lib/auth/get-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import ProfileForm from './profile-form'

export default async function TenantProfilePage() {
  const session = await requireTenantMember()
  if (session.role !== 'tenant_owner') redirect('/dashboard')

  const supabase = await createSupabaseServerClient()
  const { data: tenant } = await supabase
    .from('tenants')
    .select(
      'name, description, contact_email, contact_phone, contact_line_id, contact_note',
    )
    .eq('id', session.tenantId)
    .single()
  if (!tenant) redirect('/dashboard')

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl tracking-tight">
          <span className="italic">租戶資料</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          公開頁顯示的名稱、介紹與聯絡方式
        </p>
      </header>

      <ProfileForm initial={tenant} />
    </div>
  )
}
