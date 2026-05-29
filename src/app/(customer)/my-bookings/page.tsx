import { Suspense } from 'react'
import Link from 'next/link'
import { Calendar, Settings, Filter } from 'lucide-react'
import { requireSession } from '@/lib/auth/get-session'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import PushOptIn from '@/components/push-opt-in'
import MyBookingsContent, { MyBookingsContentSkeleton } from './my-bookings-content'

export default async function MyBookingsPage() {
  const session = await requireSession()
  const now = new Date()

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-[1200px] px-5 py-10 sm:px-10 sm:py-12 lg:px-[72px] lg:py-14">
        {/* Page hero — renders immediately */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="font-mono mb-2.5 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              MY BOOKINGS · 我的預約
            </div>
            <h1 className="font-display font-cjk text-[56px] font-normal uppercase leading-[0.9] tracking-tight sm:text-[88px]">
              我的預約
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" icon={<Filter className="size-3" />}>
              狀態 · 全部
            </Badge>
            <Badge variant="outline" icon={<Calendar className="size-3" />}>
              本月 · {now.getMonth() + 1} 月
            </Badge>
            <Button
              variant="pill-outline"
              size="sm"
              render={<Link href="/account/notifications" />}
            >
              <Settings className="size-3" /> 通知
            </Button>
          </div>
        </div>

        <PushOptIn />

        <Suspense fallback={<MyBookingsContentSkeleton />}>
          <MyBookingsContent userId={session.userId} />
        </Suspense>
      </main>
    </div>
  )
}
