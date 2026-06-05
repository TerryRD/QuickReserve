/**
 * 純 JS 版路由清單（與 routes.ts 的 ALL_ROUTES 等價），供 Node 編排腳本載入。
 * 若修改 routes.ts 的路由，請同步此檔。
 */
export const ALL_ROUTES = [
  { id: '(auth)/login', match: (p) => p === '/login' },
  { id: '(auth)/signup', match: (p) => p === '/signup' },
  { id: 'invite/[token]', match: (p) => p.startsWith('/invite/') },
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
  { id: '(customer)/my-bookings', match: (p) => p === '/my-bookings' },
  { id: '(customer)/account/notifications', match: (p) => p === '/account/notifications' },
  { id: '[tenantSlug]', match: (p) => /^\/demo-[^/]+-coach$/.test(p) },
  { id: '[tenantSlug]/packages', match: (p) => /^\/demo-[^/]+-coach\/packages$/.test(p) },
  { id: '[tenantSlug]/purchases', match: (p) => /^\/demo-[^/]+-coach\/purchases$/.test(p) },
  { id: 'book/[slotId]', match: (p) => p.startsWith('/book/') },
  { id: '(platform)/platform/dashboard', match: (p) => p === '/platform/dashboard' },
  { id: '(platform)/platform/tenants', match: (p) => p === '/platform/tenants' },
  {
    id: '(platform)/platform/tenants/[tenantId]',
    match: (p) => /^\/platform\/tenants\/[^/]+$/.test(p) && p !== '/platform/tenants',
  },
  { id: '(platform)/platform/bookings', match: (p) => p === '/platform/bookings' },
]

export function routeIdsForPaths(paths) {
  const hit = new Set()
  for (const p of paths) {
    for (const r of ALL_ROUTES) if (r.match(p)) hit.add(r.id)
  }
  return hit
}
