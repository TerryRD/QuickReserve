/**
 * Production perf audit — measures warm-hit median TTFB across all 27 page.tsx routes.
 *
 * Flow:
 *   1. Login each role (platform / coach / staff / student / anonymous) via Playwright UI
 *   2. For each route × role, navigate 5 times, capture Navigation Timing
 *      (responseStart - fetchStart = TTFB; loadEventEnd - fetchStart = full load)
 *   3. Cold = run #1; warm-median = median(runs 3,4,5)
 *   4. Output JSON to docs/perf-audit-results.json
 *
 * Run:  E2E_BASE_URL=https://quick-reserve-mu.vercel.app node scripts/perf-audit.mjs
 *
 * Env vars (read from .env.local):
 *   - PLATFORM_ADMIN_EMAIL / PLATFORM_ADMIN_PWD (default: terry@gmail.com / Nx7$kPm9!Lq3vRz2)
 *   - All demo-* accounts use Test1234! (seeded by scripts/seed-test-data.mjs)
 */
import ws from 'ws'
globalThis.WebSocket = ws
import { createClient } from '@supabase/supabase-js'
import { chromium } from '@playwright/test'
import { config } from 'dotenv'
import { writeFileSync } from 'node:fs'
config({ path: '.env.local' })

const BASE = process.env.E2E_BASE_URL ?? 'https://quick-reserve-mu.vercel.app'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const admin = createClient(SUPABASE_URL, SERVICE_KEY)

const PWD = 'Test1234!'
const PLATFORM_EMAIL = process.env.PLATFORM_ADMIN_EMAIL ?? 'terry@gmail.com'
const PLATFORM_PWD = process.env.PLATFORM_ADMIN_PWD ?? 'Nx7$kPm9!Lq3vRz2'

const RUNS = 5
const WARM_INDICES = [2, 3, 4] // 3rd, 4th, 5th run (0-indexed)

const log = (...a) => console.log(...a)
const median = (arr) => {
  const s = [...arr].sort((a, b) => a - b)
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2
}

// ─── Discover seed IDs ───
async function discoverIds() {
  const { data: tenants } = await admin
    .from('tenants')
    .select('id, slug, name')
    .like('slug', 'demo-%')
    .limit(5)
  const { data: slots } = await admin
    .from('availability_slots')
    .select('id, tenant_id, start_at, status')
    .gte('start_at', new Date().toISOString())
    .eq('status', 'open')
    .order('start_at')
    .limit(3)
  const wangSlug = tenants?.find((t) => t.slug.includes('wang'))?.slug ?? tenants?.[0]?.slug
  const wangId = tenants?.find((t) => t.slug.includes('wang'))?.id ?? tenants?.[0]?.id
  const slotId = slots?.[0]?.id
  log(`  seed: wangSlug=${wangSlug}, wangId=${wangId}, slotId=${slotId}`)
  return { wangSlug, wangId, slotId, tenants }
}

// ─── Build route list ───
function buildRoutes({ wangSlug, wangId, slotId }) {
  return [
    // ── public (no auth) ──
    { path: '/', role: 'anon', label: 'landing' },
    { path: '/login', role: 'anon', label: 'auth-login' },
    { path: '/signup', role: 'anon', label: 'auth-signup' },
    { path: `/${wangSlug}`, role: 'anon', label: 'public-tenant' },
    { path: `/${wangSlug}/packages`, role: 'anon', label: 'public-packages' },
    slotId && { path: `/book/${slotId}`, role: 'anon', label: 'public-book-slot' },

    // ── student ──
    { path: '/my-bookings', role: 'student', label: 'my-bookings' },
    { path: '/account/notifications', role: 'student', label: 'account-notifications' },
    { path: `/${wangSlug}/purchases`, role: 'student', label: 'tenant-purchases' },

    // ── tenant owner (王教練) ──
    { path: '/dashboard', role: 'coach', label: 'coach-dashboard' },
    { path: '/calendar', role: 'coach', label: 'coach-calendar' },
    { path: '/calendar/availability', role: 'coach', label: 'coach-calendar-avail' },
    { path: '/calendar/rules', role: 'coach', label: 'coach-calendar-rules' },
    { path: '/services', role: 'coach', label: 'coach-services' },
    { path: '/packages', role: 'coach', label: 'coach-packages' },
    { path: '/packages/pending', role: 'coach', label: 'coach-packages-pending' },
    { path: '/customers', role: 'coach', label: 'coach-customers' },
    { path: '/bookings', role: 'coach', label: 'coach-bookings' },
    { path: '/staff', role: 'coach', label: 'coach-staff' },
    { path: '/notifications', role: 'coach', label: 'coach-notifications' },
    { path: '/settings/profile', role: 'coach', label: 'coach-settings-profile' },
    { path: '/settings/notifications', role: 'coach', label: 'coach-settings-notifications' },

    // ── platform admin ──
    { path: '/platform/dashboard', role: 'platform', label: 'platform-dashboard' },
    { path: '/platform/tenants', role: 'platform', label: 'platform-tenants' },
    wangId && { path: `/platform/tenants/${wangId}`, role: 'platform', label: 'platform-tenant-detail' },
    { path: '/platform/bookings', role: 'platform', label: 'platform-bookings' },
    { path: '/platform/bookings?status=pending', role: 'platform', label: 'platform-bookings-pending' },
    { path: '/platform/bookings?status=confirmed', role: 'platform', label: 'platform-bookings-confirmed' },
  ].filter(Boolean)
}

const CREDS = {
  anon: null,
  student: { email: 'demo-student-ming@example.com', pwd: PWD },
  coach: { email: 'demo-coach-wang@example.com', pwd: PWD },
  staff: { email: 'demo-staff-ming@example.com', pwd: PWD },
  platform: { email: PLATFORM_EMAIL, pwd: PLATFORM_PWD },
}

async function login(context, role) {
  const c = CREDS[role]
  if (!c) return
  const page = await context.newPage()
  try {
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
    await page.getByLabel('Email').fill(c.email)
    await page.getByLabel('密碼').fill(c.pwd)
    await page.getByRole('button', { name: '登入' }).click()
    await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20_000 })
    log(`  ✓ login ${role} (${c.email}) → ${new URL(page.url()).pathname}`)
  } catch (e) {
    log(`  ✗ login ${role}: ${e.message}`)
    throw e
  } finally {
    await page.close()
  }
}

async function measure(context, route) {
  const page = await context.newPage()
  const runs = []
  for (let i = 0; i < RUNS; i++) {
    try {
      // capture Server-Timing header from the main document response
      let serverTimingMs = null
      let responseEndMs = null
      const t0 = Date.now()
      page.once('response', (resp) => {
        if (resp.url() === `${BASE}${route.path}` || resp.url().startsWith(`${BASE}${route.path}?`)) {
          const st = resp.headers()['server-timing']
          if (st) {
            // Vercel format: "vercel;desc=...;dur=XX,..."
            const total = [...st.matchAll(/dur=([0-9.]+)/g)].reduce((s, m) => s + Number(m[1]), 0)
            serverTimingMs = Math.round(total)
          }
        }
      })
      const response = await page.goto(`${BASE}${route.path}`, { waitUntil: 'load', timeout: 25_000 })
      if (response) {
        const st = response.headers()['server-timing']
        if (st && serverTimingMs === null) {
          const total = [...st.matchAll(/dur=([0-9.]+)/g)].reduce((s, m) => s + Number(m[1]), 0)
          serverTimingMs = Math.round(total)
        }
      }
      const timing = await page.evaluate(() => {
        const nav = performance.getEntriesByType('navigation')[0]
        if (!nav) return null
        const fcp = performance.getEntriesByName('first-contentful-paint')[0]
        return {
          ttfb: Math.round(nav.responseStart - nav.fetchStart),
          responseEnd: Math.round(nav.responseEnd - nav.fetchStart),
          domContentLoaded: Math.round(nav.domContentLoadedEventEnd - nav.fetchStart),
          load: Math.round(nav.loadEventEnd - nav.fetchStart),
          fcp: fcp ? Math.round(fcp.startTime) : null,
        }
      })
      const wallMs = Date.now() - t0
      runs.push({ ...timing, wallMs, serverTimingMs })
    } catch (e) {
      runs.push({ error: e.message })
    }
  }
  await page.close()
  return runs
}

async function main() {
  log(`\n─── Perf audit against ${BASE} ───`)
  log('\n─── Discover seed IDs ───')
  const { wangSlug, wangId, slotId } = await discoverIds()
  const routes = buildRoutes({ wangSlug, wangId, slotId })
  log(`\n  ${routes.length} routes to measure`)

  const browser = await chromium.launch()
  const results = []

  // group by role to reuse a single logged-in context per role
  const byRole = {}
  for (const r of routes) {
    if (!byRole[r.role]) byRole[r.role] = []
    byRole[r.role].push(r)
  }

  for (const [role, roleRoutes] of Object.entries(byRole)) {
    log(`\n─── role: ${role} (${roleRoutes.length} routes) ───`)
    const context = await browser.newContext()
    if (role !== 'anon') {
      try {
        await login(context, role)
      } catch {
        log(`  skip role ${role}`)
        await context.close()
        continue
      }
    }
    for (const route of roleRoutes) {
      const runs = await measure(context, route)
      const num = (k) => runs.map((r) => r[k]).filter((v) => typeof v === 'number')
      const warm = (arr) => (arr.length >= 5 ? median(WARM_INDICES.map((i) => arr[i])) : null)
      const ttfbs = num('ttfb')
      const respEnds = num('responseEnd')
      const dcls = num('domContentLoaded')
      const loads = num('load')
      const fcps = num('fcp')
      const sts = num('serverTimingMs')
      const summary = {
        warmTtfb: warm(ttfbs),
        warmResponseEnd: warm(respEnds),
        warmFcp: warm(fcps),
        warmDcl: warm(dcls),
        warmLoad: warm(loads),
        warmServerTiming: warm(sts),
        coldLoad: loads[0] ?? null,
      }
      // Baseline = server-timing or responseEnd as proxy for "server processing"
      const serverMs = summary.warmServerTiming ?? summary.warmResponseEnd
      const meets = serverMs !== null && serverMs <= 500
      const status = meets ? '✓' : serverMs === null ? '?' : '✗'
      log(
        `  ${status} ${route.path.padEnd(45)} server ${serverMs}ms / FCP ${summary.warmFcp}ms / load ${summary.warmLoad}ms`,
      )
      results.push({ ...route, ...summary, runs, meetsBaseline: meets })
    }
    await context.close()
  }

  await browser.close()

  writeFileSync('docs/perf-audit-results.json', JSON.stringify(results, null, 2))
  log(`\n─── Wrote docs/perf-audit-results.json (${results.length} routes) ───`)

  const over = results.filter((r) => !r.meetsBaseline && r.warmResponseEnd !== null)
  log(`\n─── Summary (baseline = server-timing or responseEnd ≤500ms) ───`)
  log(`  Total measured: ${results.length}`)
  log(`  Meets baseline: ${results.filter((r) => r.meetsBaseline).length}`)
  log(`  OVER baseline: ${over.length}`)
  if (over.length) {
    log(`\n  Sorted worst first (warmServerTiming / warmResponseEnd):`)
    over
      .sort((a, b) => (b.warmServerTiming ?? b.warmResponseEnd) - (a.warmServerTiming ?? a.warmResponseEnd))
      .forEach((r) =>
        log(`    ${(r.warmServerTiming ?? r.warmResponseEnd) + 'ms'}  ${r.path}  (load ${r.warmLoad}ms)`),
      )
  }
  log(`\n  Top-10 by warmLoad (perceived):`)
  ;[...results]
    .filter((r) => r.warmLoad !== null)
    .sort((a, b) => b.warmLoad - a.warmLoad)
    .slice(0, 10)
    .forEach((r) =>
      log(
        `    load ${r.warmLoad}ms / server ${r.warmServerTiming ?? r.warmResponseEnd}ms / FCP ${r.warmFcp}ms  ${r.path}`,
      ),
    )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
