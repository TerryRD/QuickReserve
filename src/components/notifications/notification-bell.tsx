import Link from 'next/link'
import { BellGlyph, bellAriaLabel, bellButtonClassName } from './unread-badge'

/**
 * 頁首的通知鈴鐺（連結版：點了直接前往 href）。unread 為 null（查詢失敗）或 0 時不顯示數字。
 * 點了跳出小視窗的版本見 NotificationPopover；兩者外觀與徽章規則共用 unread-badge。
 */
export function NotificationBell({ href, unread }: { href: string; unread: number | null }) {
  return (
    <Link href={href} aria-label={bellAriaLabel(unread)} className={bellButtonClassName}>
      <BellGlyph unread={unread} />
    </Link>
  )
}
