'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { format, parseISO, startOfDay } from 'date-fns'
import WeekGrid from './week-grid'
import CalendarListView from './list-view'
import ViewTabs from './view-tabs'

type View = 'week' | 'day' | 'list'

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
}

export default function CalendarPanel({
  initialView,
  weekStart,
  initialDayAnchor,
  slots,
  tzOffsetHours,
  showMemberLabel,
}: {
  initialView: View
  weekStart: string // ISO of Monday 00:00
  initialDayAnchor: string // ISO of currently selected day
  slots: SlotDisplay[]
  tzOffsetHours: number
  showMemberLabel: boolean
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [view, setView] = useState<View>(initialView)
  // setDayAnchor reserved for upcoming day-navigation within panel; intentionally unused.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [dayAnchor, setDayAnchor] = useState<string>(initialDayAnchor)
  const [, startTransition] = useTransition()

  // FR-119: on small viewports, week view is unreadable — auto-switch to day view on mount
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(max-width: 640px)').matches && view === 'week') {
      setView('day')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function syncUrl(nextView: View, nextDate: string) {
    const usp = new URLSearchParams(searchParams.toString())
    if (nextView === 'week') usp.delete('view')
    else usp.set('view', nextView)
    if (nextView === 'day') usp.set('date', nextDate.slice(0, 10))
    else usp.delete('date')
    const qs = usp.toString()
    startTransition(() => {
      router.replace(`/calendar${qs ? `?${qs}` : ''}`, { scroll: false })
    })
  }

  function onViewChange(next: View) {
    setView(next)
    syncUrl(next, dayAnchor)
  }

  // For day view, filter slots client-side (data already covers full week)
  const dayKey = format(parseISO(dayAnchor), 'yyyy-MM-dd')
  const filteredSlots =
    view === 'day'
      ? slots.filter((s) => {
          const local = new Date(
            new Date(s.startAt).getTime() + tzOffsetHours * 3600 * 1000,
          )
          return local.toISOString().slice(0, 10) === dayKey
        })
      : slots

  const gridAnchor =
    view === 'day' ? startOfDay(parseISO(dayAnchor)) : parseISO(weekStart)
  const daysCount = view === 'day' ? 1 : 7

  return (
    <div className="space-y-4">
      <ViewTabs current={view} onChange={onViewChange} />

      {view === 'list' ? (
        <CalendarListView
          slots={filteredSlots}
          tzOffsetHours={tzOffsetHours}
          showMemberLabel={showMemberLabel}
        />
      ) : (
        <WeekGrid
          weekStart={gridAnchor}
          slots={filteredSlots}
          tzOffsetHours={tzOffsetHours}
          showMemberLabel={showMemberLabel}
          daysCount={daysCount}
        />
      )}
    </div>
  )
}
