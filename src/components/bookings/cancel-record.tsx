import type { ReactNode } from 'react'
import {
  CANCEL_CATEGORY_LABEL,
  actorRoleLabel,
  classDispositionText,
  type ActorRole,
  type CancelCategory,
  type ClassDisposition,
  type Viewer,
} from '@/lib/booking-terms'
import { formatTaipeiDateTime } from '@/lib/taipei-time'

export type CancelRecordProps = {
  viewer: Viewer
  category: CancelCategory
  reason: string | null
  actorRole: ActorRole | null
  cancelledAt: string | null
  disposition: ClassDisposition | null
  /** 取消人名稱（只有教練端會顯示，格式「名稱（身分）」；學員端一律不顯示） */
  actorName?: string | null
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-16 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1 break-words">{children}</dd>
    </div>
  )
}

/**
 * 學員端：自己取消寫「你」，其餘沿用 actorRoleLabel（不區分 Owner／助教），不顯示名稱。
 * 教練端：有名稱時寫「名稱（身分）」，沒有名稱或系統取消時只寫身分。
 */
function cancelActorLabel(
  actorRole: ActorRole,
  viewer: Viewer,
  actorName: string | null | undefined,
): string {
  if (viewer === 'customer') {
    return actorRole === 'customer' ? '你' : actorRoleLabel(actorRole, 'customer')
  }
  const role = actorRoleLabel(actorRole, 'tenant')
  const name = actorName?.trim()
  if (actorRole === 'system' || !name || name === role) return role
  return `${name}（${role}）`
}

/**
 * 取消紀錄區塊（類別、原因、取消人、時間、堂數）。
 * 舊資料（legacy）：教練端只顯示類別與時間；學員端只顯示「改版前取消，沒有詳細紀錄」。
 */
export function CancelRecord({
  viewer,
  category,
  reason,
  actorRole,
  cancelledAt,
  disposition,
  actorName,
}: CancelRecordProps) {
  const isLegacy = category === 'legacy'

  if (isLegacy && viewer === 'customer') {
    return (
      <p className="font-cjk rounded-xl bg-muted px-3 py-2.5 text-[13px] text-muted-foreground">
        改版前取消，沒有詳細紀錄
      </p>
    )
  }

  const time = cancelledAt ? formatTaipeiDateTime(cancelledAt, { withYear: true }) : '—'

  return (
    <dl className="font-cjk flex flex-col gap-1.5 rounded-xl bg-muted px-3 py-2.5 text-[13px]">
      <Row label="類別">{CANCEL_CATEGORY_LABEL[category] ?? '—'}</Row>
      {!isLegacy && <Row label="原因">{reason?.trim() ? reason : '—'}</Row>}
      {!isLegacy && (
        <Row label="取消人">{actorRole ? cancelActorLabel(actorRole, viewer, actorName) : '—'}</Row>
      )}
      <Row label="時間">{time}</Row>
      {!isLegacy && <Row label="堂數">{disposition ? classDispositionText(disposition) : '—'}</Row>}
    </dl>
  )
}
