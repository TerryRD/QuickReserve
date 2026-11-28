import { describe, expect, it } from 'vitest'
import { memberDisplayName, memberNameOrRole, resolveDisplayName } from '@/lib/auth/display-name'

describe('resolveDisplayName', () => {
  it('uses full display name when present', () => {
    expect(resolveDisplayName({ displayName: '王小明', email: 'a@b.com' })).toBe('王小明')
  })
  it('trims whitespace-only display name and falls back to email local part', () => {
    expect(resolveDisplayName({ displayName: '   ', email: 'coach@example.com' })).toBe('coach')
  })
  it('falls back to email local part when no display name', () => {
    expect(resolveDisplayName({ displayName: null, email: 'coach@example.com' })).toBe('coach')
  })
  it('uses raw email when it has no @ somehow', () => {
    expect(resolveDisplayName({ displayName: null, email: 'weird' })).toBe('weird')
  })
  it('returns 使用者 when nothing is available', () => {
    expect(resolveDisplayName({ displayName: null, email: null })).toBe('使用者')
  })
  it('falls back to raw email when local part is empty', () => {
    expect(resolveDisplayName({ displayName: null, email: '@domain.com' })).toBe('@domain.com')
  })
})

describe('memberDisplayName／memberNameOrRole（成員名稱三層退回）', () => {
  it('第一層：有顯示名稱就用它（去頭尾空白）', () => {
    const m = { displayName: ' 王教練 ', invitedEmail: 'wang@example.com', role: 'staff' as const }
    expect(memberDisplayName(m)).toBe('王教練')
    expect(memberNameOrRole(m)).toBe('王教練')
  })
  it('第二層：顯示名稱為空或只有空白時退回 email 的 @ 前段', () => {
    for (const displayName of [null, undefined, '', '   ']) {
      const m = { displayName, invitedEmail: 'wang@example.com', role: 'staff' as const }
      expect(memberDisplayName(m)).toBe('wang')
      expect(memberNameOrRole(m)).toBe('wang')
    }
  })
  it('第三層：都沒有時 memberDisplayName 回傳 null，memberNameOrRole 退回身分字', () => {
    for (const invitedEmail of [null, '', '@example.com', '  @example.com']) {
      expect(memberDisplayName({ displayName: null, invitedEmail })).toBeNull()
      expect(memberNameOrRole({ displayName: null, invitedEmail, role: 'owner' })).toBe('Owner')
      expect(memberNameOrRole({ displayName: null, invitedEmail, role: 'staff' })).toBe('助教')
    }
  })
})
