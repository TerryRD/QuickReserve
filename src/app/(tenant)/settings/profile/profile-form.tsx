'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
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
  years_exp: number | null
  established_year: number | null
  city: string | null
}

function NumberedSection({
  no,
  title,
  eng,
  hint,
  children,
}: {
  no: string
  title: string
  eng: string
  hint?: string
  children: ReactNode
}) {
  return (
    <section className="grid gap-6 lg:grid-cols-[80px_1fr]">
      <div className="hidden lg:block">
        <div className="font-display grid size-14 place-items-center rounded-xl bg-accent text-2xl font-bold leading-none text-accent-foreground">
          {no}
        </div>
      </div>
      <div className="space-y-5">
        <div>
          <div className="flex items-baseline gap-3">
            <div className="font-display lg:hidden text-3xl font-black tabular-nums">{no}</div>
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {eng}
            </div>
          </div>
          <h2 className="font-display font-cjk mt-1 text-2xl font-black uppercase leading-tight">
            {title}
          </h2>
          {hint && (
            <p className="font-cjk mt-2 text-sm text-muted-foreground">{hint}</p>
          )}
        </div>
        {children}
      </div>
    </section>
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
  const [yearsExp, setYearsExp] = useState<string>(
    initial.years_exp != null ? String(initial.years_exp) : '',
  )
  const [establishedYear, setEstablishedYear] = useState<string>(
    initial.established_year != null ? String(initial.established_year) : '',
  )
  const [city, setCity] = useState<string>(initial.city ?? '')

  const { execute, isPending } = useAction(updateTenantProfileAction, {
    onSuccess: () => toast.success('已儲存'),
    onError: ({ error }) => toast.error(error.serverError?.message ?? '失敗'),
  })

  const isDirty = useMemo(() => {
    const normNum = (s: string) => (s.trim() === '' ? null : Number(s))
    return (
      name !== initial.name ||
      description !== (initial.description ?? '') ||
      contactEmail !== (initial.contact_email ?? '') ||
      contactPhone !== (initial.contact_phone ?? '') ||
      contactLineId !== (initial.contact_line_id ?? '') ||
      contactNote !== (initial.contact_note ?? '') ||
      avatarUrl !== (initial.avatar_url ?? '') ||
      bioHtml !== (initial.bio_html ?? '') ||
      introVideoUrl !== (initial.intro_video_url ?? '') ||
      normNum(yearsExp) !== (initial.years_exp ?? null) ||
      normNum(establishedYear) !== (initial.established_year ?? null) ||
      (city.trim() || null) !== (initial.city ?? null)
    )
  }, [
    name,
    description,
    contactEmail,
    contactPhone,
    contactLineId,
    contactNote,
    avatarUrl,
    bioHtml,
    introVideoUrl,
    yearsExp,
    establishedYear,
    city,
    initial,
  ])

  const onReset = () => {
    setName(initial.name)
    setDescription(initial.description ?? '')
    setContactEmail(initial.contact_email ?? '')
    setContactPhone(initial.contact_phone ?? '')
    setContactLineId(initial.contact_line_id ?? '')
    setContactNote(initial.contact_note ?? '')
    setAvatarUrl(initial.avatar_url ?? '')
    setBioHtml(initial.bio_html ?? '')
    setIntroVideoUrl(initial.intro_video_url ?? '')
    setYearsExp(initial.years_exp != null ? String(initial.years_exp) : '')
    setEstablishedYear(
      initial.established_year != null ? String(initial.established_year) : '',
    )
    setCity(initial.city ?? '')
  }

  return (
    <form
      className="space-y-12"
      onSubmit={(e) => {
        e.preventDefault()
        const yearsExpNum = yearsExp.trim() === '' ? null : Number(yearsExp)
        const establishedYearNum =
          establishedYear.trim() === '' ? null : Number(establishedYear)
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
          yearsExp: Number.isFinite(yearsExpNum) ? (yearsExpNum as number | null) : null,
          establishedYear: Number.isFinite(establishedYearNum)
            ? (establishedYearNum as number | null)
            : null,
          city: city.trim() || null,
        })
      }}
    >
      {/* 01 基本資料 (name + subtitle + avatar) */}
      <NumberedSection
        no="01"
        title="基本資料"
        eng="BASIC INFO"
        hint="公開頁顯示的核心資料。名稱與一句介紹會出現在 Hero 最上方。"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="font-mono text-[11px] uppercase tracking-wider">
              租戶名稱（公開顯示）
            </Label>
            <Input
              id="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="space-y-2">
            <Label
              htmlFor="description"
              className="font-mono text-[11px] uppercase tracking-wider"
            >
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
          <div className="pt-2">
            <Label className="font-mono mb-2 block text-[11px] uppercase tracking-wider">
              大頭照 · AVATAR
            </Label>
            <AvatarUploader
              tenantId={tenantId}
              initialUrl={avatarUrl || null}
              onUploaded={setAvatarUrl}
              onCleared={() => setAvatarUrl('')}
            />
          </div>
        </div>
      </NumberedSection>

      {/* 02 Hero 內容 (years_exp / established_year / city) */}
      <NumberedSection
        no="02"
        title="Hero 內容"
        eng="HERO META"
        hint="顯示在公開頁 Hero 區的執業年資、創立年份與所在城市。"
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label
              htmlFor="years_exp"
              className="font-mono text-[11px] uppercase tracking-wider"
            >
              執業年資（年）
            </Label>
            <Input
              id="years_exp"
              type="number"
              min={0}
              max={120}
              inputMode="numeric"
              value={yearsExp}
              onChange={(e) => setYearsExp(e.target.value)}
              placeholder="例：7"
              className={inputClass}
            />
          </div>
          <div className="space-y-2">
            <Label
              htmlFor="established_year"
              className="font-mono text-[11px] uppercase tracking-wider"
            >
              創立年份
            </Label>
            <Input
              id="established_year"
              type="number"
              min={1900}
              max={2100}
              inputMode="numeric"
              value={establishedYear}
              onChange={(e) => setEstablishedYear(e.target.value)}
              placeholder="例：2019"
              className={inputClass}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city" className="font-mono text-[11px] uppercase tracking-wider">
              城市 / 地區
            </Label>
            <Input
              id="city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="例：台北・內湖"
              className={inputClass}
            />
          </div>
        </div>
      </NumberedSection>

      {/* 03 聯絡資訊 */}
      <NumberedSection
        no="03"
        title="聯絡資訊"
        eng="CONTACT"
        hint="填的欄位會在你的公開預約頁顯示給學員。沒填的會隱藏。Email 用於系統通知、不會公開。"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="email" className="font-mono text-[11px] uppercase tracking-wider">
              EMAIL
            </Label>
            <Input
              id="email"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone" className="font-mono text-[11px] uppercase tracking-wider">
              PHONE · 電話
            </Label>
            <Input
              id="phone"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="line" className="font-mono text-[11px] uppercase tracking-wider">
              LINE ID
            </Label>
            <Input
              id="line"
              value={contactLineId}
              onChange={(e) => setContactLineId(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="note" className="font-mono text-[11px] uppercase tracking-wider">
              NOTE · 備註
            </Label>
            <Input
              id="note"
              value={contactNote}
              onChange={(e) => setContactNote(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
      </NumberedSection>

      {/* 04 關於我 (bio_html) */}
      <NumberedSection
        no="04"
        title="關於我"
        eng="ABOUT"
        hint="支援粗體 / 斜體 / 標題 / 清單 / 連結。儲存時會做 HTML 過濾。"
      >
        <BioEditor value={bioHtml} onChange={setBioHtml} />
      </NumberedSection>

      {/* 05 介紹影片 */}
      <NumberedSection
        no="05"
        title="介紹影片"
        eng="VIDEO"
        hint="支援 YouTube / Vimeo 公開連結，輸入後會即時預覽。"
      >
        <VideoInput value={introVideoUrl} onChange={setIntroVideoUrl} />
      </NumberedSection>

      {/* 06 環境照片 */}
      <NumberedSection
        no="06"
        title="環境照片"
        eng="GALLERY"
        hint="最多 10 張。JPEG / PNG / WebP，單檔 ≤ 5 MB。學員可在公開頁上點放大。"
      >
        <PhotoGalleryManager tenantId={tenantId} photos={photos} />
      </NumberedSection>

      {/* Sticky save bar */}
      <div
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur md:left-[240px]"
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-8 lg:px-10">
          <div className="flex items-center gap-3 min-w-0">
            <span
              aria-hidden
              className={
                'size-2 shrink-0 rounded-full ' +
                (isDirty ? 'bg-accent' : 'bg-muted-foreground/40')
              }
            />
            <div className="min-w-0">
              <div className="font-cjk text-sm font-semibold truncate">
                {isPending ? '儲存中…' : isDirty ? '有未儲存的變更' : '已同步'}
              </div>
              <div className="font-mono text-[10.5px] uppercase tracking-[0.05em] text-muted-foreground mt-0.5">
                {isDirty
                  ? 'UNSAVED · 點右側「儲存」以套用'
                  : 'SYNCED · 所有變更已儲存'}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="pill"
              onClick={onReset}
              disabled={!isDirty || isPending}
            >
              復原
            </Button>
            <Button
              type="submit"
              variant="default"
              size="pill"
              withArrow="inline"
              disabled={!isDirty || isPending}
            >
              {isPending ? '儲存中…' : '儲存所有變更'}
            </Button>
          </div>
        </div>
      </div>
    </form>
  )
}
