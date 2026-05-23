'use client'

import { useRouter, useSearchParams } from 'next/navigation'

export default function TenantFilter({ tenants }: { tenants: { id: string; name: string }[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const current = searchParams.get('tenant') ?? ''

  return (
    <select
      value={current}
      onChange={(e) => {
        const v = e.target.value
        const qs = new URLSearchParams(searchParams.toString())
        if (v) qs.set('tenant', v)
        else qs.delete('tenant')
        router.push(`/platform/bookings${qs.toString() ? `?${qs}` : ''}`)
      }}
      className="rounded-md border bg-card px-2 py-1.5 text-xs"
    >
      <option value="">所有租戶</option>
      {tenants.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </select>
  )
}
