'use client'

import { useId, useState, type ReactElement, type ReactNode } from 'react'
import { Check } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'

/** 原因（含合併後）最多幾個字，與資料庫函式的 REASON_TOO_LONG 一致 */
const REASON_MAX = 500
/** 有常用原因時，補充說明的上限；保留空間給「選項：」前綴，確保合併後不超過 REASON_MAX */
const DETAIL_MAX_WITH_PRESET = 480
/** 選項與補充說明之間的分隔（全形冒號） */
const PRESET_SEPARATOR = '：'

export type CancelReasonDialogProps = {
  trigger: ReactElement
  title: string
  description?: ReactNode
  /**
   * 有給＝顯示常用原因選項（單選），最後一項視為「其他」；補充說明欄一直顯示，
   * 選一般選項時選填、選「其他」時必填，上限 480 字。
   * 沒給＝只有一個必填的原因文字欄，上限 500 字。
   */
  presetReasons?: string[]
  /** 原因欄位名稱，預設「取消原因」（教練端拒絕時可傳「拒絕原因」） */
  reasonLabel?: string
  /** 欄位下方的小字說明，例如「教練會看到你選的原因。」 */
  footnote?: ReactNode
  confirmLabel: string
  isPending: boolean
  /**
   * 收到去除前後空白後的原因；非空且不超過 500 字才會被呼叫。
   * 有常用原因時：一般選項＋補充 →「選項：補充」；一般選項無補充 → 選項；「其他」→ 補充說明。
   * 回傳 false（或 Promise<false>）時對話框保持開啟，其餘情況完成後關閉。
   */
  onConfirm: (reason: string) => void | boolean | Promise<void | boolean>
}

/** 依目前輸入組出要送出的原因；不合格時回傳 null */
export function buildCancelReason(
  presetReasons: string[] | undefined,
  selected: string | null,
  detail: string,
): string | null {
  const trimmedDetail = detail.trim()
  const hasPresets = !!presetReasons && presetReasons.length > 0

  let reason: string
  if (!hasPresets) {
    reason = trimmedDetail
  } else {
    if (selected === null) return null
    const isOther = selected === presetReasons[presetReasons.length - 1]
    if (isOther) reason = trimmedDetail
    else reason = trimmedDetail ? `${selected}${PRESET_SEPARATOR}${trimmedDetail}` : selected
  }

  if (reason.length === 0 || reason.length > REASON_MAX) return null
  return reason
}

export default function CancelReasonDialog({
  trigger,
  title,
  description,
  presetReasons,
  reasonLabel = '取消原因',
  footnote,
  confirmLabel,
  isPending,
  onConfirm,
}: CancelReasonDialogProps) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [detail, setDetail] = useState('')
  const detailId = useId()
  const groupLabelId = useId()

  const hasPresets = !!presetReasons && presetReasons.length > 0
  const otherOption = hasPresets ? presetReasons[presetReasons.length - 1] : null
  const isOther = hasPresets && selected === otherOption
  const detailMax = hasPresets ? DETAIL_MAX_WITH_PRESET : REASON_MAX
  const reason = buildCancelReason(presetReasons, selected, detail)

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      setSelected(null)
      setDetail('')
    }
  }

  async function handleConfirm() {
    if (reason === null || isPending) return
    const result = await onConfirm(reason)
    if (result !== false) handleOpenChange(false)
  }

  const detailLabel = hasPresets ? (
    <>
      補充說明
      <span className="font-normal text-muted-foreground">{isOther ? '（必填）' : '（選填）'}</span>
    </>
  ) : (
    <>{reasonLabel}＊</>
  )

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger render={trigger} />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>

        <div className="flex flex-col gap-3">
          {hasPresets && (
            <div className="flex flex-col gap-2">
              <div id={groupLabelId} className="text-sm font-medium">
                {reasonLabel}＊
              </div>
              <div
                role="radiogroup"
                aria-labelledby={groupLabelId}
                className="flex flex-wrap gap-2"
              >
                {presetReasons.map((option) => {
                  const isSelected = selected === option
                  return (
                    <button
                      key={option}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      disabled={isPending}
                      onClick={() => setSelected(option)}
                      className={cn(
                        'font-cjk inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12.5px] transition disabled:opacity-50',
                        isSelected
                          ? 'border-foreground bg-primary text-primary-foreground'
                          : 'border-border bg-card text-foreground hover:border-foreground/40',
                      )}
                    >
                      {isSelected && <Check className="size-3" strokeWidth={3} />}
                      {option}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label htmlFor={detailId} className="text-sm font-medium">
              {detailLabel}
            </label>
            <textarea
              id={detailId}
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              maxLength={detailMax}
              rows={3}
              disabled={isPending}
              className="font-cjk min-h-[72px] rounded-xl border border-border bg-card px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-foreground/20 disabled:opacity-50"
            />
            <div className="text-right text-xs text-muted-foreground">
              {detail.length} / {detailMax}
            </div>
          </div>

          {footnote && <p className="text-xs text-muted-foreground">{footnote}</p>}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>返回</AlertDialogCancel>
          <AlertDialogAction
            disabled={reason === null || isPending}
            onClick={handleConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
