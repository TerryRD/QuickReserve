import { test as base, expect, type Page } from '@playwright/test'

/**
 * 字幕/標註原語：無聲教學影片靠在畫面注入 DOM 橫幅當「字幕」。
 * 所有文字皆為中文。
 */

const BANNER_ID = '__tutorial_banner__'

/** 在畫面頂端注入/更新中文字幕橫幅，停頓 ms 讓觀眾讀完。 */
export async function narrate(page: Page, title: string, desc = '', ms = 1800) {
  await page.evaluate(
    ({ id, title, desc }) => {
      let el = document.getElementById(id)
      if (!el) {
        el = document.createElement('div')
        el.id = id
        el.style.cssText = [
          'position:fixed',
          'top:0',
          'left:0',
          'right:0',
          'z-index:2147483647',
          'background:rgba(17,17,17,0.92)',
          'color:#fff',
          'padding:14px 22px',
          'font-family:system-ui,"Noto Sans TC",sans-serif',
          'pointer-events:none',
          'box-shadow:0 2px 12px rgba(0,0,0,0.35)',
          'transition:opacity .2s',
        ].join(';')
        document.body.appendChild(el)
      }
      el.innerHTML =
        `<div style="font-size:20px;font-weight:700;letter-spacing:.5px">${title}</div>` +
        (desc ? `<div style="font-size:14px;opacity:.85;margin-top:3px">${desc}</div>` : '')
    },
    { id: BANNER_ID, title, desc }
  )
  await page.waitForTimeout(ms)
}

/** 替目標元素加暫時外框，操作後移除，讓視線好跟。 */
export async function highlight(page: Page, selectorOrLocator: string) {
  const loc = page.locator(selectorOrLocator).first()
  await loc
    .evaluate((node: HTMLElement) => {
      node.style.outline = '3px solid #e11d48'
      node.style.outlineOffset = '2px'
      node.scrollIntoView({ block: 'center', behavior: 'smooth' })
    })
    .catch(() => {})
  await page.waitForTimeout(500)
}

/** highlight → 短停 → click 的組合包（接受字串 selector）。 */
export async function clickWithCue(page: Page, selector: string) {
  await highlight(page, selector)
  await page.locator(selector).first().click()
  await page.waitForTimeout(400)
}

/** 純停頓，用於頁面切換之間。 */
export async function pace(page: Page, ms = 900) {
  await page.waitForTimeout(ms)
}

/** 導頁 + 字幕一次完成，並回傳實際抵達的 pathname（供覆蓋檢核累計）。 */
export async function gotoStep(page: Page, path: string, title: string, desc = '', ms = 1600) {
  await page.goto(path)
  await narrate(page, title, desc, ms)
  return new URL(page.url()).pathname
}

export { base as test, expect }
