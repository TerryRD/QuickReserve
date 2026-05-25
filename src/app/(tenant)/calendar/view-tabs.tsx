'use client'

type View = 'week' | 'day' | 'list'

export default function ViewTabs({
  current,
  onChange,
}: {
  current: View
  onChange: (next: View) => void
}) {
  const items: Array<{ value: View; label: string }> = [
    { value: 'week', label: '週' },
    { value: 'day', label: '日' },
    { value: 'list', label: '列表' },
  ]
  return (
    <div className="inline-flex rounded-lg border bg-card p-0.5 text-sm">
      {items.map((it) => {
        const active = current === it.value
        return (
          <button
            type="button"
            key={it.value}
            onClick={() => onChange(it.value)}
            className={`rounded-md px-3 py-1 transition ${
              active
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            {it.label}
          </button>
        )
      })}
    </div>
  )
}
