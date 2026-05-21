'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import SuspendButton from './suspend-button'
import { TenantRowActions } from './tenant-row-actions'

type Tenant = {
  id: string
  slug: string
  name: string
  status: string
  created_at: string
  ownerMember?: {
    id: string
    status: string
    invited_email: string | null
    user_id: string | null
  } | null
}

export default function TenantsTable({ tenants }: { tenants: Tenant[] }) {
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all')

  const filtered = useMemo(() => {
    const lower = q.trim().toLowerCase()
    return tenants.filter((t) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false
      if (!lower) return true
      return (
        t.name.toLowerCase().includes(lower) ||
        t.slug.toLowerCase().includes(lower) ||
        (t.ownerMember?.invited_email ?? '').toLowerCase().includes(lower)
      )
    })
  }, [tenants, q, statusFilter])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜尋名稱 / slug / email..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1 text-xs">
          {(['all', 'active', 'suspended'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`rounded-md border px-3 py-1.5 ${
                statusFilter === s
                  ? 'border-primary bg-primary text-primary-foreground font-medium'
                  : 'border-border bg-card hover:bg-muted'
              }`}
            >
              {s === 'all' ? '全部' : s === 'active' ? '啟用中' : '已暫停'}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <table className="w-full">
          <thead className="bg-muted/40">
            <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="p-3">Slug / 名稱</th>
              <th className="p-3">Owner</th>
              <th className="p-3">狀態</th>
              <th className="p-3">建立</th>
              <th className="p-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => {
              const isInvitedPending =
                t.ownerMember?.status === 'invited' || !t.ownerMember?.user_id
              return (
                <tr key={t.id} className="border-t text-sm">
                  <td className="p-3">
                    <Link
                      href={`/platform/tenants/${t.id}`}
                      className="block font-medium hover:underline"
                    >
                      {t.name}
                    </Link>
                    <span className="font-mono text-xs text-muted-foreground">
                      /{t.slug}
                    </span>
                  </td>
                  <td className="p-3 text-xs">
                    {t.ownerMember?.invited_email ?? '—'}
                    {isInvitedPending && (
                      <span className="ml-2 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800">
                        邀請中
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    {t.status === 'active' ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">
                        啟用中
                      </span>
                    ) : (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-800">
                        已暫停
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {new Date(t.created_at).toLocaleDateString('zh-TW')}
                  </td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1">
                      <SuspendButton
                        tenantId={t.id}
                        currentStatus={t.status as 'active' | 'suspended'}
                      />
                      {t.ownerMember && (
                        <TenantRowActions
                          memberId={t.ownerMember.id}
                          isInvitedPending={isInvitedPending}
                          hasUserId={!!t.ownerMember.user_id}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
            {!filtered.length && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-sm text-muted-foreground">
                  {q || statusFilter !== 'all' ? '無符合條件' : '尚無租戶'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-muted-foreground">
        共 {filtered.length} / {tenants.length} 筆
      </div>
    </div>
  )
}
