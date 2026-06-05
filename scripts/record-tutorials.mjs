/**
 * 教學影片錄製編排：
 *   1. 前置檢查 ffmpeg（必要）
 *   2. 重置 seed（冪等，只動 demo- 租戶）
 *   3. 跑 Playwright 錄製（產 .webm 到 tutorials/.raw）
 *   4. 將每支 webm 轉成 mp4，依角色命名輸出到 tutorials/
 *   5. 覆蓋檢核：彙整四支造訪路徑，缺漏則報告
 *   6. 清理 .raw
 *
 * 用法：node scripts/record-tutorials.mjs [roleFilter]
 *   roleFilter 可選 coach|customer|staff|platform（傳給 playwright 當檔名過濾）
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { ALL_ROUTES, routeIdsForPaths } from '../tests/tutorials/routes.coverage.mjs'

const RAW = 'tutorials/.raw'
const OUT = 'tutorials'
const COV = 'tutorials/.coverage'
const NAMES = {
  coach: '01-教練-完整操作',
  staff: '02-助教-完整操作',
  customer: '03-學員-完整操作',
  platform: '04-平台-完整操作',
}

function have(cmd) {
  try {
    execFileSync(cmd, ['-version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

// 1. ffmpeg 前置
if (!have('ffmpeg')) {
  console.error('✗ 找不到 ffmpeg。最終成品為 .mp4，需先安裝：')
  console.error('  Windows: winget install ffmpeg   或   choco install ffmpeg')
  process.exit(1)
}

const roleFilter = process.argv[2] // 可選
mkdirSync(OUT, { recursive: true })
rmSync(RAW, { recursive: true, force: true })
rmSync(COV, { recursive: true, force: true })

// 2. 重置 seed
console.log('▶ 重置 seed 測試資料…')
execFileSync('node', ['scripts/seed-test-data.mjs'], { stdio: 'inherit' })

// 3. 跑錄製
console.log('▶ 開始錄製…')
const pwArgs = ['playwright', 'test', '-c', 'playwright.tutorial.config.ts']
if (roleFilter) pwArgs.push(`${roleFilter}.tutorial.spec.ts`)
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'
execFileSync(npx, pwArgs, { stdio: 'inherit' })

// 4. webm → mp4
function findWebms(dir) {
  const out = []
  if (!existsSync(dir)) return out
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) out.push(...findWebms(p))
    else if (e.endsWith('.webm')) out.push(p)
  }
  return out
}
function roleOf(path) {
  if (path.includes('coach')) return 'coach'
  if (path.includes('customer')) return 'customer'
  if (path.includes('staff')) return 'staff'
  if (path.includes('platform')) return 'platform'
  return null
}
const webms = findWebms(RAW).sort()
for (const webm of webms) {
  const role = roleOf(webm)
  if (!role) continue
  const mp4 = join(OUT, `${NAMES[role]}.mp4`)
  console.log(`▶ 轉檔 ${role} → ${mp4}`)
  execFileSync(
    'ffmpeg',
    ['-y', '-i', webm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4],
    { stdio: 'inherit' }
  )
}

// 5. 覆蓋檢核（彙整所有 coverage json）
const covFiles = existsSync(COV) ? readdirSync(COV).filter((f) => f.endsWith('.json')) : []
const allPaths = covFiles.flatMap((f) => JSON.parse(readFileSync(join(COV, f), 'utf8')))
const hit = routeIdsForPaths(allPaths)
const missing = ALL_ROUTES.filter((r) => !hit.has(r.id)).map((r) => r.id)
if (missing.length && !roleFilter) {
  console.warn(`⚠ 未涵蓋路由（${missing.length}）：${missing.join(', ')}`)
} else {
  console.log(`✓ 路由覆蓋：${hit.size}/${ALL_ROUTES.length}`)
}

// 6. 清理 raw
rmSync(RAW, { recursive: true, force: true })
console.log(`\n✓ 完成。影片在 ${OUT}/`)
