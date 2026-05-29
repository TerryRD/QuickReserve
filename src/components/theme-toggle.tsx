'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Monitor, Moon, Sun } from 'lucide-react'

const ORDER = ['light', 'dark', 'system'] as const
type Mode = (typeof ORDER)[number]

const LABEL: Record<Mode, string> = {
  light: '日',
  dark: '夜',
  system: '系統',
}

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div
        aria-hidden
        className={`inline-flex h-9 w-[112px] items-center rounded-full border border-border bg-card ${className ?? ''}`}
      />
    )
  }

  const current = (theme as Mode) ?? 'system'

  return (
    <div
      className={`inline-flex items-center gap-0.5 rounded-full border border-border bg-card p-1 text-card-foreground ${className ?? ''}`}
      role="radiogroup"
      aria-label="主題切換"
    >
      {ORDER.map((mode) => {
        const Icon = mode === 'light' ? Sun : mode === 'dark' ? Moon : Monitor
        const active = current === mode
        return (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={LABEL[mode]}
            onClick={() => setTheme(mode)}
            className={
              active
                ? 'inline-flex h-7 items-center gap-1 rounded-full bg-primary px-2.5 text-primary-foreground transition-colors'
                : 'inline-flex h-7 items-center gap-1 rounded-full bg-transparent px-2.5 text-foreground/70 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
            }
          >
            <Icon className="size-3.5" />
            <span className="font-mono text-[10px] tracking-wider">{LABEL[mode]}</span>
          </button>
        )
      })}
    </div>
  )
}
