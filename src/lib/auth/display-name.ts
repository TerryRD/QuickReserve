import { actorRoleLabel } from '@/lib/booking-terms'

/**
 * 決定畫面上要顯示的登入者名稱。
 * 順序：使用者填的姓名 → email 的 @ 前段 → email 原文 → '使用者'（永不為空）。
 */
export function resolveDisplayName(input: {
  displayName?: string | null
  email?: string | null
}): string {
  const name = input.displayName?.trim()
  if (name) return name
  const email = input.email?.trim()
  if (email && email.includes('@')) return email.split('@')[0] || email
  if (email) return email
  return '使用者'
}

/**
 * 教練／助教（tenant_members）在教練端畫面的名稱。
 * 順序：成員的顯示名稱（tenant_members.display_name）→ 邀請 email 的 @ 前段；都沒有時回傳 null。
 */
export function memberDisplayName(member: {
  displayName?: string | null
  invitedEmail?: string | null
}): string | null {
  const name = member.displayName?.trim()
  if (name) return name
  const local = member.invitedEmail?.split('@')[0]?.trim()
  return local ? local : null
}

/** 同 memberDisplayName，但都沒有時退回教練端的身分字（Owner／助教），永不為空 */
export function memberNameOrRole(member: {
  displayName?: string | null
  invitedEmail?: string | null
  role: 'owner' | 'staff'
}): string {
  return memberDisplayName(member) ?? actorRoleLabel(member.role, 'tenant')
}
