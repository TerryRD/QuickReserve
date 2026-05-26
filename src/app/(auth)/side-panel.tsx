import { QRMark } from '@/components/brand/qr-mark'

type Props = {
  title: string
  lines: string[]
}

export function SidePanel({ title, lines }: Props) {
  return (
    <div className="relative hidden flex-col justify-between overflow-hidden border-l border-border bg-muted px-14 py-[72px] lg:flex">
      {/* Faded brand mark */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-7 -top-7 rotate-[-12deg] opacity-[0.06]"
      >
        <QRMark size={320} />
      </div>

      <div className="relative">
        <div className="font-mono mb-4 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          QUICKRESERVE / STUDENT
        </div>
        <h2 className="font-display font-cjk text-[56px] font-normal uppercase leading-[0.95] tracking-tight">
          {title}
        </h2>
      </div>

      <ul className="relative m-0 list-none space-y-[18px] p-0">
        {lines.map((line, i) => (
          <li key={i} className="flex items-start gap-3 font-cjk text-sm leading-relaxed">
            <span className="font-mono inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-accent-foreground">
              {i + 1}
            </span>
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
