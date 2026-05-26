// src/app/(tenant)/settings/profile/page.tsx
import { redirect } from 'next/navigation'
import { requireTenantMember } from '@/lib/auth/get-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getCoachMediaPublicUrl } from '@/lib/storage'
import ProfileForm from './profile-form'

export default async function TenantProfilePage() {
  const session = await requireTenantMember()
  if (session.role !== 'tenant_owner') redirect('/dashboard')

  const supabase = await createSupabaseServerClient()
  const [{ data: tenant }, { data: photoRows }] = await Promise.all([
    supabase
      .from('tenants')
      .select(
        'name, description, contact_email, contact_phone, contact_line_id, contact_note, avatar_url, bio_html, intro_video_url',
      )
      .eq('id', session.tenantId)
      .single(),
    supabase
      .from('tenant_photos')
      .select('id, storage_path, caption')
      .eq('tenant_id', session.tenantId)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true }),
  ])

  if (!tenant) redirect('/dashboard')

  const photos = (photoRows ?? []).map((p) => ({
    id: p.id,
    storage_path: p.storage_path,
    caption: p.caption,
    public_url: getCoachMediaPublicUrl(p.storage_path),
  }))

  return (
    <div className="space-y-6">
      <header className="mb-8">
        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">SETTINGS · 教練資料</div>
        <h1 className="font-display mt-2 text-3xl uppercase">
          設定<span className="font-cjk">資料</span>
        </h1>
        <p className="font-cjk mt-1 text-sm text-muted-foreground">公開頁顯示的名稱、介紹、媒體與聯絡方式</p>
      </header>

      <ProfileForm tenantId={session.tenantId} initial={tenant} photos={photos} />
    </div>
  )
}
