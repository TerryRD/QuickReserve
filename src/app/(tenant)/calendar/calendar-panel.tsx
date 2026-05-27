'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { parseISO } from 'date-fns'
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
  tzOffsetHours,
  showMemberLabel,
}: {
  initialView: View
  weekStart: string // ISO of Monday 00:00
  /** ISO of the first day of the month currently in scope (for month view). */
  monthAnchor: string
  slots: SlotDisplay[]
  tzOffsetHours: number
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

  const weekAnchor = parseISO(weekStart)

  return (
    <div className="space-y-4">
      <ViewTabs current={view} onChange={onViewChange} />

      {view === 'week' && (
        <WeekGrid
          weekStart={weekAnchor}
          slots={slots}
          tzOffsetHours={tzOffsetHours}
          showMemberLabel={showMemberLabel}
          daysCount={7}
        />
      )}
      {view === 'list' && (
        <CalendarListView
          slots={slots}
          tzOffsetHours={tzOffsetHours}
          showMemberLabel={showMemberLabel}
        />
      )}
      {view === 'month' && (
        <MonthView
          monthAnchor={monthAnchor}
          slots={slots}
          tzOffsetHours={tzOffsetHours}
        />
      )}
    </div>
  )
}
