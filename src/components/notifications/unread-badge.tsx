import { Bell } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// 未讀數字徽章與鈴鐺外觀的唯一定義處：頁首鈴鐺（連結版、小視窗版）與教練端側欄共用。
// 不含 'use client'，伺服器端與前端元件都可以引用。

/** 徽章上最多顯示到幾，超過顯示「99+」 */
export const MAX_BADGE = 99

/** 有沒有未讀。查詢失敗（null）一律當作不知道，不顯示任何提示。 */
export function hasUnread(unread: number | null): unread is number {
  return unread !== null && unread > 0
}

/** 徽章文字；0 或查詢失敗（null）回 null＝不顯示徽章 */
export function unreadBadgeText(unread: number | null): string | null {
  if (!hasUnread(unread)) return null
  return unread > MAX_BADGE ? `${MAX_BADGE}+` : String(unread)
}

/** 鈴鐺按鈕給螢幕閱讀器的名稱（數字用實際未讀數，不截成 99+） */
export function bellAriaLabel(unread: number | null): string {
  return hasUnread(unread) ? `通知，${unread} 則未讀` : '通知'
}

/** 鈴鐺按鈕（連結或按鈕）的外觀 */
export const bellButtonClassName = cn(
  buttonVariants({ variant: 'ghost', size: 'icon-lg' }),
  'relative',
)

/** 紅底白字的未讀數字徽章；0 或查詢失敗不顯示 */
export function UnreadBadge({ unread, className }: { unread: number | null; className?: string }) {
  const text = unreadBadgeText(unread)
  if (!text) return null
  return (
    <span
      aria-hidden
      data-testid="notification-badge"
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 font-mono text-[10px] font-semibold text-white',
        className,
      )}
    >
      {text}
    </span>
  )
}

/** 鈴鐺圖示＋右上角徽章（放在 bellButtonClassName 的按鈕或連結裡） */
export function BellGlyph({ unread }: { unread: number | null }) {
  return (
    <>
      <Bell className="size-5" aria-hidden />
      <UnreadBadge unread={unread} className="absolute -top-1 -right-1" />
    </>
  )
}
