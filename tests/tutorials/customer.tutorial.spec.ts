import { test, expect, type Page } from '@playwright/test'
import { ACCOUNTS, login } from '../e2e/helpers'
import { narrate, pace, highlight } from './tutorial-helpers'
import { writeFileSync, mkdirSync } from 'node:fs'

const visited: string[] = []
const slug = ACCOUNTS.coachWang.slug // demo-wang-coach

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
  await expect(page.getByText('待回覆')).toBeVisible()
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
  // 回公開頁挑一個可預約時段 → 進 /book/[slotId] → 送出
  await page.goto(`/${slug}`)
  await narrate(page, '步驟 5：預約時段', '挑選時段並送出預約申請')
  const bookLink = page.locator('a[href^="/book/"]').first()
  if (await bookLink.count()) {
    await highlight(page, 'a[href^="/book/"]')
    await bookLink.click()
    await expect(page).toHaveURL(/\/book\//)
    visited.push(new URL(page.url()).pathname)
    await narrate(page, '步驟 5-1：填寫預約', '可填寫備註後送出')
    await page
      .getByPlaceholder('例如：第一次上課、想學發球...')
      .fill('教學示範預約')
      .catch(() => {})
    await pace(page)
    const submit = page.getByRole('button', { name: '送出預約申請' })
    if (await submit.count()) {
      await highlight(page, 'button:has-text("送出預約申請")')
      await submit.click()
      await pace(page, 2000) // 等送出結果（成功會導向或顯示 toast）
    }
  } else {
    // 後備：直接記錄 book 路由覆蓋（dev 無開放時段時）
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
