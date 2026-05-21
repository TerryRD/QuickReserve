'use client'

import { useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateTenantProfileAction } from './actions'

type Profile = {
  name: string
  description: string | null
  contact_email: string | null
  contact_phone: string | null
  contact_line_id: string | null
  contact_note: string | null
}

export default function ProfileForm({ initial }: { initial: Profile }) {
  const [name, setName] = useState(initial.name)
  const [description, setDescription] = useState(initial.description ?? '')
  const [contactEmail, setContactEmail] = useState(initial.contact_email ?? '')
  const [contactPhone, setContactPhone] = useState(initial.contact_phone ?? '')
  const [contactLineId, setContactLineId] = useState(initial.contact_line_id ?? '')
  const [contactNote, setContactNote] = useState(initial.contact_note ?? '')

  const { execute, isPending } = useAction(updateTenantProfileAction, {
    onSuccess: () => toast.success('已儲存'),
    onError: ({ error }) => toast.error(error.serverError?.message ?? '失敗'),
  })

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault()
        execute({
          name,
          description: description || null,
          contactEmail: contactEmail || null,
          contactPhone: contactPhone || null,
          contactLineId: contactLineId || null,
          contactNote: contactNote || null,
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
          <Label htmlFor="description">自我介紹（公開顯示）</Label>
          <Input
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="例如：10 年桌球教學經驗，國手級指導..."
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-xl">聯絡方式（公開顯示）</h2>
        <p className="text-xs text-muted-foreground">
          填的欄位會在你的公開預約頁顯示給學員。沒填的欄位會隱藏。
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="coach@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">電話</Label>
            <Input
              id="phone"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="0912-345-678"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="line">LINE ID</Label>
            <Input
              id="line"
              value={contactLineId}
              onChange={(e) => setContactLineId(e.target.value)}
              placeholder="@your-coach"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="note">備註</Label>
            <Input
              id="note"
              value={contactNote}
              onChange={(e) => setContactNote(e.target.value)}
              placeholder="預約後請加 LINE 確認場地"
            />
          </div>
        </div>
      </section>

      <Button type="submit" disabled={isPending}>
        {isPending ? '儲存中...' : '儲存'}
      </Button>
    </form>
  )
}
