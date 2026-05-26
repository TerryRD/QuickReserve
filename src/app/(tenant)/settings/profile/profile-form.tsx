// src/app/(tenant)/settings/profile/profile-form.tsx
'use client'

import { useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateTenantProfileAction } from './actions'
import AvatarUploader from './avatar-uploader'
import BioEditor from './bio-editor'
import VideoInput from './video-input'
import PhotoGalleryManager, { type PhotoRow } from './photo-gallery-manager'

type Profile = {
  name: string
  description: string | null
  contact_email: string | null
  contact_phone: string | null
  contact_line_id: string | null
  contact_note: string | null
  avatar_url: string | null
  bio_html: string | null
  intro_video_url: string | null
}

export default function ProfileForm({
  tenantId,
  initial,
  photos,
}: {
  tenantId: string
  initial: Profile
  photos: PhotoRow[]
}) {
  const [name, setName] = useState(initial.name)
  const [description, setDescription] = useState(initial.description ?? '')
  const [contactEmail, setContactEmail] = useState(initial.contact_email ?? '')
  const [contactPhone, setContactPhone] = useState(initial.contact_phone ?? '')
  const [contactLineId, setContactLineId] = useState(initial.contact_line_id ?? '')
  const [contactNote, setContactNote] = useState(initial.contact_note ?? '')
  const [avatarUrl, setAvatarUrl] = useState(initial.avatar_url ?? '')
  const [bioHtml, setBioHtml] = useState(initial.bio_html ?? '')
  const [introVideoUrl, setIntroVideoUrl] = useState(initial.intro_video_url ?? '')

  const { execute, isPending } = useAction(updateTenantProfileAction, {
    onSuccess: () => toast.success('已儲存'),
    onError: ({ error }) => toast.error(error.serverError?.message ?? '失敗'),
  })

  return (
    <form
      className="space-y-8"
      onSubmit={(e) => {
        e.preventDefault()
        execute({
          name,
          description: description || null,
          contactEmail: contactEmail || null,
          contactPhone: contactPhone || null,
          contactLineId: contactLineId || null,
          contactNote: contactNote || null,
          avatarUrl: avatarUrl || null,
          bioHtml: bioHtml || null,
          introVideoUrl: introVideoUrl || null,
        })
      }}
    >
      <section className="space-y-4">
        <h2 className="font-display text-xl">基本資料</h2>
        <div className="space-y-2">
          <Label htmlFor="name">租戶名稱（公開顯示）</Label>
          <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">一句介紹（hero 副標）</Label>
          <Input
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="例如：10 年桌球教學經驗，國手級指導..."
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-xl">Hero 大頭照</h2>
        <AvatarUploader
          tenantId={tenantId}
          initialUrl={avatarUrl || null}
          onUploaded={setAvatarUrl}
          onCleared={() => setAvatarUrl('')}
        />
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-xl">完整介紹（Bio）</h2>
        <p className="text-xs text-muted-foreground">支援粗體 / 斜體 / 標題 / 清單 / 連結。儲存時會做 HTML 過濾。</p>
        <BioEditor value={bioHtml} onChange={setBioHtml} />
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-xl">介紹影片</h2>
        <VideoInput value={introVideoUrl} onChange={setIntroVideoUrl} />
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-xl">照片</h2>
        <PhotoGalleryManager tenantId={tenantId} photos={photos} />
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-xl">聯絡方式（公開顯示）</h2>
        <p className="text-xs text-muted-foreground">填的欄位會在你的公開預約頁顯示給學員。沒填的會隱藏。</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">電話</Label>
            <Input id="phone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="line">LINE ID</Label>
            <Input id="line" value={contactLineId} onChange={(e) => setContactLineId(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="note">備註</Label>
            <Input id="note" value={contactNote} onChange={(e) => setContactNote(e.target.value)} />
          </div>
        </div>
      </section>

      <div className="sticky bottom-0 -mx-6 border-t bg-background/95 px-6 py-4 backdrop-blur">
        <Button type="submit" disabled={isPending} size="lg">
          {isPending ? '儲存中...' : '儲存所有變更'}
        </Button>
      </div>
    </form>
  )
}
