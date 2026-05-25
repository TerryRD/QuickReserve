'use client'

import { useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import ConfirmDialog from '@/components/confirm-dialog'
import {
  createTemplateAction,
  updateTemplateWindowsAction,
  renameTemplateAction,
  deleteTemplateAction,
  assignTemplateAction,
} from './actions'

type Window = { weekday: number; start_time: string; end_time: string }

type Props =
  | { template: { id: string; name: string; windows: Window[] }; isActive: boolean }
  | { template: null; isActive: false }

const WEEKDAY_LABELS = ['', '週一', '週二', '週三', '週四', '週五', '週六', '週日']

export default function TemplateEditor(props: Props) {
  const isNew = props.template === null
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(isNew ? '' : props.template.name)
  const [windows, setWindows] = useState<Window[]>(isNew ? [] : props.template.windows)
  const today = new Date().toISOString().slice(0, 10)

  const create = useAction(createTemplateAction, {
    onSuccess: () => {
      toast.success('模板已建立')
      setOpen(false)
    },
    onError: ({ error }) => toast.error(error.serverError?.message ?? '建立失敗'),
  })
  const rename = useAction(renameTemplateAction, {
    onError: ({ error }) => toast.error(error.serverError?.message ?? '改名失敗'),
  })
  const updateWindows = useAction(updateTemplateWindowsAction, {
    onSuccess: () => {
      toast.success('模板已更新')
      setOpen(false)
    },
    onError: ({ error }) => toast.error(error.serverError?.message ?? '更新失敗'),
  })
  const del = useAction(deleteTemplateAction, {
    onSuccess: () => toast.success('模板已刪除'),
    onError: ({ error }) => toast.error(error.serverError?.message ?? '刪除失敗'),
  })
  const assign = useAction(assignTemplateAction, {
    onSuccess: () => toast.success('模板已切換為生效'),
    onError: ({ error }) => toast.error(error.serverError?.message ?? '切換失敗'),
  })

  function addWindow(weekday: number) {
    setWindows((cur) => [...cur, { weekday, start_time: '09:00', end_time: '17:00' }])
  }

  function removeWindow(idx: number) {
    setWindows((cur) => cur.filter((_, i) => i !== idx))
  }

  function updateWindow(idx: number, field: keyof Window, value: string | number) {
    setWindows((cur) => cur.map((w, i) => (i === idx ? { ...w, [field]: value } : w)))
  }

  async function submit() {
    if (isNew) {
      create.execute({ name, windows })
    } else {
      if (name !== props.template.name) {
        const renameResult = await rename.executeAsync({ templateId: props.template.id, name })
        if (renameResult?.serverError) return // toast already shown by onError
      }
      updateWindows.execute({ templateId: props.template.id, windows })
    }
  }

  const pending = create.isPending || updateWindows.isPending || rename.isPending

  function renderEditor() {
    return (
      <>
        <DialogHeader>
          <DialogTitle>{isNew ? '新增模板' : `編輯模板「${props.template!.name}」`}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tmpl-name">模板名稱</Label>
            <Input
              id="tmpl-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="日常作息 / 夏季作息 / 週末班"
            />
          </div>

          <div className="space-y-2">
            <Label>每週時段（可同一天多段）</Label>
            <div className="space-y-2">
              {[1, 2, 3, 4, 5, 6, 7].map((wd) => {
                const dayWindows = windows
                  .map((w, idx) => ({ ...w, idx }))
                  .filter((w) => w.weekday === wd)
                return (
                  <div key={wd} className="flex flex-wrap items-center gap-2 rounded border p-2">
                    <div className="w-12 text-sm font-medium">{WEEKDAY_LABELS[wd]}</div>
                    <div className="flex flex-1 flex-wrap items-center gap-2">
                      {dayWindows.length === 0 ? (
                        <span className="text-xs text-muted-foreground">休</span>
                      ) : (
                        dayWindows.map((w) => (
                          <span
                            key={w.idx}
                            className="inline-flex items-center gap-1 rounded bg-muted px-2 py-1 text-xs"
                          >
                            <Input
                              type="time"
                              value={w.start_time.slice(0, 5)}
                              onChange={(e) =>
                                updateWindow(w.idx, 'start_time', e.target.value)
                              }
                              className="h-7 w-24"
                            />
                            <span>–</span>
                            <Input
                              type="time"
                              value={w.end_time.slice(0, 5)}
                              onChange={(e) => updateWindow(w.idx, 'end_time', e.target.value)}
                              className="h-7 w-24"
                            />
                            <button
                              type="button"
                              onClick={() => removeWindow(w.idx)}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              ✕
                            </button>
                          </span>
                        ))
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addWindow(wd)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>


        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button onClick={submit} disabled={pending || !name.trim()}>
            {pending ? '處理中...' : isNew ? '建立' : '儲存'}
          </Button>
        </DialogFooter>
      </>
    )
  }

  if (isNew) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={<Button variant="outline"><Plus className="mr-1 h-3.5 w-3.5" />新增模板</Button>} />
        <DialogContent className="max-w-2xl">{renderEditor()}</DialogContent>
      </Dialog>
    )
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-xl italic">{props.template.name}</h3>
            {props.isActive && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
                生效中
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {props.template.windows.length === 0
              ? '尚未設定任何時段（全週休）'
              : summarizeWindows(props.template.windows)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!props.isActive && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                assign.execute({ templateId: props.template!.id, effectiveFrom: today })
              }
              disabled={assign.isPending}
            >
              切換為生效
            </Button>
          )}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button variant="outline" size="sm"><Pencil className="mr-1 h-3.5 w-3.5" />編輯</Button>} />
            <DialogContent className="max-w-2xl">{renderEditor()}</DialogContent>
          </Dialog>
          <ConfirmDialog
            trigger={
              <Button variant="outline" size="sm">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            }
            title={`刪除模板「${props.template.name}」？`}
            description="刪除後無法復原。若此模板被任何 assignment 引用，需先切換到其他模板才能刪除。"
            confirmLabel="刪除"
            variant="destructive"
            onConfirm={() => del.execute({ templateId: props.template!.id })}
          />
        </div>
      </div>
    </div>
  )
}

function summarizeWindows(windows: Window[]): string {
  const byDay = new Map<number, Window[]>()
  for (const w of windows) {
    const arr = byDay.get(w.weekday) ?? []
    arr.push(w)
    byDay.set(w.weekday, arr)
  }
  const labels: string[] = []
  for (const wd of [1, 2, 3, 4, 5, 6, 7]) {
    const arr = byDay.get(wd)
    if (!arr || arr.length === 0) continue
    const segments = arr
      .map((w) => `${w.start_time.slice(0, 5)}–${w.end_time.slice(0, 5)}`)
      .join(', ')
    labels.push(`${WEEKDAY_LABELS[wd]} ${segments}`)
  }
  return labels.join('；')
}
