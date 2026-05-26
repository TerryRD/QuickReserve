'use client'

import { useState, useTransition } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { addPhotoAction, updatePhotoCaptionAction, deletePhotoAction } from './photo-actions'

const PHOTO_LIMIT = 10
const ACCEPT = 'image/jpeg,image/png,image/webp'
const MAX_BYTES = 5 * 1024 * 1024

export type PhotoRow = {
  id: string
  storage_path: string
  caption: string | null
  public_url: string
}

type Props = {
  tenantId: string
  photos: PhotoRow[]
}

export default function PhotoGalleryManager({ tenantId, photos }: Props) {
  const [pending, start] = useTransition()
  const addAct = useAction(addPhotoAction, {
    onError: ({ error }) => toast.error(error.serverError?.message ?? '加入失敗'),
    onSuccess: () => toast.success('已加入照片'),
  })
  const captionAct = useAction(updatePhotoCaptionAction, {
    onError: ({ error }) => toast.error(error.serverError?.message ?? '更新失敗'),
    onSuccess: () => toast.success('已儲存說明'),
  })
  const deleteAct = useAction(deletePhotoAction, {
    onError: ({ error }) => toast.error(error.serverError?.message ?? '刪除失敗'),
    onSuccess: () => toast.success('已刪除照片'),
  })

  function uploadFiles(files: FileList | null) {
    if (!files) return
    const remaining = PHOTO_LIMIT - photos.length
    if (remaining <= 0) {
      toast.error(`已達 ${PHOTO_LIMIT} 張上限`)
      return
    }
    const list = Array.from(files).slice(0, remaining)
    start(async () => {
      const sb = createSupabaseBrowserClient()
      for (const file of list) {
        if (!ACCEPT.split(',').includes(file.type)) {
          toast.error(`${file.name}: 僅接受 JPEG/PNG/WebP`)
          continue
        }
        if (file.size > MAX_BYTES) {
          toast.error(`${file.name}: 超過 5 MB`)
          continue
        }
        const ext = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/png' ? 'png' : 'webp'
        const path = `${tenantId}/photo-${crypto.randomUUID()}.${ext}`
        const { error } = await sb.storage.from('coach-media').upload(path, file, {
          contentType: file.type,
          upsert: false,
        })
        if (error) {
          toast.error(`${file.name}: ${error.message}`)
          continue
        }
        addAct.execute({ storagePath: path, caption: null })
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>照片</Label>
        <span className="text-xs text-muted-foreground">
          {photos.length} / {PHOTO_LIMIT}
        </span>
      </div>

      {photos.length === 0 ? (
        <p className="text-sm text-muted-foreground">尚未上傳照片</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {photos.map((p) => (
            <div key={p.id} className="space-y-2 rounded-lg border bg-card p-2">
              <img src={p.public_url} alt={p.caption ?? ''} className="aspect-square w-full rounded object-cover" />
              <Input
                defaultValue={p.caption ?? ''}
                placeholder="說明（選填）"
                onBlur={(e) => {
                  if (e.target.value !== (p.caption ?? '')) {
                    captionAct.execute({ id: p.id, caption: e.target.value || null })
                  }
                }}
              />
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => deleteAct.execute({ id: p.id })}
              >
                刪除
              </Button>
            </div>
          ))}
        </div>
      )}

      {photos.length < PHOTO_LIMIT && (
        <label
          className={cn(
            buttonVariants({ variant: 'outline' }),
            'cursor-pointer',
            pending && 'pointer-events-none opacity-50',
          )}
        >
          {pending ? '上傳中...' : '加入照片'}
          <input
            type="file"
            accept={ACCEPT}
            multiple
            className="hidden"
            onChange={(e) => uploadFiles(e.target.files)}
          />
        </label>
      )}
      <p className="text-xs text-muted-foreground">最多 {PHOTO_LIMIT} 張、單檔 ≤ 5 MB（JPEG/PNG/WebP）。</p>
    </div>
  )
}
