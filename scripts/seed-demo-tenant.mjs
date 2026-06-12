// Seed a demo table-tennis tenant for manual testing.
// Run: node --env-file=.env.local scripts/seed-demo-tenant.mjs
// Idempotent: deletes the existing demo tenant (by slug) and demo auth users
// (by @pingpong-demo.test email) first, then recreates everything.
//
// Accounts (all password TestPass123!):
//   matt@pingpong-demo.test     owner / 專業教練
//   yahan@pingpong-demo.test    staff / 資深教練
//   jingting@pingpong-demo.test staff / 資深教練
//   yixuan@pingpong-demo.test   staff / 資深教練
//   ming@/hua@/mei@pingpong-demo.test  學員

import WebSocket from 'ws'
if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = WebSocket
}
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Run with: node --env-file=.env.local scripts/seed-demo-tenant.mjs')
  process.exit(1)
}

const admin = createClient(url, key, { auth: { persistSession: false } })

const PW = 'TestPass123!'
const DOMAIN = 'pingpong-demo.test'
const SLUG = 'matt-pingpong-demo'

const MIN = 60 * 1000
const HR = 60 * MIN
const DAY = 24 * HR
const now = new Date()
const iso = (ms) => new Date(ms).toISOString()

// Throw helper: surface any Supabase error immediately.
function ck(label, { data, error }) {
  if (error) {
    console.error(`✗ ${label}:`, error.message)
    throw new Error(`${label}: ${error.message}`)
  }
  return data
}

async function mkUser(email, displayName) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PW,
    email_confirm: true,
    user_metadata: { display_name: displayName, full_name: displayName },
  })
  if (error) throw new Error(`createUser ${email}: ${error.message}`)
  return data.user.id
}

// ---------------------------------------------------------------- cleanup ----
console.log('Cleaning up any previous demo data...')
// Tenant delete cascades tenant_members, services, service_packages,
// availability_slots, bookings, customer_purchases, tenant_customers.
ck('delete tenant', await admin.from('tenants').delete().eq('slug', SLUG))

// Delete demo auth users (and their global customers rows).
const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
if (listErr) throw new Error(`listUsers: ${listErr.message}`)
const demoUsers = (list?.users ?? []).filter((u) => u.email?.endsWith('@' + DOMAIN))
for (const u of demoUsers) {
  await admin.from('customers').delete().eq('id', u.id)
  const { error } = await admin.auth.admin.deleteUser(u.id)
  if (error) console.warn(`  warn: deleteUser ${u.email}: ${error.message}`)
}
console.log(`  removed ${demoUsers.length} old demo user(s)`)

// --------------------------------------------------------------- accounts ----
console.log('Creating accounts...')
const mattId = await mkUser(`matt@${DOMAIN}`, 'Matt 教練')
const yahanId = await mkUser(`yahan@${DOMAIN}`, '雅涵')
const jingtingId = await mkUser(`jingting@${DOMAIN}`, '靖庭')
const yixuanId = await mkUser(`yixuan@${DOMAIN}`, '依璇')
const mingId = await mkUser(`ming@${DOMAIN}`, '小明')
const huaId = await mkUser(`hua@${DOMAIN}`, '小華')
const meiId = await mkUser(`mei@${DOMAIN}`, '小美')

// students -> customers rows
for (const [id, name] of [[mingId, '小明'], [huaId, '小華'], [meiId, '小美']]) {
  ck(`customer ${name}`, await admin.from('customers').insert({ id, display_name: name }).select().single())
}

// ----------------------------------------------------------------- tenant ----
console.log('Creating tenant + members...')
const tenant = ck('tenant', await admin.from('tenants').insert({
  slug: SLUG,
  name: 'Matt 桌球教室 (測試)',
  description: '桌球教學測試租戶（個別課 1v1/1v2 + 團體課）',
}).select().single())
const tid = tenant.id

const mattMember = ck('member Matt', await admin.from('tenant_members').insert({
  tenant_id: tid, user_id: mattId, role: 'owner', status: 'active',
}).select().single())

const staffMembers = {}
for (const [uid, name, keyName] of [
  [yahanId, '雅涵', 'yahan'],
  [jingtingId, '靖庭', 'jingting'],
  [yixuanId, '依璇', 'yixuan'],
]) {
  staffMembers[keyName] = ck(`member ${name}`, await admin.from('tenant_members').insert({
    tenant_id: tid, user_id: uid, role: 'staff', status: 'active', parent_member_id: mattMember.id,
  }).select().single())
}

// --------------------------------------------------------------- services ----
console.log('Creating services...')
const svcDefs = [
  { keyName: 'i1v1pro', name: '個別課 1v1（專業）', price: 1000, duration_minutes: 60, max_capacity: 1, min_attendance: 1 },
  { keyName: 'i1v1sr', name: '個別課 1v1（資深）', price: 800, duration_minutes: 60, max_capacity: 1, min_attendance: 1 },
  { keyName: 'i1v2pro', name: '個別課 1v2（專業）', price: 1000, duration_minutes: 60, max_capacity: 2, min_attendance: 1 },
  { keyName: 'i1v2sr', name: '個別課 1v2（資深）', price: 800, duration_minutes: 60, max_capacity: 2, min_attendance: 1 },
  { keyName: 'group', name: '團體課', price: 450, duration_minutes: 90, max_capacity: 10, min_attendance: 3 },
  { keyName: 'trialPro', name: '試上・個別課（專業）', price: 800, duration_minutes: 60, max_capacity: 1, min_attendance: 1 },
  { keyName: 'trialSr', name: '試上・個別課（資深）', price: 600, duration_minutes: 60, max_capacity: 1, min_attendance: 1 },
  { keyName: 'trialGroup', name: '試上・團體課（免費）', price: 0, duration_minutes: 90, max_capacity: 10, min_attendance: 3 },
]
const svc = {}
let order = 0
for (const d of svcDefs) {
  const row = ck(`service ${d.name}`, await admin.from('services').insert({
    tenant_id: tid,
    name: d.name,
    price: d.price,
    duration_minutes: d.duration_minutes,
    max_capacity: d.max_capacity,
    min_attendance: d.min_attendance,
    display_order: order++,
    is_active: true,
  }).select().single())
  svc[d.keyName] = row
}

// --------------------------------------------------------------- packages ----
// Only individual classes. 10 堂 95 折, 20 堂 9 折. Expires in 180 days.
console.log('Creating packages...')
const pkgBase = [
  { keyName: 'i1v1pro', unit: 1000 },
  { keyName: 'i1v1sr', unit: 800 },
  { keyName: 'i1v2pro', unit: 1000 },
  { keyName: 'i1v2sr', unit: 800 },
]
const pkg = {}
for (const p of pkgBase) {
  const s = svc[p.keyName]
  pkg[p.keyName] = {
    ten: ck(`pkg10 ${s.name}`, await admin.from('service_packages').insert({
      tenant_id: tid, service_id: s.id, name: '一期 10 堂（95 折）',
      class_count: 10, price: Math.round(p.unit * 10 * 0.95), expires_in_days: 180, is_active: true,
    }).select().single()),
    twenty: ck(`pkg20 ${s.name}`, await admin.from('service_packages').insert({
      tenant_id: tid, service_id: s.id, name: '兩期 20 堂（9 折）',
      class_count: 20, price: Math.round(p.unit * 20 * 0.9), expires_in_days: 180, is_active: true,
    }).select().single()),
  }
}

// -------------------------------------------------------------- purchases ----
console.log('Creating purchases...')
const expires = iso(now.getTime() + 180 * DAY)
async function mkPurchase(label, customerId, serviceId, packageId, classesTotal, classesUsed) {
  return ck(`purchase ${label}`, await admin.from('customer_purchases').insert({
    tenant_id: tid, customer_id: customerId, service_id: serviceId, package_id: packageId,
    classes_total: classesTotal, classes_used: classesUsed,
    payment_self_reported: 'claimed_paid', approval_status: 'confirmed',
    approved_at: now.toISOString(), approved_by: mattId, expires_at: expires,
  }).select().single())
}
const pMing = await mkPurchase('小明 1v1專業×10', mingId, svc.i1v1pro.id, pkg.i1v1pro.ten.id, 10, 1)
const pHua = await mkPurchase('小華 1v1資深×20', huaId, svc.i1v1sr.id, pkg.i1v1sr.twenty.id, 20, 1)
const pMei = await mkPurchase('小美 團體×5', meiId, svc.group.id, null, 5, 1)

// tenant_customers bridge (so students appear under the tenant)
for (const cid of [mingId, huaId, meiId]) {
  await admin.from('tenant_customers').insert({ tenant_id: tid, customer_id: cid }).select().maybeSingle()
}

// ------------------------------------------------------------------ slots ----
console.log('Creating slots + bookings...')
async function mkSlot(label, memberId, serviceId, startMs, durMin, status) {
  return ck(`slot ${label}`, await admin.from('availability_slots').insert({
    tenant_id: tid, member_id: memberId, service_id: serviceId,
    start_at: iso(startMs), end_at: iso(startMs + durMin * MIN), status,
  }).select().single())
}
// NOTE: availability_slots.member_id references tenant_members.id (NOT auth user id).
// Matt: ONGOING 1v1 (for immediate check-in test) + a future open 1v1 + a future group
const slotMattNow = await mkSlot('Matt 進行中 1v1', mattMember.id, svc.i1v1pro.id, now.getTime() - 5 * MIN, 60, 'booked')
const slotMattFuture = await mkSlot('Matt 明日 1v1', mattMember.id, svc.i1v1pro.id, now.getTime() + DAY + 2 * HR, 60, 'available')
const slotGroup = await mkSlot('Matt 後天 團體課', mattMember.id, svc.group.id, now.getTime() + 2 * DAY, 90, 'pending')
// 雅涵: one booked + one open
const slotYahanBooked = await mkSlot('雅涵 明日 1v1(資深)', staffMembers.yahan.id, svc.i1v1sr.id, now.getTime() + DAY + 3 * HR, 60, 'booked')
await mkSlot('雅涵 明日 1v1 開放', staffMembers.yahan.id, svc.i1v1sr.id, now.getTime() + DAY + 5 * HR, 60, 'available')
// 靖庭 / 依璇: open future 1v1(資深)
await mkSlot('靖庭 明日 1v1(資深)', staffMembers.jingting.id, svc.i1v1sr.id, now.getTime() + DAY + 2 * HR, 60, 'available')
await mkSlot('依璇 明日 1v1(資深)', staffMembers.yixuan.id, svc.i1v1sr.id, now.getTime() + DAY + 4 * HR, 60, 'available')

// --------------------------------------------------------------- bookings ----
async function mkBooking(label, slotId, customerId, serviceId, purchaseId, status) {
  return ck(`booking ${label}`, await admin.from('bookings').insert({
    tenant_id: tid, slot_id: slotId, customer_id: customerId, service_id: serviceId,
    purchase_id: purchaseId, status,
  }).select().single())
}
// 小明 -> Matt ongoing (confirmed) => check-in testable right now
await mkBooking('小明→Matt 進行中', slotMattNow.id, mingId, svc.i1v1pro.id, pMing.id, 'confirmed')
// 小華 -> 雅涵 future (confirmed)
await mkBooking('小華→雅涵 明日', slotYahanBooked.id, huaId, svc.i1v1sr.id, pHua.id, 'confirmed')
// 小美 -> group future (pending; group needs min 3)
await mkBooking('小美→團體 後天', slotGroup.id, meiId, svc.group.id, pMei.id, 'pending')

// ----------------------------------------------------------------- output ----
console.log('\n✅ Demo tenant seeded.')
console.log(`Tenant: Matt 桌球教室 (測試)  /  slug: ${SLUG}  /  id: ${tid}`)
console.log(`Public page: /${SLUG}`)
console.log('\nAccounts (password for all: TestPass123!):')
console.log('  owner  Matt 教練  matt@' + DOMAIN)
console.log('  staff  雅涵        yahan@' + DOMAIN)
console.log('  staff  靖庭        jingting@' + DOMAIN)
console.log('  staff  依璇        yixuan@' + DOMAIN)
console.log('  學員   小明        ming@' + DOMAIN + '   (1v1專業 10堂, 已預約 Matt 進行中課 → 可測簽到)')
console.log('  學員   小華        hua@' + DOMAIN + '    (1v1資深 20堂, 已預約 雅涵 明日課)')
console.log('  學員   小美        mei@' + DOMAIN + '    (團體 5堂, 已預約 後天團體課/待開班)')
console.log('\nServices: 8 (4 個別課 + 1 團體 + 3 試上)   Packages: 8 (個別課 10/20 堂)')
process.exit(0)
