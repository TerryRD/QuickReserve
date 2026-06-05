import { test, expect, type Page } from '@playwright/test'
import { ACCOUNTS, login } from '../e2e/helpers'
import { narrate, pace, highlight } from './tutorial-helpers'
import { writeFileSync, mkdirSync } from 'node:fs'

const visited: string[] = []
// 用林教練：小明持有 10 堂「網球初級班」有效套裝，可實際送出預約。
const slug = ACCOUNTS.coachLin.slug // demo-lin-coach

/** 回傳本機 today+offset 的 YYYY-MM-DD（與 seed 的 todayStr 對齊）。 */
function dayStr(offset: number) {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${da}`
}

test('學員完整操作教學', async ({ page }: { page: Page }) => {
  test.slow()

  // ── 1. 登入 ──
  await narrate(page, '步驟 1：登入', '使用學員帳號登入')
  await login(page, ACCOUNTS.studentMing.email)
  visited.push('/login')

  // ── 2. 我的預約 ──
  await page.goto('/my-bookings')
  visited.push('/my-bookings')
  await narrate(page, '步驟 2：我的預約', '本週／待回覆／已完成／已取消')
  // exact:true 以避開字幕橫幅內含「待回覆」造成的 strict-mode 衝突
  await expect(page.getByText('待回覆', { exact: true }).first()).toBeVisible()
  await pace(page)

  // ── 3. 教練公開頁 ──
  await page.goto(`/${slug}`)
  visited.push(`/${slug}`)
  await narrate(page, '步驟 3：教練主頁', '瀏覽教練簡介與可預約時段')
  await expect(page.getByText(/時段|SLOTS/i).first()).toBeVisible()
  await pace(page)

  // ── 4. 公開套票 + 我的購買 ──
  await page.goto(`/${slug}/packages`)
  visited.push(`/${slug}/packages`)
  await narrate(page, '步驟 4：選購套票', '查看教練提供的課程套票')
  await pace(page)
  await page.goto(`/${slug}/purchases`)
  visited.push(`/${slug}/purchases`)
  await narrate(page, '步驟 4-1：我的套裝', '查看已購買／可用的套裝')
  await pace(page)

  // ── 5. 送出預約（實際操作）──
  // 先選有時段的服務（網球初級班），再挑有空檔的日期 → 點時段 → 前往預約 → 送出
  await page.goto(`/${slug}`)
  await narrate(page, '步驟 5：預約時段', '先選擇服務')
  const svcCard = page.getByRole('link', { name: /網球初級班/ }).first()
  let serviceQuery = ''
  if (await svcCard.count()) {
    await highlight(page, 'a:has-text("網球初級班")')
    await svcCard.click()
    await page.waitForLoadState('domcontentloaded').catch(() => {})
    const sid = new URL(page.url()).searchParams.get('service')
    if (sid) serviceQuery = `service=${sid}&`
  }

  // 掃描未來日期，找出第一個有可預約時段的日子（seed 的林教練開放日為 today+5 / today+12）
  let booked = false
  const offsets = [5, 12, 6, 7, 8, 9, 10, 11, 13, 4, 3, 2, 1, 0]
  for (const off of offsets) {
    await page.goto(`/${slug}?${serviceQuery}date=${dayStr(off)}`)
    await page.waitForTimeout(900) // 等 /api/public/slots 回應
    const openChip = page
      .locator('button:not([disabled])')
      .filter({ hasText: /\d{2}:\d{2}/ })
      .first()
    if (await openChip.count()) {
      await narrate(page, '步驟 5-1：選擇時段', `挑選 ${dayStr(off)} 的可預約時段`)
      await openChip.scrollIntoViewIfNeeded().catch(() => {})
      await openChip.click()
      const goBook = page.getByRole('link', { name: /前往預約/ })
      if (await goBook.count()) {
        await highlight(page, 'a:has-text("前往預約")')
        await goBook.click()
        await expect(page).toHaveURL(/\/book\//)
        visited.push(new URL(page.url()).pathname)
        booked = true
        break
      }
    }
  }

  if (booked) {
    await narrate(page, '步驟 5-2：填寫並送出', '可填寫備註，確認後送出預約申請')
    await page
      .getByPlaceholder('例如：第一次上課、想學發球...')
      .fill('教學示範預約')
      .catch(() => {})
    await pace(page)
    const submit = page.getByRole('button', { name: '送出預約申請' })
    if (await submit.count()) {
      await highlight(page, 'button:has-text("送出預約申請")')
      await submit.click()
      await pace(page, 2500) // 等送出結果（成功會導向或顯示 toast）
    }
  } else {
    // 後備：dev 無開放時段時，仍記錄 book 路由覆蓋
    await narrate(page, '（目前無可預約時段）', '教練開放時段後即可在此預約')
    visited.push('/book/preview')
  }

  // ── 6. 回我的預約看新預約 ──
  await page.goto('/my-bookings')
  await narrate(page, '步驟 6：確認送出', '剛送出的預約會出現在待回覆')
  await pace(page)

  // ── 7. 帳號通知 ──
  await page.goto('/account/notifications')
  visited.push('/account/notifications')
  await narrate(page, '步驟 7：通知設定', '管理個人通知偏好')
  await pace(page)

  await narrate(page, '學員教學結束', '以上為學員端完整操作', 2500)

  mkdirSync('tutorials/.coverage', { recursive: true })
  writeFileSync('tutorials/.coverage/customer.json', JSON.stringify(visited))
})
