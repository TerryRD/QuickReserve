import { Suspense } from 'react'
import PageSkeleton from '@/components/ui/page-skeleton'
import { Kicker } from '@/components/ui/kicker'
import { SubNav } from '@/components/shell/sub-nav'
import { SectionHead } from '@/components/ui/section-head'
import TemplatesSection from './templates-section'
import EventsSection from './events-section'
import EffectivePreview from './effective-preview'

const SETTINGS_NAV_ITEMS = [
  { href: '/settings/profile', label: '公開頁', eng: 'PROFILE' },
  { href: '/settings/notifications', label: '通知', eng: 'NOTIF' },
  { href: '/calendar/availability', label: '作息', eng: 'AVAILABILITY' },
  { href: '/calendar/rules', label: '重複', eng: 'RULES' },
]

export default function AvailabilityPage() {
  return (
    <div className="space-y-7 pb-12">
      <div>
        <Kicker>SETTINGS · 教練設定</Kicker>
        <h1 className="font-display font-cjk mt-2 text-3xl font-black uppercase sm:text-4xl">
          作息模板
        </h1>
        <p className="font-cjk mt-2 text-sm text-muted-foreground">
          設定每週固定可上課時段（作息模板）+ 臨時不可用區段（看醫生 / 休假 / 隨機事件）
        </p>
      </div>

      <SubNav items={SETTINGS_NAV_ITEMS} active="/calendar/availability" />

      <section>
        <SectionHead
          kicker="01 · TEMPLATES"
          title="作息模板"
          eng="TEMPLATES"
          hint="設定每週的可用時段樣板"
        />
        <Suspense fallback={<PageSkeleton rows={2} withHeader={false} />}>
          <TemplatesSection />
        </Suspense>
      </section>

      <section>
        <SectionHead
          kicker="02 · EVENTS"
          title="不可用事件"
          eng="UNAVAILABLE"
          hint="休假、出差、個人預約"
        />
        <Suspense fallback={<PageSkeleton rows={3} withHeader={false} />}>
          <EventsSection />
        </Suspense>
      </section>

      <section>
        <SectionHead
          kicker="03 · PREVIEW"
          title="實際時段預覽"
          eng="EFFECTIVE"
          hint="模板套用後實際會產生的時段"
        />
        <Suspense fallback={<PageSkeleton rows={2} withHeader={false} />}>
          <EffectivePreview />
        </Suspense>
      </section>
    </div>
  )
}
