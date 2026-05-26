import { Suspense } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import PageSkeleton from '@/components/ui/page-skeleton'
import TemplatesSection from './templates-section'
import EventsSection from './events-section'
import EffectivePreview from './effective-preview'

export default function AvailabilityPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/calendar"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          回行事曆
        </Link>
        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">CALENDAR · 可用時段</div>
        <h1 className="font-display mt-2 text-3xl uppercase">
          可用<span className="font-cjk">時段</span>
        </h1>
        <p className="font-cjk mt-1 text-sm text-muted-foreground">
          設定每週固定可上課時段（作息模板）+ 臨時不可用區段（看醫生 / 休假 / 隨機事件）
        </p>
      </div>

      <section>
        <div className="mb-3">
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">01 · 作息模板</div>
          <h2 className="font-display mt-1 text-2xl uppercase leading-tight tracking-tight">
            <span className="font-cjk">作息</span> TEMPLATES
          </h2>
        </div>
        <Suspense fallback={<PageSkeleton rows={2} withHeader={false} />}>
          <TemplatesSection />
        </Suspense>
      </section>

      <section>
        <div className="mb-3">
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">02 · 不可用事件</div>
          <h2 className="font-display mt-1 text-2xl uppercase leading-tight tracking-tight">
            <span className="font-cjk">不可用</span> EVENTS
          </h2>
        </div>
        <Suspense fallback={<PageSkeleton rows={3} withHeader={false} />}>
          <EventsSection />
        </Suspense>
      </section>

      <section>
        <div className="mb-3">
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">03 · 生效摘要</div>
          <h2 className="font-display mt-1 text-2xl uppercase leading-tight tracking-tight">
            未來 2 週 <span className="font-cjk">生效摘要</span>
          </h2>
        </div>
        <Suspense fallback={<PageSkeleton rows={2} withHeader={false} />}>
          <EffectivePreview />
        </Suspense>
      </section>
    </div>
  )
}
