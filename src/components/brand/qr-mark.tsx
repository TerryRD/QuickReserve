type Props = {
  size?: number
  className?: string
}

export function QRMark({ size = 32, className }: Props) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      aria-label="QuickReserve"
      className={className}
      style={{ display: 'block', flexShrink: 0 }}
    >
      <rect width="32" height="32" rx="9" fill="oklch(0.14 0 0)" stroke="rgba(255,255,255,0.10)" strokeWidth="1" />
      <path d="M 14.6 14.6 L 14.6 7.2 A 7.4 7.4 0 0 1 22 14.6 Z" fill="oklch(0.91 0.19 102)" />
      <circle cx="14.6" cy="14.6" r="7.8" fill="none" stroke="#FFFFFF" strokeWidth="2.4" />
      <circle cx="14.6" cy="14.6" r="1.3" fill="#FFFFFF" />
      <line x1="17.4" y1="17.4" x2="22.6" y2="22.6" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  )
}
