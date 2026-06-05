import { expect } from '@playwright/test'

/** 全 26 路由（對應 src/app/**\/page.tsx）。動態段以樣式比對。 */
export const ALL_ROUTES: { id: string; match: (p: string) => boolean }[] = [
  // 共用 / 公開
  { id: '(auth)/login', match: (p) => p === '/login' },
  { id: '(auth)/signup', match: (p) => p === '/signup' },
  { id: 'invite/[token]', match: (p) => p.startsWith('/invite/') },
  // 教練 (tenant)
  { id: '(tenant)/dashboard', match: (p) => p === '/dashboard' },
  { id: '(tenant)/calendar', match: (p) => p === '/calendar' },
  { id: '(tenant)/calendar/availability', match: (p) => p === '/calendar/availability' },
  { id: '(tenant)/calendar/rules', match: (p) => p === '/calendar/rules' },
  { id: '(tenant)/services', match: (p) => p === '/services' },
  { id: '(tenant)/packages', match: (p) => p === '/packages' },
  { id: '(tenant)/packages/pending', match: (p) => p === '/packages/pending' },
  { id: '(tenant)/customers', match: (p) => p === '/customers' },
  { id: '(tenant)/bookings', match: (p) => p === '/bookings' },
  { id: '(tenant)/staff', match: (p) => p === '/staff' },
  { id: '(tenant)/notifications', match: (p) => p === '/notifications' },
  { id: '(tenant)/settings/profile', match: (p) => p === '/settings/profile' },
  { id: '(tenant)/settings/notifications', match: (p) => p === '/settings/notifications' },
  // 學員 (customer) + 公開
  { id: '(customer)/my-bookings', match: (p) => p === '/my-bookings' },
  { id: '(customer)/account/notifications', match: (p) => p === '/account/notifications' },
  { id: '[tenantSlug]', match: (p) => /^\/demo-[^/]+-coach$/.test(p) },
  { id: '[tenantSlug]/packages', match: (p) => /^\/demo-[^/]+-coach\/packages$/.test(p) },
  { id: '[tenantSlug]/purchases', match: (p) => /^\/demo-[^/]+-coach\/purchases$/.test(p) },
  { id: 'book/[slotId]', match: (p) => p.startsWith('/book/') },
  // 平台 (platform)
  { id: '(platform)/platform/dashboard', match: (p) => p === '/platform/dashboard' },
  { id: '(platform)/platform/tenants', match: (p) => p === '/platform/tenants' },
  {
    id: '(platform)/platform/tenants/[tenantId]',
    match: (p) => /^\/platform\/tenants\/[^/]+$/.test(p) && p !== '/platform/tenants',
  },
  { id: '(platform)/platform/bookings', match: (p) => p === '/platform/bookings' },
]

/** 把抵達過的 pathname 累加進命中的 route id 集合。 */
export function routeIdsForPaths(paths: string[]): Set<string> {
  const hit = new Set<string>()
  for (const p of paths) {
    for (const r of ALL_ROUTES) if (r.match(p)) hit.add(r.id)
  }
  return hit
}

/** 斷言一組 pathname 已涵蓋全部 ALL_ROUTES；列出缺漏。 */
export function assertCoverage(visitedPaths: string[]) {
  const hit = routeIdsForPaths(visitedPaths)
  const missing = ALL_ROUTES.filter((r) => !hit.has(r.id)).map((r) => r.id)
  expect(missing, `未涵蓋的路由：${missing.join(', ')}`).toEqual([])
}
