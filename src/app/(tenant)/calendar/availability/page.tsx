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
        <h1 className="font-display text-3xl tracking-tight">
          <span className="italic">可用時段</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          設定每週固定可上課時段（作息模板）+ 臨時不可用區段（看醫生 / 休假 / 隨機事件）
        </p>
      </div>

      <section>
        <h2 className="mb-2 font-display text-xl">作息模板</h2>
        <Suspense fallback={<PageSkeleton rows={2} withHeader={false} />}>
          <TemplatesSection />
        </Suspense>
      </section>

      <section>
        <h2 className="mb-2 font-display text-xl">不可用事件</h2>
        <Suspense fallback={<PageSkeleton rows={3} withHeader={false} />}>
          <EventsSection />
        </Suspense>
      </section>

      <section>
        <h2 className="mb-2 font-display text-xl">未來 2 週生效摘要</h2>
        <Suspense fallback={<PageSkeleton rows={2} withHeader={false} />}>
          <EffectivePreview />
        </Suspense>
      </section>
    </div>
  )
}
