import { Button as ButtonPrimitive } from '@base-ui/react/button'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

type PrimaryCtaProps = ButtonPrimitive.Props & {
  size?: 'md' | 'lg'
  className?: string
}

function ctaClasses(size: 'md' | 'lg', extra?: string) {
  const h = size === 'lg' ? 'h-[52px]' : 'h-11'
  const padding = size === 'lg' ? 'pl-7 pr-2' : 'pl-5 pr-1.5'
  const text = size === 'lg' ? 'text-[14.5px]' : 'text-[13.5px]'
  return cn(
    'group/cta inline-flex items-center gap-3.5 rounded-full',
    'bg-primary text-primary-foreground font-semibold',
    'transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/40',
    'active:translate-y-px disabled:pointer-events-none disabled:opacity-50',
    'tracking-wide',
    h,
    padding,
    text,
    extra,
  )
}

function ctaRingClasses(size: 'md' | 'lg') {
  return cn(
    'inline-flex items-center justify-center rounded-full',
    'bg-accent text-accent-foreground',
    'transition-transform group-hover/cta:translate-x-0.5',
    size === 'lg' ? 'size-9' : 'size-8',
  )
}

export function PrimaryCta({ size = 'lg', className, children, ...rest }: PrimaryCtaProps) {
  return (
    <ButtonPrimitive
      data-slot="primary-cta"
      className={ctaClasses(size, className)}
      {...rest}
    >
      {children}
      <span className={ctaRingClasses(size)}>
        <ArrowRight className="size-3.5" />
      </span>
    </ButtonPrimitive>
  )
}

type PrimaryCtaLinkProps = {
  href: string
  size?: 'md' | 'lg'
  className?: string
  children: ReactNode
}

export function PrimaryCtaLink({ href, size = 'lg', className, children }: PrimaryCtaLinkProps) {
  return (
    <Link href={href} className={ctaClasses(size, className)}>
      {children}
      <span className={ctaRingClasses(size)}>
        <ArrowRight className="size-3.5" />
      </span>
    </Link>
  )
}
