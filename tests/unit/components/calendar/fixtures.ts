// 行事曆元件測試共用的時段資料。
// 資料庫存 UTC：04:00Z = 台灣 12/02 12:00；11:00Z = 台灣 12/02 19:00（舊寫法會被分到 12/03）
const base = {
  status: 'available' as const,
  serviceName: '一對一課程',
  memberLabel: '我',
  memberId: 'member-1',
  isOwn: true,
  customerName: null,
  bookingId: null,
  conflictReason: null,
  bookingCount: 0,
  maxCapacity: 1,
}

export const SLOTS = [
  {
    ...base,
    id: 'slot-noon',
    startAt: '2026-12-02T04:00:00.000Z',
    endAt: '2026-12-02T05:00:00.000Z',
  },
  {
    ...base,
    id: 'slot-night',
    startAt: '2026-12-02T11:00:00.000Z',
    endAt: '2026-12-02T12:00:00.000Z',
  },
]

// 每種執行環境時區的實際位移（分鐘，getTimezoneOffset 的正負號與 UTC 位移相反）
export const ZONES = [
  { tz: 'Asia/Taipei', offset: -480 },
  { tz: 'UTC', offset: 0 },
] as const
