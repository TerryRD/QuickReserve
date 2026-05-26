'use client'

import { useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PrimaryCta } from '@/components/ui/primary-cta'
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

function SectionTitle({ kicker, title, eng, hint }: { kicker: string; title: string; eng: string; hint?: string }) {
  return (
    <div>
      <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        {kicker}
      </div>
      <h2 className="font-display mt-1 flex flex-wrap items-baseline gap-3 text-2xl uppercase leading-tight tracking-tight">
        <span className="font-cjk">{title}</span>
        <span className="relative inline-block text-xl">
          {eng}
          <span aria-hidden className="absolute inset-x-0 -bottom-0.5 h-1 rounded bg-accent" />
        </span>
      </h2>
      {hint && <p className="font-cjk mt-1.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

const inputClass = 'font-cjk h-11 rounded-xl border-2 border-border bg-background px-4 text-sm'

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
      className="space-y-10 pb-24"
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
        <SectionTitle kicker="01 · 基本資料" title="基本資料" eng="BASIC" />
        <div className="space-y-2">
          <Label htmlFor="name" className="font-mono text-[11px] uppercase tracking-wider">
            租戶名稱（公開顯示）
          </Label>
          <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="description" className="font-mono text-[11px] uppercase tracking-wider">
            一句介紹（HERO 副標）
          </Label>
          <Input
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="例如：10 年桌球教學經驗，國手級指導..."
            className={inputClass}
          />
        </div>
      </section>

      <section className="space-y-4">
        <SectionTitle kicker="02 · HERO 大頭照" title="大頭照" eng="AVATAR" />
        <AvatarUploader
          tenantId={tenantId}
          initialUrl={avatarUrl || null}
          onUploaded={setAvatarUrl}
          onCleared={() => setAvatarUrl('')}
        />
      </section>

      <section className="space-y-4">
        <SectionTitle kicker="03 · 完整介紹" title="自我介紹" eng="BIO" hint="支援粗體 / 斜體 / 標題 / 清單 / 連結。儲存時會做 HTML 過濾。" />
        <BioEditor value={bioHtml} onChange={setBioHtml} />
      </section>

      <section className="space-y-4">
        <SectionTitle kicker="04 · 介紹影片" title="介紹影片" eng="VIDEO" hint="支援 YouTube / Vimeo 連結。" />
        <VideoInput value={introVideoUrl} onChange={setIntroVideoUrl} />
      </section>

      <section className="space-y-4">
        <SectionTitle kicker="05 · 環境照片" title="照片" eng="PHOTOS" hint="最多 10 張。JPEG / PNG / WebP，單檔 ≤ 5 MB。" />
        <PhotoGalleryManager tenantId={tenantId} photos={photos} />
      </section>

      <section className="space-y-4">
        <SectionTitle kicker="06 · 聯絡方式" title="聯絡方式" eng="CONTACT" hint="填的欄位會在你的公開預約頁顯示給學員。沒填的會隱藏。" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="email" className="font-mono text-[11px] uppercase tracking-wider">EMAIL</Label>
            <Input id="email" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className={inputClass} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone" className="font-mono text-[11px] uppercase tracking-wider">PHONE · 電話</Label>
            <Input id="phone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className={inputClass} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="line" className="font-mono text-[11px] uppercase tracking-wider">LINE ID</Label>
            <Input id="line" value={contactLineId} onChange={(e) => setContactLineId(e.target.value)} className={inputClass} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="note" className="font-mono text-[11px] uppercase tracking-wider">NOTE · 備註</Label>
            <Input id="note" value={contactNote} onChange={(e) => setContactNote(e.target.value)} className={inputClass} />
          </div>
        </div>
      </section>

      <div className="sticky bottom-0 -mx-5 border-t border-border bg-background/95 px-5 py-4 backdrop-blur sm:-mx-8 sm:px-8 lg:-mx-10 lg:px-10">
        <PrimaryCta type="submit" disabled={isPending} className="w-full max-w-md justify-between sm:w-auto">
          {isPending ? '儲存中...' : '儲存所有變更'}
        </PrimaryCta>
      </div>
    </form>
  )
}
