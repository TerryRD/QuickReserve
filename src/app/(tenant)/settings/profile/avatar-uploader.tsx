'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { buttonVariants } from '@/components/ui/button'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type Props = {
  tenantId: string
  initialUrl: string | null
  onUploaded: (publicUrl: string) => void
  onCleared: () => void
}

const ACCEPT = 'image/jpeg,image/png,image/webp'
const MAX_BYTES = 5 * 1024 * 1024

export default function AvatarUploader({ tenantId, initialUrl, onUploaded, onCleared }: Props) {
  const [pending, start] = useTransition()
  const [url, setUrl] = useState<string | null>(initialUrl)

  function handleFile(file: File) {
    if (!ACCEPT.split(',').includes(file.type)) {
      toast.error('僅接受 JPEG / PNG / WebP')
      return
    }
    if (file.size > MAX_BYTES) {
      toast.error('檔案不可超過 5 MB')
      return
    }
    const ext = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/png' ? 'png' : 'webp'
    const path = `${tenantId}/avatar.${ext}`
    start(async () => {
      const sb = createSupabaseBrowserClient()
      const { error } = await sb.storage.from('coach-media').upload(path, file, {
        contentType: file.type,
        upsert: true,
      })
      if (error) {
        toast.error(error.message)
        return
      }
      const { data } = sb.storage.from('coach-media').getPublicUrl(path)
      setUrl(data.publicUrl)
      onUploaded(data.publicUrl)
      toast.success('已上傳，記得按下方「儲存」')
    })
  }

  return (
    <div className="space-y-3">
      <Label>大頭照（公開頁顯示）</Label>
      {url ? (
        <div className="flex items-center gap-4">
          <img src={url} alt="" className="h-20 w-20 rounded-full object-cover ring-2 ring-border" />
          <div className="flex flex-col gap-2">
            <label
              className={cn(
                buttonVariants({ variant: 'outline', size: 'sm' }),
                'cursor-pointer',
                pending && 'pointer-events-none opacity-50',
              )}
            >
              {pending ? '上傳中...' : '更換'}
              <input
                type="file"
                accept={ACCEPT}
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </label>
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => {
                setUrl(null)
                onCleared()
              }}
            >
              移除
            </Button>
          </div>
        </div>
      ) : (
        <label
          className={cn(
            buttonVariants({ variant: 'outline' }),
            'cursor-pointer',
            pending && 'pointer-events-none opacity-50',
          )}
        >
          {pending ? '上傳中...' : '選擇圖片'}
          <input
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </label>
      )}
      <p className="text-xs text-muted-foreground">建議 800×800 以上、JPEG/PNG/WebP、單檔 ≤ 5 MB。</p>
    </div>
  )
}
