import Link from 'next/link'

type View = 'week' | 'day' | 'list'

export default function ViewTabs({
  current,
  query,
}: {
  current: View
  query: string // e.g. "week=2026-05-21&members=all" without leading ?
}) {
  const items: Array<{ value: View; label: string }> = [
    { value: 'week', label: '週' },
    { value: 'day', label: '日' },
    { value: 'list', label: '列表' },
  ]
  return (
    <div className="inline-flex rounded-lg border bg-card p-0.5 text-sm">
      {items.map((it) => {
        const usp = new URLSearchParams(query)
        if (it.value === 'week') usp.delete('view')
        else usp.set('view', it.value)
        const href = `/calendar${usp.toString() ? `?${usp.toString()}` : ''}`
        const active = current === it.value
        return (
          <Link
            key={it.value}
            href={href}
            className={`rounded-md px-3 py-1 transition ${
              active
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            {it.label}
          </Link>
        )
      })}
    </div>
  )
}
