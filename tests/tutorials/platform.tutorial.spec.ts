import { test, expect, type Page } from '@playwright/test'
import { narrate, pace, highlight } from './tutorial-helpers'
import { writeFileSync, mkdirSync } from 'node:fs'

const visited: string[] = []
const email = process.env.TUTORIAL_PLATFORM_EMAIL ?? 'terry@gmail.com'
const password = process.env.TUTORIAL_PLATFORM_PASSWORD

test.describe('平台管理員', () => {
  test.skip(!password, '設定 TUTORIAL_PLATFORM_PASSWORD 才會錄製平台教學')

  test('平台完整操作教學', async ({ page }: { page: Page }) => {
    test.slow()

    await page.goto('/login')
    await narrate(page, '步驟 1：登入', '使用平台管理員帳號登入')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('密碼').fill(password!)
    await page.getByRole('button', { name: '登入' }).click()
    await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 10_000 })
    visited.push('/login')

    await page.goto('/platform/dashboard')
    visited.push('/platform/dashboard')
    await narrate(page, '步驟 2：平台儀表板', '啟用租戶、使用者、預約總數等 KPI')
    await expect(page.getByRole('heading', { name: '平台儀表板' })).toBeVisible()
    await pace(page)

    await page.goto('/platform/tenants')
    visited.push('/platform/tenants')
    await narrate(page, '步驟 3：租戶管理', '檢視所有租戶')
    await expect(page.getByRole('heading', { name: '租戶管理' })).toBeVisible()
    // 點進第一個租戶詳情（覆蓋 tenants/[tenantId]）
    const firstTenant = page.locator('a[href^="/platform/tenants/"]').first()
    if (await firstTenant.count()) {
      await highlight(page, 'a[href^="/platform/tenants/"]')
      await firstTenant.click()
      await expect(page).toHaveURL(/\/platform\/tenants\/[^/]+$/)
      visited.push(new URL(page.url()).pathname)
      await narrate(page, '步驟 3-1：租戶詳情', '單一租戶的詳細資料')
      await pace(page)
    }

    await page.goto('/platform/bookings')
    visited.push('/platform/bookings')
    await narrate(page, '步驟 4：全平台預約', '依狀態篩選所有預約')
    await expect(page.getByRole('heading', { name: '全平台預約' })).toBeVisible()
    await pace(page)

    await narrate(page, '平台教學結束', '以上為平台後台操作', 2500)

    mkdirSync('tutorials/.coverage', { recursive: true })
    writeFileSync('tutorials/.coverage/platform.json', JSON.stringify(visited))
  })
})
