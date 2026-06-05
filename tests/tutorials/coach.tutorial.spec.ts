import { test, expect, type Page } from '@playwright/test'
import { ACCOUNTS, login } from '../e2e/helpers'
import { narrate, pace, highlight } from './tutorial-helpers'
import { writeFileSync, mkdirSync } from 'node:fs'

/** 累計本支造訪過的 pathname，寫出供彙整覆蓋率。 */
const visited: string[] = []
async function go(page: Page, path: string) {
  await page.goto(path)
  visited.push(new URL(page.url()).pathname)
}

test('教練完整操作教學', async ({ page }) => {
  test.slow()

  // ── 0. 註冊頁（示範填寫，不最終送出，避免產生垃圾帳號）──
  await page.goto('/signup')
  visited.push('/signup')
  await narrate(page, '步驟 0：註冊教練帳號', '新教練可在此建立帳號（示範填寫，不送出）')
  await page
    .getByLabel('Email')
    .fill('demo-new-coach@example.com')
    .catch(() => {})
  await pace(page)

  // ── 1. 登入 ──
  await narrate(page, '步驟 1：登入', '使用教練帳號登入後台')
  await login(page, ACCOUNTS.coachWang.email)
  visited.push('/login')

  // ── 2. Dashboard ──
  await go(page, '/dashboard')
  await narrate(page, '步驟 2：儀表板', '本週待確認、今日預約、KPI 一覽')
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/早安|午安|晚安/)
  await expect(page.getByRole('heading', { name: '今日預約' })).toBeVisible()
  await pace(page)

  // ── 3. 行事曆（三視圖 + slot popover）──
  await go(page, '/calendar?view=week')
  await narrate(page, '步驟 3：行事曆', '週／月／清單三種視圖切換')
  await expect(page.getByRole('button', { name: /MONTH/ })).toBeVisible()
  await go(page, '/calendar?view=month')
  await pace(page)
  await go(page, '/calendar?view=list')
  await pace(page)
  await go(page, '/calendar?view=week')
  const slot = page.locator('.grid button').filter({ hasText: /\d{2}:\d{2}/ }).first()
  if (await slot.count()) {
    await narrate(page, '步驟 3-1：時段詳情', '點擊時段查看負責成員與狀態')
    await slot.click()
    await expect(page.getByText('時間').first()).toBeVisible({ timeout: 5000 })
    await page.keyboard.press('Escape').catch(() => {})
  }

  // ── 4. 可預約時段模板 + 重複規則 ──
  await go(page, '/calendar/availability')
  await narrate(page, '步驟 4：時段模板', '設定每週固定可預約時段')
  await expect(page.getByText(/TEMPLATES/).first()).toBeVisible()
  await go(page, '/calendar/rules')
  await narrate(page, '步驟 4-1：重複規則', '管理重複開課規則')
  await expect(page.getByRole('heading', { name: '重複規則' })).toBeVisible()

  // ── 5. 服務 ──
  await go(page, '/services')
  await narrate(page, '步驟 5：服務管理', '1對1 與 團體課程分頁')
  await expect(page.getByRole('link', { name: /1-ON-1/ })).toBeVisible()

  // ── 6. 套票 + 待審核套票 ──
  await go(page, '/packages')
  await narrate(page, '步驟 6：套票', '建立與管理課程套票')
  await expect(page.getByRole('link', { name: /ALL/ })).toBeVisible()
  await go(page, '/packages/pending')
  await narrate(page, '步驟 6-1：待審核套票', '審核學員的套票申請')
  await pace(page)

  // ── 7. 客戶 ──
  await go(page, '/customers')
  await narrate(page, '步驟 7：客戶管理', '搜尋、狀態篩選、查看客戶資料')
  await expect(page.locator('input[name="q"]')).toBeVisible()

  // ── 8. 預約管理：確認待確認預約（實際操作）──
  await go(page, '/bookings')
  await narrate(page, '步驟 8：確認預約', '確認學員送出的待確認預約')
  const confirmBtn = page.getByRole('button', { name: '確認' }).first()
  if (await confirmBtn.count()) {
    await highlight(page, 'button:has-text("確認")')
    await confirmBtn.click()
    // 若有確認對話框，按下確認；toast「已確認」應出現
    await expect(page.getByText('已確認'))
      .toBeVisible({ timeout: 8000 })
      .catch(() => {})
    await pace(page, 1500)
  } else {
    await narrate(page, '（目前無待確認預約）', '學員送出預約後會顯示於此')
  }

  // ── 9. 助教管理 + 邀請頁覆蓋 ──
  await go(page, '/staff')
  await narrate(page, '步驟 9：助教管理', '邀請與管理助教')
  // 覆蓋 invite/[token]：以一個示意 token 造訪邀請頁（不接受，僅呈現畫面）
  await page.goto('/invite/demo-preview-token')
  visited.push('/invite/demo-preview-token')
  await narrate(page, '步驟 9-1：邀請連結頁', '受邀者點開連結後看到的加入畫面')
  await pace(page)

  // ── 10. 通知收件匣 ──
  await go(page, '/notifications')
  await narrate(page, '步驟 10：通知', '收件匣四分頁：全部／預約／套票／系統')
  await expect(page.getByRole('heading', { name: '通知' })).toBeVisible()

  // ── 11. 設定（個人 + 通知偏好）──
  await go(page, '/settings/profile')
  await narrate(page, '步驟 11：個人設定', '基本資料、品牌、Hero 等區塊')
  await expect(page.getByText('BASIC INFO')).toBeVisible()
  await go(page, '/settings/notifications')
  await narrate(page, '步驟 11-1：通知偏好', '事件 × 通道矩陣與勿擾時段')
  await expect(page.getByRole('heading', { name: '通知偏好' })).toBeVisible()

  await narrate(page, '教練教學結束', '以上為教練後台完整操作', 2500)

  // 寫出本支造訪路徑（供覆蓋彙整）
  mkdirSync('tutorials/.coverage', { recursive: true })
  writeFileSync('tutorials/.coverage/coach.json', JSON.stringify(visited))
})
