import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import CancelReasonDialog, { buildCancelReason } from '@/components/bookings/cancel-reason-dialog'

const PRESETS = ['生病', '工作', '交通', '天氣', '其他']

function renderDialog(props: Partial<Parameters<typeof CancelReasonDialog>[0]> = {}) {
  const onConfirm = vi.fn()
  render(
    <CancelReasonDialog
      trigger={<button type="button">開啟</button>}
      title="確定要取消此預約嗎？"
      confirmLabel="取消預約"
      isPending={false}
      onConfirm={onConfirm}
      {...props}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: '開啟' }))
  return { onConfirm }
}

const confirmButton = () => screen.getByRole('button', { name: '取消預約' })
const detailInput = () => screen.getByRole('textbox')

describe('CancelReasonDialog（有常用原因）', () => {
  it('未選原因時送出鈕停用，補充說明欄一直顯示且標「（選填）」', async () => {
    renderDialog({ presetReasons: PRESETS })
    await waitFor(() => expect(confirmButton()).toBeDisabled())
    expect(detailInput()).toBeInTheDocument()
    expect(screen.getByText('（選填）')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '返回' })).toBeInTheDocument()
  })

  it('選「生病」後送出 → onConfirm("生病")', async () => {
    const { onConfirm } = renderDialog({ presetReasons: PRESETS })
    fireEvent.click(await screen.findByRole('radio', { name: '生病' }))
    expect(confirmButton()).toBeEnabled()
    fireEvent.click(confirmButton())
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith('生病'))
  })

  it('一般選項＋補充說明 → 以全形冒號合併', async () => {
    const { onConfirm } = renderDialog({ presetReasons: PRESETS })
    fireEvent.click(await screen.findByRole('radio', { name: '工作' }))
    fireEvent.change(detailInput(), { target: { value: '  臨時要加班  ' } })
    fireEvent.click(confirmButton())
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith('工作：臨時要加班'))
  })

  it('選「其他」未填 → 停用並標「（必填）」；填「  臨時加班  」→ onConfirm("臨時加班")', async () => {
    const { onConfirm } = renderDialog({ presetReasons: PRESETS })
    fireEvent.click(await screen.findByRole('radio', { name: '其他' }))
    expect(screen.getByText('（必填）')).toBeInTheDocument()
    expect(confirmButton()).toBeDisabled()
    fireEvent.change(detailInput(), { target: { value: '   ' } })
    expect(confirmButton()).toBeDisabled()
    fireEvent.change(detailInput(), { target: { value: '  臨時加班  ' } })
    expect(confirmButton()).toBeEnabled()
    fireEvent.click(confirmButton())
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith('臨時加班'))
  })

  it('補充說明上限 480 字並顯示字數', async () => {
    renderDialog({ presetReasons: PRESETS })
    await screen.findByRole('radio', { name: '生病' })
    expect(detailInput()).toHaveAttribute('maxLength', '480')
    fireEvent.change(detailInput(), { target: { value: 'abc' } })
    expect(screen.getByText('3 / 480')).toBeInTheDocument()
  })
})

describe('CancelReasonDialog（沒有常用原因，教練端用法）', () => {
  it('只有空白 → 停用；輸入文字 → 可送出；上限 500 字；欄位名可傳入', async () => {
    const { onConfirm } = renderDialog({ reasonLabel: '拒絕原因', confirmLabel: '拒絕預約' })
    const confirm = () => screen.getByRole('button', { name: '拒絕預約' })
    await waitFor(() => expect(confirm()).toBeDisabled())
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    expect(screen.getByLabelText('拒絕原因＊')).toHaveAttribute('maxLength', '500')
    fireEvent.change(detailInput(), { target: { value: '  \n ' } })
    expect(confirm()).toBeDisabled()
    fireEvent.change(detailInput(), { target: { value: ' 教練臨時有事 ' } })
    expect(confirm()).toBeEnabled()
    fireEvent.click(confirm())
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith('教練臨時有事'))
  })
})

describe('CancelReasonDialog 關閉時機', () => {
  it('onConfirm 回傳 false 時保持開啟，其餘情況關閉', async () => {
    const onConfirm = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(undefined)
    renderDialog({ presetReasons: PRESETS, onConfirm })
    fireEvent.click(await screen.findByRole('radio', { name: '交通' }))
    fireEvent.click(confirmButton())
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1))
    expect(screen.getByText('確定要取消此預約嗎？')).toBeInTheDocument()
    fireEvent.click(confirmButton())
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.queryByText('確定要取消此預約嗎？')).not.toBeInTheDocument())
  })
})

describe('buildCancelReason', () => {
  it('依選項與補充說明組出原因', () => {
    expect(buildCancelReason(PRESETS, null, '')).toBeNull()
    expect(buildCancelReason(PRESETS, '天氣', '')).toBe('天氣')
    expect(buildCancelReason(PRESETS, '天氣', ' 颱風 ')).toBe('天氣：颱風')
    expect(buildCancelReason(PRESETS, '其他', '')).toBeNull()
    expect(buildCancelReason(PRESETS, '其他', ' 家裡有事 ')).toBe('家裡有事')
    expect(buildCancelReason(undefined, null, '   ')).toBeNull()
    expect(buildCancelReason(undefined, null, 'x'.repeat(501))).toBeNull()
    expect(buildCancelReason(undefined, null, 'x'.repeat(500))).toBe('x'.repeat(500))
  })
})
