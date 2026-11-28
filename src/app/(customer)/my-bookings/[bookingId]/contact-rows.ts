// 學員端預約明細頁「聯絡教練」段落要顯示的列（純函式，不碰資料庫）

export type CoachContact = {
  contact_line_id: string | null
  contact_phone: string | null
  contact_email: string | null
  contact_note: string | null
}

export type ContactRow = {
  key: 'line' | 'phone' | 'email' | 'note'
  label: string
  value: string
  href: string | null
}

/** 去掉前後空白；沒有值或只有空白時回傳 null */
function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

/**
 * 依固定順序（LINE、電話、Email、備註）列出教練有填的聯絡方式，沒填的項目不產生列。
 * 電話與 Email 帶連結（與教練公開頁相同做法）；沒有教練資料時回傳空陣列。
 */
export function coachContactRows(contact: CoachContact | null | undefined): ContactRow[] {
  if (!contact) return []
  const rows: ContactRow[] = []

  const line = clean(contact.contact_line_id)
  if (line) rows.push({ key: 'line', label: 'LINE', value: line, href: null })

  const phone = clean(contact.contact_phone)
  if (phone) rows.push({ key: 'phone', label: '電話', value: phone, href: `tel:${phone}` })

  const email = clean(contact.contact_email)
  if (email) rows.push({ key: 'email', label: 'Email', value: email, href: `mailto:${email}` })

  const note = clean(contact.contact_note)
  if (note) rows.push({ key: 'note', label: '備註', value: note, href: null })

  return rows
}
