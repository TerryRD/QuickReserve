'use client'
import { cn } from '@/lib/utils'

export type TimeChipState = 'open' | 'full' | 'group' | 'selected'

export function TimeChip({
  time,
  state,
  group,
  onSelect,
  className,
}: {
  time: string
  state: TimeChipState
  group?: { filled: number; capacity: number }
  onSelect: () => void
  className?: string
}) {
  const disabled = state === 'full'
  const isSelected = state === 'selected'
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={isSelected}
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-4 py-2 font-mono text-sm tracking-wider transition',
        isSelected && 'border-primary bg-primary text-primary-foreground',
        state === 'open' && 'border-border bg-card hover:border-foreground/40',
        state === 'group' && 'border-border bg-card hover:border-foreground/40',
        state === 'full' && 'border-border bg-muted text-muted-foreground line-through cursor-not-allowed',
        className,
      )}
    >
      <span>{time}</span>
      {state === 'group' && group && (
        <span
          className={cn(
            'rounded-full px-1.5 py-0.5 text-[10px] font-bold tracking-wider',
            isSelected
              ? 'bg-primary-foreground text-primary'
              : 'bg-accent text-accent-foreground',
          )}
        >
          {group.filled}/{group.capacity}
        </span>
      )}
    </button>
  )
}
