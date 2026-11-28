import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Session } from '@/lib/auth/get-session'
import { memberNameOrRole } from '@/lib/auth/display-name'
import type { Database } from '@/lib/supabase/types'

/**
 * 這位成員能不能確認／拒絕／取消這筆預約、查看它的歷程。
 * Owner 可操作整個租戶；助教只能操作自己時段（availability_slots.member_id）的預約。
 * 這只決定畫面要不要顯示；真正的權限由資料庫函式把關。
 */
export function canActOnBooking(
  session: Pick<Session, 'role' | 'memberId'>,
  slotMemberId: string | null | undefined,
): boolean {
  if (session.role === 'tenant_owner') return true
  return session.role === 'tenant_staff' && !!slotMemberId && slotMemberId === session.memberId
}

export type MemberInfo = {
  id: string
  userId: string | null
  role: 'owner' | 'staff'
  name: string
}

/** 租戶所有成員的顯示名稱（取法見 memberNameOrRole：顯示名稱 → invited_email 的 @ 前段 → 身分）。查詢失敗時丟出錯誤。 */
export async function loadTenantMembers(
  supabase: SupabaseClient<Database>,
  tenantId: string,
): Promise<MemberInfo[]> {
  const { data, error } = await supabase
    .from('tenant_members')
    .select('id, user_id, role, display_name, invited_email')
    .eq('tenant_id', tenantId)
  if (error) {
    console.error('[bookings] 讀取成員失敗', error)
    throw new Error('讀取成員失敗')
  }
  return (data ?? []).map((m) => {
    const role = m.role === 'owner' ? 'owner' : 'staff'
    return {
      id: m.id,
      userId: m.user_id,
      role,
      name: memberNameOrRole({ displayName: m.display_name, invitedEmail: m.invited_email, role }),
    }
  })
}
