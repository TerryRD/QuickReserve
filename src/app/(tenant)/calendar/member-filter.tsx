'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Users } from 'lucide-react'
import { useState } from 'react'

type Member = {
  id: string
  role: string
  label: string
  isSelf: boolean
}

export default function MemberFilter({
  members,
  selectedIds,
  week,
}: {
  members: Member[]
  selectedIds: string[]
  week?: string
}) {
  const router = useRouter()
  const params = useSearchParams()
  const [open, setOpen] = useState(false)

  const isAll = selectedIds.length === members.length
  const selected = new Set(selectedIds)

  function update(newSelected: string[]) {
    const all = newSelected.length === members.length
    const usp = new URLSearchParams(params.toString())
    if (all) usp.delete('members')
    else usp.set('members', newSelected.join(','))
    if (week) usp.set('week', week)
    router.push(`/calendar?${usp.toString()}`)
  }

  function toggle(id: string) {
    const next = selected.has(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]
    if (next.length === 0) return // require at least 1
    update(next)
  }

  const summary = isAll
    ? `全部 ${members.length} 位`
    : selectedIds.length === 1
      ? (members.find((m) => m.id === selectedIds[0])?.label ?? '1 位')
      : `${selectedIds.length} 位`

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-sm hover:bg-muted"
      >
        <Users className="h-3.5 w-3.5" />
        <span>檢視：{summary}</span>
        <span className="text-xs text-muted-foreground">▾</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute left-0 top-full z-20 mt-1 min-w-56 rounded-lg border bg-popover p-2 shadow-md">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-xs font-medium text-muted-foreground">顯示成員時段</span>
              <button
                type="button"
                onClick={() => update(members.map((m) => m.id))}
                className="text-xs text-primary hover:underline"
              >
                全選
              </button>
            </div>
            <div className="mt-1 flex flex-col gap-0.5">
              {members.map((m) => (
                <label
                  key={m.id}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(m.id)}
                    onChange={() => toggle(m.id)}
                    className="h-4 w-4 rounded border-border accent-primary"
                  />
                  <span className="flex-1">{m.label}</span>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {m.role === 'owner' ? 'Owner' : 'Staff'}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
