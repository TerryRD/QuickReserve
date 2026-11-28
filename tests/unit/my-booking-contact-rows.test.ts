import { describe, it, expect } from 'vitest'
import {
  coachContactRows,
  type CoachContact,
} from '@/app/(customer)/my-bookings/[bookingId]/contact-rows'

const empty: CoachContact = {
  contact_line_id: null,
  contact_phone: null,
  contact_email: null,
  contact_note: null,
}

describe('coachContactRows', () => {
  it('四項齊全：依 LINE、電話、Email、備註的順序，電話與 Email 有連結', () => {
    expect(
      coachContactRows({
        contact_line_id: 'coach_wang',
        contact_phone: '0912345678',
        contact_email: 'coach@example.com',
        contact_note: '上課時間請先傳 LINE',
      }),
    ).toEqual([
      { key: 'line', label: 'LINE', value: 'coach_wang', href: null },
      { key: 'phone', label: '電話', value: '0912345678', href: 'tel:0912345678' },
      {
        key: 'email',
        label: 'Email',
        value: 'coach@example.com',
        href: 'mailto:coach@example.com',
      },
      { key: 'note', label: '備註', value: '上課時間請先傳 LINE', href: null },
    ])
  })

  it('只有部分項目：只列出有填的，順序不變', () => {
    expect(
      coachContactRows({ ...empty, contact_phone: '0223456789', contact_note: '平日晚上可聯絡' }),
    ).toEqual([
      { key: 'phone', label: '電話', value: '0223456789', href: 'tel:0223456789' },
      { key: 'note', label: '備註', value: '平日晚上可聯絡', href: null },
    ])
  })

  it('四項全為 null：回傳空陣列', () => {
    expect(coachContactRows(empty)).toEqual([])
  })

  it('空字串與只有空白：不產生列', () => {
    expect(
      coachContactRows({
        contact_line_id: '',
        contact_phone: '   ',
        contact_email: ' \n\t ',
        contact_note: '',
      }),
    ).toEqual([])
    expect(coachContactRows({ ...empty, contact_line_id: '  ', contact_email: 'a@b.tw' })).toEqual([
      { key: 'email', label: 'Email', value: 'a@b.tw', href: 'mailto:a@b.tw' },
    ])
  })

  it('前後空白會去掉：value 與 href 都用去掉後的值', () => {
    expect(
      coachContactRows({
        contact_line_id: '  coach_wang ',
        contact_phone: ' 0912345678  ',
        contact_email: '\tcoach@example.com\n',
        contact_note: '  先傳訊息  ',
      }),
    ).toEqual([
      { key: 'line', label: 'LINE', value: 'coach_wang', href: null },
      { key: 'phone', label: '電話', value: '0912345678', href: 'tel:0912345678' },
      {
        key: 'email',
        label: 'Email',
        value: 'coach@example.com',
        href: 'mailto:coach@example.com',
      },
      { key: 'note', label: '備註', value: '先傳訊息', href: null },
    ])
  })

  it('沒有教練資料（null／undefined）：回傳空陣列', () => {
    expect(coachContactRows(null)).toEqual([])
    expect(coachContactRows(undefined)).toEqual([])
  })
})
