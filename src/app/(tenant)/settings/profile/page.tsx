// src/app/(tenant)/settings/profile/page.tsx
import { redirect } from 'next/navigation'
import { requireTenantMember } from '@/lib/auth/get-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getCoachMediaPublicUrl } from '@/lib/storage'
import { Kicker } from '@/components/ui/kicker'
import { SubNav } from '@/components/shell/sub-nav'
import ProfileForm from './profile-form'

const SETTINGS_NAV_ITEMS = [
  { href: '/settings/profile', label: '公開頁', eng: 'PROFILE' },
  { href: '/settings/notifications', label: '通知', eng: 'NOTIF' },
  { href: '/calendar/availability', label: '作息', eng: 'AVAILABILITY' },
  { href: '/calendar/rules', label: '重複', eng: 'RULES' },
]

export default async function TenantProfilePage() {
  const session = await requireTenantMember()
  if (session.role !== 'tenant_owner') redirect('/dashboard')

  const supabase = await createSupabaseServerClient()
  const [{ data: tenant }, { data: photoRows }] = await Promise.all([
    supabase
      .from('tenants')
      .select(
        'name, description, contact_email, contact_phone, contact_line_id, contact_note, avatar_url, bio_html, intro_video_url, years_exp, established_year, city',
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
    <div className="space-y-7 pb-24">
      <div>
        <Kicker>SETTINGS · 教練設定</Kicker>
        <h1 className="font-display font-cjk mt-2 text-3xl font-black uppercase sm:text-4xl">
          公開頁資料
        </h1>
        <p className="font-cjk mt-2 text-sm text-muted-foreground">
          公開頁顯示的名稱、介紹、媒體與聯絡方式
        </p>
      </div>

      <SubNav items={SETTINGS_NAV_ITEMS} active="/settings/profile" />

      <ProfileForm tenantId={session.tenantId} initial={tenant} photos={photos} />
    </div>
  )
}
