import type { ReactNode } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.06em]',
  {
    variants: {
      variant: {
        neutral: 'bg-secondary text-foreground',
        yellow: 'bg-accent text-accent-foreground',
        black: 'bg-primary text-primary-foreground',
        outline: 'border border-border bg-transparent text-foreground',
        mutedOutline: 'border border-border bg-transparent text-muted-foreground',
      },
    },
    defaultVariants: {
      variant: 'neutral',
    },
  },
)

type Props = {
  children: ReactNode
  icon?: ReactNode
  className?: string
} & VariantProps<typeof badgeVariants>

export function Badge({ children, icon, className, variant, ...rest }: Props) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...rest}>
      {icon}
      {children}
    </span>
  )
}

export type StatusType = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'

const STATUS_VARIANT: Record<StatusType, Props['variant']> = {
  pending: 'yellow',
  confirmed: 'black',
  cancelled: 'outline',
  completed: 'mutedOutline',
  no_show: 'outline',
}

const STATUS_LABEL: Record<StatusType, string> = {
  pending: '待確認',
  confirmed: '已確認',
  cancelled: '已取消',
  completed: '已完成',
  no_show: '未到場',
}

export function StatusBadge({ status, className }: { status: StatusType; className?: string }) {
  return (
    <Badge variant={STATUS_VARIANT[status]} className={className}>
      {STATUS_LABEL[status]}
    </Badge>
  )
}

export { badgeVariants }
