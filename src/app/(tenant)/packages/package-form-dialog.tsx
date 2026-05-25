'use client'

import { useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Plus, Pencil } from 'lucide-react'
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
import { createPackageAction, updatePackageAction } from './actions'

type Service = { id: string; name: string; duration_minutes: number }
type Package = {
  id: string
  service_id: string
  name: string
  class_count: number
  price: number
  expires_in_days: number | null
}

type Props =
  | { mode: 'create'; services: Service[]; pkg?: undefined }
  | { mode: 'edit'; services: Service[]; pkg: Package }

export default function PackageFormDialog(props: Props) {
  const isEdit = props.mode === 'edit'
  const [open, setOpen] = useState(false)
  const [serviceId, setServiceId] = useState(props.pkg?.service_id ?? props.services[0]?.id ?? '')
  const [name, setName] = useState(props.pkg?.name ?? '')
  const [classCount, setClassCount] = useState(String(props.pkg?.class_count ?? 10))
  const [price, setPrice] = useState(String(props.pkg?.price ?? ''))
  const [permanent, setPermanent] = useState(props.pkg?.expires_in_days === null)
  const [expiresInDays, setExpiresInDays] = useState(
    props.pkg?.expires_in_days != null ? String(props.pkg.expires_in_days) : '180',
  )

  const onSuccess = () => {
    toast.success(isEdit ? '已更新' : '已新增')
    setOpen(false)
  }
  const onError = ({ error }: { error: { serverError?: { message?: string } } }) =>
    toast.error(error.serverError?.message ?? '失敗')

  const create = useAction(createPackageAction, { onSuccess, onError })
  const update = useAction(updatePackageAction, { onSuccess, onError })

  function submit() {
    const payload = {
      serviceId,
      name,
      classCount,
      price,
      expiresInDays: permanent ? null : expiresInDays,
    }
    if (isEdit) update.execute({ ...payload, id: props.pkg.id })
    else create.execute(payload)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          isEdit ? (
            <Button variant="outline" size="sm">
              <Pencil className="mr-1 h-3.5 w-3.5" />
              編輯
            </Button>
          ) : (
            <Button>
              <Plus className="mr-1 h-3.5 w-3.5" />
              新增套裝
            </Button>
          )
        }
      />
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? '編輯套裝' : '新增套裝'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pkg-service">服務</Label>
            <select
              id="pkg-service"
              className="w-full rounded border p-2 text-sm"
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
            >
              {props.services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.duration_minutes} 分)
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pkg-name">名稱</Label>
            <Input
              id="pkg-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="單堂 / 10 堂套裝"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="pkg-count">堂數</Label>
              <Input
                id="pkg-count"
                type="number"
                min={1}
                value={classCount}
                onChange={(e) => setClassCount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pkg-price">售價</Label>
              <Input
                id="pkg-price"
                type="number"
                min={0}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>有效期</Label>
            <div className="flex items-center gap-3 text-sm">
              <label className="inline-flex items-center gap-1.5">
                <input
                  type="radio"
                  checked={!permanent}
                  onChange={() => setPermanent(false)}
                />
                <span>限期</span>
              </label>
              {!permanent && (
                <Input
                  type="number"
                  min={1}
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(e.target.value)}
                  className="w-24"
                />
              )}
              {!permanent && <span className="text-xs text-muted-foreground">天</span>}
              <label className="ml-2 inline-flex items-center gap-1.5">
                <input
                  type="radio"
                  checked={permanent}
                  onChange={() => setPermanent(true)}
                />
                <span>永久</span>
              </label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button onClick={submit} disabled={create.isPending || update.isPending || !name.trim()}>
            {create.isPending || update.isPending ? '處理中...' : isEdit ? '儲存' : '建立'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
