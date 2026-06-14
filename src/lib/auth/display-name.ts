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
