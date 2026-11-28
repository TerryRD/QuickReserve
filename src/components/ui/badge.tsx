import type { ReactNode } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { BOOKING_STATUS_LABEL, type BookingStatus } from '@/lib/booking-terms'
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

export type StatusType = BookingStatus

const STATUS_VARIANT: Record<StatusType, Props['variant']> = {
  pending: 'yellow',
  confirmed: 'black',
  cancelled: 'outline',
  completed: 'mutedOutline',
  no_show: 'outline',
}

export function StatusBadge({ status, className }: { status: StatusType; className?: string }) {
  return (
    <Badge variant={STATUS_VARIANT[status]} className={className}>
      {BOOKING_STATUS_LABEL[status]}
    </Badge>
  )
}

export { badgeVariants }
