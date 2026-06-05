import { test, type Page } from '@playwright/test'
import { ACCOUNTS, login } from '../e2e/helpers'
import { narrate, pace } from './tutorial-helpers'
import { writeFileSync, mkdirSync } from 'node:fs'

const visited: string[] = []

/** 造訪一個 (tenant) 頁面；若被導離則字幕標示「權限不足」。 */
async function visit(page: Page, path: string, title: string, desc: string) {
  await page.goto(path)
  // 等可能的 client 端權限導頁完成，再讀取最終 URL
  await page.waitForLoadState('domcontentloaded').catch(() => {})
  await page.waitForTimeout(400)
  const landed = new URL(page.url()).pathname
  visited.push(landed)
  if (landed === path) {
    await narrate(page, title, desc)
  } else {
    await narrate(page, `${title}（助教無權限）`, `已自動導向 ${landed}`)
  }
  await pace(page)
}

test('助教完整操作教學', async ({ page }: { page: Page }) => {
  test.slow()

  await narrate(page, '步驟 1：登入', '使用助教帳號登入（隸屬林教練）')
  await login(page, ACCOUNTS.staffMing.email)
  visited.push('/login')

  await visit(page, '/dashboard', '步驟 2：儀表板', '助教可見的營運概況')
  await visit(page, '/calendar', '步驟 3：行事曆', '查看與協助管理時段')
  await visit(page, '/bookings', '步驟 4：預約', '協助處理學員預約')
  await visit(page, '/customers', '步驟 5：客戶', '查看客戶資料')
  await visit(page, '/services', '步驟 6：服務', '查看課程服務')
  await visit(page, '/packages', '步驟 7：套票', '查看套票')
  await visit(page, '/notifications', '步驟 8：通知', '助教的通知收件匣')
  await visit(page, '/settings/profile', '步驟 9：個人設定', '助教的個人設定')

  await narrate(page, '助教教學結束', '以上為助教可存取範圍', 2500)

  mkdirSync('tutorials/.coverage', { recursive: true })
  writeFileSync('tutorials/.coverage/staff.json', JSON.stringify(visited))
})
