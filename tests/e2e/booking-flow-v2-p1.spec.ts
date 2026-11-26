import { test, expect, type Locator, type Page } from '@playwright/test'
import { login } from './helpers'
import {
  CUSTOMER_CANCELLED_REASON,
  SVC,
  cleanupBfv2E2e,
  readBooking,
  setupBfv2E2e,
  type Bfv2E2e,
} from './bfv2-fixture'

/**
 * 預約流程改版 v2 第 1 階段：取消原因、取消紀錄、預約明細頁與歷程、助教操作範圍、用語。
 *
 * 會寫入資料庫：測試資料全部由 bfv2-fixture.ts 在 beforeAll 建立（獨立的 bfv2e2e- 租戶與帳號），
 * afterAll 清掉；不使用、也不修改 demo 帳號的資料。每個測試只依賴 beforeAll 準備好的狀態，彼此不相依。
 */

/** 畫面上不得出現的舊用語（設計文件 §2、計畫 H1） */
const FORBIDDEN_ON_PAGE = ['套裝', '已完成', '未到場', '退還']

let ctx: Bfv2E2e

test.beforeAll(async () => {
  test.setTimeout(180_000)
  ctx = await setupBfv2E2e()
})

test.afterAll(async () => {
  test.setTimeout(120_000)
  await cleanupBfv2E2e()
})

async function expectNoForbiddenTerms(page: Page) {
  const text = await page.locator('body').innerText()
  for (const term of FORBIDDEN_ON_PAGE) {
    expect(text, `畫面不應出現「${term}」`).not.toContain(term)
  }
}

/** 學員端「我的預約」的預約卡片（以服務名稱辨識） */
function customerCard(page: Page, serviceName: string): Locator {
  return page
    .locator('div.rounded-2xl')
    .filter({ has: page.getByRole('heading', { level: 3, name: serviceName, exact: true }) })
}

/** 教練端「預約管理」的預約卡片（以服務名稱辨識） */
function tenantCard(page: Page, serviceName: string): Locator {
  return page.locator('[data-slot="card"]').filter({ hasText: serviceName })
}

/** 取消紀錄等 dt/dd 清單中某個欄位的值 */
function fieldValue(scope: Locator, label: string): Locator {
  return scope
    .locator('dt')
    .filter({ hasText: new RegExp(`^${label}$`) })
    .locator('xpath=following-sibling::dd[1]')
}

/** 學員端明細頁的區塊（section 內有 h2 標題） */
function customerSection(page: Page, title: string): Locator {
  return page
    .locator('section')
    .filter({ has: page.getByRole('heading', { level: 2, name: title, exact: true }) })
}

/** 教練端明細頁的區塊（Card 內有 h2 標題） */
function tenantSection(page: Page, title: string): Locator {
  return page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByRole('heading', { level: 2, name: title, exact: true }) })
}

/** 歷程中描述為 text 的那一列 */
function timelineItem(section: Locator, text: string): Locator {
  return section.locator('li').filter({ has: section.page().getByText(text, { exact: true }) })
}

test.describe('1. 學員取消預約（取消原因對話框）', () => {
  test('沒選原因不能送出；一般原因補充說明選填；「其他」補充說明必填；左側按鈕是「返回」', async ({
    page,
  }) => {
    await login(page, ctx.customer.email)
    await page.goto('/my-bookings')
    const card = customerCard(page, SVC.custCancelPreset)
    await expect(card).toBeVisible()

    // 先開再按「返回」：對話框關閉，預約不受影響
    await card.getByRole('button', { name: '取消預約', exact: true }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('確定要取消此預約嗎？')).toBeVisible()
    await dialog.getByRole('button', { name: '返回', exact: true }).click()
    await expect(dialog).toBeHidden()
    await expect(card.getByRole('button', { name: '取消預約', exact: true })).toBeVisible()

    await card.getByRole('button', { name: '取消預約', exact: true }).click()
    await expect(dialog).toBeVisible()
    const confirmBtn = dialog.getByRole('button', { name: '取消預約', exact: true })
    const detail = dialog.getByRole('textbox')

    // 左側按鈕是「返回」，不是「取消」
    await expect(dialog.getByRole('button', { name: '返回', exact: true })).toBeVisible()
    await expect(dialog.getByRole('button', { name: '取消', exact: true })).toHaveCount(0)

    // 沒選原因：不能送出
    await expect(confirmBtn).toBeDisabled()

    // 選一般原因：補充說明選填，可以送出
    await dialog.getByRole('radio', { name: '生病' }).click()
    await expect(dialog.getByRole('radio', { name: '生病' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    await expect(dialog.getByText('（選填）')).toBeVisible()
    await expect(confirmBtn).toBeEnabled()

    // 選「其他」：補充說明必填，只有空白也不算
    await dialog.getByRole('radio', { name: '其他' }).click()
    await expect(dialog.getByText('（必填）')).toBeVisible()
    await expect(confirmBtn).toBeDisabled()
    await detail.fill('   ')
    await expect(confirmBtn).toBeDisabled()
    await detail.fill('臨時有事')
    await expect(confirmBtn).toBeEnabled()

    await expectNoForbiddenTerms(page)

    // 改回一般原因、清空補充說明後送出
    await dialog.getByRole('radio', { name: '生病' }).click()
    await detail.fill('')
    await expect(confirmBtn).toBeEnabled()
    await confirmBtn.click()
    await expect(dialog).toBeHidden()

    // 卡片變成已取消：你取消、原因、已退回 1 堂；沒有改期／取消按鈕
    await expect(card.getByText('已取消', { exact: true })).toBeVisible()
    await expect(card.getByText('你取消 · 原因：生病', { exact: true })).toBeVisible()
    await expect(card.getByText('已退回 1 堂', { exact: true })).toBeVisible()
    await expect(card.getByRole('button', { name: '取消預約', exact: true })).toHaveCount(0)
    await expect(card.getByRole('link', { name: /改期/ })).toHaveCount(0)

    const row = await readBooking(ctx.bookings.custCancelPreset)
    expect(row).toMatchObject({
      status: 'cancelled',
      cancel_category: 'customer',
      cancel_reason: '生病',
      cancel_actor_role: 'customer',
      class_disposition: 'refunded',
    })
    await expectNoForbiddenTerms(page)
  })

  test('選「其他」填補充說明後送出，卡片顯示自填的原因', async ({ page }) => {
    await login(page, ctx.customer.email)
    await page.goto('/my-bookings')
    const card = customerCard(page, SVC.custCancelOther)
    await card.getByRole('button', { name: '取消預約', exact: true }).click()

    const dialog = page.getByRole('alertdialog')
    const confirmBtn = dialog.getByRole('button', { name: '取消預約', exact: true })
    await dialog.getByRole('radio', { name: '其他' }).click()
    await expect(confirmBtn).toBeDisabled()
    await dialog.getByRole('textbox').fill('家裡臨時有事')
    await confirmBtn.click()
    await expect(dialog).toBeHidden()

    await expect(card.getByText('已取消', { exact: true })).toBeVisible()
    await expect(card.getByText('你取消 · 原因：家裡臨時有事', { exact: true })).toBeVisible()
    await expect(card.getByText('已退回 1 堂', { exact: true })).toBeVisible()

    const row = await readBooking(ctx.bookings.custCancelOther)
    expect(row).toMatchObject({
      status: 'cancelled',
      cancel_category: 'customer',
      cancel_reason: '家裡臨時有事',
      class_disposition: 'refunded',
    })
  })
})

test.describe('2. 學員端預約明細頁', () => {
  test('從卡片的「查看明細」進入：預約資料、取消紀錄、歷程，沒有 Owner／助教字樣', async ({
    page,
  }) => {
    await login(page, ctx.customer.email)
    await page.goto('/my-bookings')
    const card = customerCard(page, SVC.custCancelled)
    await card.getByRole('link', { name: '查看明細' }).click()
    await page.waitForURL(`**/my-bookings/${ctx.bookings.custCancelled}`)

    await expect(page.getByRole('heading', { level: 1, name: SVC.custCancelled })).toBeVisible()

    const info = customerSection(page, '預約資料')
    await expect(info).toBeVisible()
    await expect(fieldValue(info, '上課時間')).not.toHaveText('—')
    await expect(fieldValue(info, '教練')).toHaveText(ctx.tenantName)
    await expect(fieldValue(info, '使用堂數')).toHaveText('5 堂課的其中 1 堂')

    const record = customerSection(page, '取消紀錄')
    await expect(fieldValue(record, '類別')).toHaveText('學員取消')
    await expect(fieldValue(record, '原因')).toHaveText(CUSTOMER_CANCELLED_REASON)
    await expect(fieldValue(record, '取消人')).toHaveText('你')
    await expect(fieldValue(record, '堂數')).toHaveText('已退回 1 堂')

    const history = customerSection(page, '歷程')
    await expect(history.locator('li')).toHaveCount(3)
    await expect(timelineItem(history, '建立預約，使用 1 堂')).toContainText('你')
    await expect(timelineItem(history, '預約已確認')).toContainText('教練')
    await expect(timelineItem(history, '取消預約，已退回 1 堂')).toContainText(
      `你 · 原因：${CUSTOMER_CANCELLED_REASON}`,
    )
    // 新的在上：第一列是取消
    await expect(history.locator('li').first()).toContainText('取消預約')

    const pageText = await page.locator('body').innerText()
    expect(pageText).not.toContain('Owner')
    expect(pageText).not.toContain('助教')
    await expectNoForbiddenTerms(page)
  })

  test('不存在的預約 id 顯示找不到頁', async ({ page }) => {
    await login(page, ctx.customer.email)
    await page.goto('/my-bookings/00000000-0000-4000-8000-000000000000')
    await expect(page.getByText('頁面不存在')).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: '歷程' })).toHaveCount(0)
  })
})

test.describe('3. 教練（Owner）確認／拒絕／取消', () => {
  test('待確認預約有「確認」「拒絕」；拒絕原因必填，送出後顯示教練拒絕摘要', async ({ page }) => {
    await login(page, ctx.owner.email)
    await page.goto('/bookings')
    const card = tenantCard(page, SVC.ownerReject)
    await expect(card).toBeVisible()
    await expect(card.getByRole('button', { name: '確認', exact: true })).toBeVisible()
    await expect(card.getByRole('button', { name: '拒絕', exact: true })).toBeVisible()
    await expect(card.getByRole('button', { name: '取消', exact: true })).toHaveCount(0)

    await card.getByRole('button', { name: '拒絕', exact: true }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog.getByText('確定要拒絕此預約嗎？')).toBeVisible()
    await expect(dialog.getByText('拒絕原因＊')).toBeVisible()
    await expect(dialog.getByRole('button', { name: '返回', exact: true })).toBeVisible()
    const confirmBtn = dialog.getByRole('button', { name: '拒絕預約', exact: true })
    await expect(confirmBtn).toBeDisabled()
    await dialog.getByRole('textbox').fill('   ')
    await expect(confirmBtn).toBeDisabled()
    await dialog.getByRole('textbox').fill('教練臨時有比賽')
    await expect(confirmBtn).toBeEnabled()
    await expectNoForbiddenTerms(page)
    await confirmBtn.click()
    await expect(dialog).toBeHidden()

    await expect(card.getByText('已取消', { exact: true })).toBeVisible()
    await expect(
      card.getByText('教練拒絕 · 已退回 1 堂 · 原因：教練臨時有比賽', { exact: true }),
    ).toBeVisible()
    await expect(card.getByRole('button', { name: '確認', exact: true })).toHaveCount(0)
    await expect(card.getByRole('button', { name: '拒絕', exact: true })).toHaveCount(0)

    expect(await readBooking(ctx.bookings.ownerReject)).toMatchObject({
      status: 'cancelled',
      cancel_category: 'coach_rejected',
      cancel_reason: '教練臨時有比賽',
      cancel_actor_role: 'owner',
      class_disposition: 'refunded',
    })
    await expectNoForbiddenTerms(page)
  })

  test('已確認預約按「取消」，原因必填，送出後顯示教練取消摘要', async ({ page }) => {
    await login(page, ctx.owner.email)
    await page.goto('/bookings')
    const card = tenantCard(page, SVC.ownerCancel)
    await expect(card.getByRole('button', { name: '取消', exact: true })).toBeVisible()
    await expect(card.getByRole('button', { name: '確認', exact: true })).toHaveCount(0)
    await expect(card.getByRole('button', { name: '拒絕', exact: true })).toHaveCount(0)

    await card.getByRole('button', { name: '取消', exact: true }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog.getByText('確定要取消此預約嗎？')).toBeVisible()
    await expect(dialog.getByText('取消原因＊')).toBeVisible()
    await expect(dialog.getByRole('button', { name: '返回', exact: true })).toBeVisible()
    const confirmBtn = dialog.getByRole('button', { name: '取消預約', exact: true })
    await expect(confirmBtn).toBeDisabled()
    await dialog.getByRole('textbox').fill('場地臨時整修')
    await expect(confirmBtn).toBeEnabled()
    await confirmBtn.click()
    await expect(dialog).toBeHidden()

    await expect(card.getByText('已取消', { exact: true })).toBeVisible()
    await expect(
      card.getByText('教練取消 · 已退回 1 堂 · 原因：場地臨時整修', { exact: true }),
    ).toBeVisible()
    await expect(card.getByRole('button', { name: '取消', exact: true })).toHaveCount(0)

    expect(await readBooking(ctx.bookings.ownerCancel)).toMatchObject({
      status: 'cancelled',
      cancel_category: 'coach_cancelled',
      cancel_reason: '場地臨時整修',
      cancel_actor_role: 'owner',
      class_disposition: 'refunded',
    })
  })
})

test.describe('4. 教練端預約管理與明細頁', () => {
  test('預約管理的篩選列有「已出席」「未出席」', async ({ page }) => {
    await login(page, ctx.owner.email)
    await page.goto('/bookings')
    await expect(page.getByRole('heading', { level: 1, name: '預約管理' })).toBeVisible()
    for (const label of ['全部', '待確認', '已確認', '已出席', '未出席', '已取消']) {
      await expect(page.getByRole('link', { name: label, exact: true })).toBeVisible()
    }
    await expect(page.getByRole('link', { name: '已出席', exact: true })).toHaveAttribute(
      'href',
      '/bookings?status=completed',
    )
    await expect(page.getByRole('link', { name: '未出席', exact: true })).toHaveAttribute(
      'href',
      '/bookings?status=no_show',
    )
    await expectNoForbiddenTerms(page)
  })

  test('從清單的「明細」進入：取消紀錄與歷程都在', async ({ page }) => {
    await login(page, ctx.owner.email)
    await page.goto('/bookings')
    const card = tenantCard(page, SVC.custCancelled)
    await card.getByRole('link', { name: '明細', exact: true }).click()
    await page.waitForURL(`**/bookings/${ctx.bookings.custCancelled}`)

    await expect(page.getByRole('heading', { level: 1, name: ctx.customer.name })).toBeVisible()

    const record = tenantSection(page, '取消紀錄')
    await expect(fieldValue(record, '類別')).toHaveText('學員取消')
    await expect(fieldValue(record, '原因')).toHaveText(CUSTOMER_CANCELLED_REASON)
    await expect(fieldValue(record, '取消人')).toHaveText(`${ctx.customer.name}（學員）`)
    await expect(fieldValue(record, '堂數')).toHaveText('已退回 1 堂')

    const history = tenantSection(page, '歷程')
    await expect(history.locator('li')).toHaveCount(3)
    await expect(timelineItem(history, '建立預約，使用 1 堂')).toContainText(
      `${ctx.customer.name}（學員）`,
    )
    await expect(timelineItem(history, '預約已確認')).toContainText('Owner')
    await expect(timelineItem(history, '取消預約，已退回 1 堂')).toContainText(
      `原因：${CUSTOMER_CANCELLED_REASON}`,
    )
    await expect(
      page.getByText('只有這個時段的教練或 Owner 可以查看歷程和操作這筆預約。'),
    ).toHaveCount(0)
    await expectNoForbiddenTerms(page)
  })
})

test.describe('5. 助教的操作範圍', () => {
  test('別人時段的預約沒有確認／拒絕／取消；自己時段的有', async ({ page }) => {
    await login(page, ctx.staff.email)
    await page.goto('/bookings')

    const others = tenantCard(page, SVC.ownerSlotPending)
    await expect(others).toBeVisible()
    await expect(others.getByRole('link', { name: '明細', exact: true })).toBeVisible()
    await expect(others.getByRole('button')).toHaveCount(0)

    const own = tenantCard(page, SVC.staffSlotPending)
    await expect(own.getByRole('button', { name: '確認', exact: true })).toBeVisible()
    await expect(own.getByRole('button', { name: '拒絕', exact: true })).toBeVisible()
    await expectNoForbiddenTerms(page)
  })

  test('開別人時段預約的明細頁：看不到歷程與按鈕，顯示說明', async ({ page }) => {
    await login(page, ctx.staff.email)
    await page.goto(`/bookings/${ctx.bookings.ownerSlotPending}`)

    await expect(
      page.getByText('只有這個時段的教練或 Owner 可以查看歷程和操作這筆預約。'),
    ).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: '預約資料' })).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: '歷程' })).toHaveCount(0)
    for (const name of ['確認', '拒絕', '取消']) {
      await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0)
    }
    await expectNoForbiddenTerms(page)
  })
})

test.describe('6. 用語', () => {
  test('學員端：我的預約、明細頁不出現舊用語', async ({ page }) => {
    await login(page, ctx.customer.email)
    await page.goto('/my-bookings')
    await expect(customerCard(page, SVC.custCancelled)).toBeVisible()
    await expectNoForbiddenTerms(page)

    await page.goto(`/my-bookings/${ctx.bookings.custCancelled}`)
    await expect(page.getByRole('heading', { level: 2, name: '歷程' })).toBeVisible()
    await expectNoForbiddenTerms(page)
  })

  test('教練端（Owner）：預約管理（各篩選）、明細頁不出現舊用語', async ({ page }) => {
    await login(page, ctx.owner.email)
    for (const status of ['', 'pending', 'confirmed', 'completed', 'no_show', 'cancelled']) {
      await page.goto(status ? `/bookings?status=${status}` : '/bookings')
      await expect(page.getByRole('heading', { level: 1, name: '預約管理' })).toBeVisible()
      await expectNoForbiddenTerms(page)
    }

    await page.goto(`/bookings/${ctx.bookings.custCancelled}`)
    await expect(page.getByRole('heading', { level: 2, name: '歷程' })).toBeVisible()
    await expectNoForbiddenTerms(page)
  })
})
