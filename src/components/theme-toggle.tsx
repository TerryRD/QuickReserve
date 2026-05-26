'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Monitor, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'

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
      className={`inline-flex items-center gap-0.5 rounded-full border border-border bg-card p-1 ${className ?? ''}`}
      role="radiogroup"
      aria-label="主題切換"
    >
      {ORDER.map((mode) => {
        const Icon = mode === 'light' ? Sun : mode === 'dark' ? Moon : Monitor
        const active = current === mode
        return (
          <Button
            key={mode}
            type="button"
            variant={active ? 'default' : 'ghost'}
            size="sm"
            role="radio"
            aria-checked={active}
            aria-label={LABEL[mode]}
            onClick={() => setTheme(mode)}
            className="h-7 gap-1 rounded-full px-2.5"
          >
            <Icon className="size-3.5" />
            <span className="font-mono text-[10px] tracking-wider">{LABEL[mode]}</span>
          </Button>
        )
      })}
    </div>
  )
}
