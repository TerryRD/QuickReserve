'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import WeekGrid from './week-grid'
import CalendarListView from './list-view'
import MonthView from './month-view'
import ViewTabs from './view-tabs'

type View = 'week' | 'list' | 'month'

type SlotDisplay = {
  id: string
  startAt: string
  endAt: string
  status: 'available' | 'pending' | 'booked' | 'cancelled'
  serviceName: string | null
  memberLabel: string
  memberId: string
  isOwn: boolean
  customerName: string | null
  bookingId: string | null
  conflictReason: string | null
  bookingCount: number
  maxCapacity: number
}

export default function CalendarPanel({
  initialView,
  weekStart,
  monthAnchor,
  slots,
  showMemberLabel,
}: {
  initialView: View
  /** 該週週一的台灣日期，例：2026-11-30 */
  weekStart: string
  /** 月檢視要顯示的月份第一天（台灣日期 yyyy-MM-01）。 */
  monthAnchor: string
  slots: SlotDisplay[]
  showMemberLabel: boolean
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [view, setView] = useState<View>(initialView)
  const [, startTransition] = useTransition()

  // FR-119: on small viewports the week grid is unreadable — auto-switch to list
  // (which scans well on phones) once on mount when week is the initial view.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(max-width: 640px)').matches && view === 'week') {
      setView('list')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function syncUrl(nextView: View) {
    const usp = new URLSearchParams(searchParams.toString())
    if (nextView === 'week') usp.delete('view')
    else usp.set('view', nextView)
    const qs = usp.toString()
    startTransition(() => {
      router.replace(`/calendar${qs ? `?${qs}` : ''}`, { scroll: false })
    })
  }

  function onViewChange(next: View) {
    setView(next)
    syncUrl(next)
  }

  return (
    <div className="space-y-4">
      <ViewTabs current={view} onChange={onViewChange} />

      {view === 'week' && (
        <WeekGrid
          weekStart={weekStart}
          slots={slots}
          showMemberLabel={showMemberLabel}
          daysCount={7}
        />
      )}
      {view === 'list' && (
        <CalendarListView slots={slots} showMemberLabel={showMemberLabel} />
      )}
      {view === 'month' && (
        <MonthView monthAnchor={monthAnchor} slots={slots} />
      )}
    </div>
  )
}
