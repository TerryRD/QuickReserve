/**
 * Seed comprehensive test data for QuickReserve.
 *
 * Creates:
 * - 3 coaches (王/陳/林教練) with services + materialized slots
 * - 1 staff under 林教練
 * - 3 students with various bookings (pending / confirmed / cancelled)
 *
 * Idempotent: deletes any prior test tenants by slug prefix first.
 *
 * Run: node scripts/seed-test-data.mjs
 */
import ws from 'ws'
globalThis.WebSocket = ws
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const admin = createClient(SUPABASE_URL, SERVICE_KEY)

const log = (...a) => console.log(...a)
const fail = (msg) => {
  console.error('FAIL:', msg)
  process.exit(1)
}

// Common password for all test accounts (easy to remember during demo)
const PASSWORD = 'Test1234!'
const TEST_PREFIX = 'demo-'

// ─────────── ISO helpers (Asia/Taipei) ───────────
const TZ = 8 // hours
const localIso = (dateStr, timeStr) => {
  const t = timeStr.length === 5 ? `${timeStr}:00` : timeStr
  return new Date(`${dateStr}T${t}+0${TZ}:00`).toISOString()
}
const today = new Date()
const todayStr = (offsetDays = 0) => {
  const d = new Date(today)
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

async function cleanupExisting() {
  log('─── Cleanup existing demo data ───')
  // Find demo tenants
  const { data: tenants } = await admin
    .from('tenants')
    .select('id, slug')
    .like('slug', `${TEST_PREFIX}%`)
  if (tenants?.length) {
    for (const t of tenants) {
      // Find tenant members and their users — delete users so emails are reusable
      const { data: members } = await admin
        .from('tenant_members')
        .select('user_id')
        .eq('tenant_id', t.id)
      for (const m of members ?? []) {
        if (m.user_id) await admin.auth.admin.deleteUser(m.user_id).catch(() => {})
      }
      await admin.from('tenants').delete().eq('id', t.id)
      log(`  ✗ removed tenant ${t.slug}`)
    }
  }
  // Clean up demo students by email
  const { data: { users } = {} } = await admin.auth.admin.listUsers({ perPage: 1000 })
  for (const u of users ?? []) {
    if (
      u.email?.startsWith(`${TEST_PREFIX}student`) ||
      u.email?.startsWith(`${TEST_PREFIX}coach`) ||
      u.email?.startsWith(`${TEST_PREFIX}staff`)
    ) {
      await admin.auth.admin.deleteUser(u.id).catch(() => {})
      log(`  ✗ removed user ${u.email}`)
    }
  }
}

async function createCoach({ slug, name, email }) {
  const { data: tenant } = await admin
    .from('tenants')
    .insert({ slug, name, status: 'active' })
    .select()
    .single()
  const { data: user } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: name },
  })
  await admin.from('customers').upsert({ id: user.user.id, display_name: name })
  const { data: member } = await admin
    .from('tenant_members')
    .insert({ tenant_id: tenant.id, user_id: user.user.id, role: 'owner', status: 'active' })
    .select()
    .single()
  return { tenant, user: user.user, member }
}

async function createStaff({ tenantId, name, email }) {
  const { data: user } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: name },
  })
  await admin.from('customers').upsert({ id: user.user.id, display_name: name })
  const { data: member } = await admin
    .from('tenant_members')
    .insert({ tenant_id: tenantId, user_id: user.user.id, role: 'staff', status: 'active' })
    .select()
    .single()
  return { user: user.user, member }
}

async function createStudent({ name, email }) {
  const { data: user } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: name },
  })
  await admin.from('customers').upsert({ id: user.user.id, display_name: name })
  return user.user
}

async function createService({ tenantId, name, duration, price, description }) {
  const { data: svc } = await admin
    .from('services')
    .insert({
      tenant_id: tenantId,
      name,
      duration_minutes: duration,
      price,
      description,
    })
    .select()
    .single()
  return svc
}

async function createSlots({ tenantId, memberId, serviceId, schedule, ruleId }) {
  // schedule: array of { date: 'YYYY-MM-DD', start: 'HH:MM', end: 'HH:MM' }
  const rows = schedule.map((s) => ({
    tenant_id: tenantId,
    member_id: memberId,
    service_id: serviceId,
    start_at: localIso(s.date, s.start),
    end_at: localIso(s.date, s.end),
    status: 'available',
    recurring_rule_id: ruleId ?? null,
  }))
  const { data, error } = await admin.from('availability_slots').insert(rows).select()
  if (error) fail(`slots: ${error.message}`)
  return data
}

async function bookSlot({ slotId, customerId, notes, status = 'pending' }) {
  // Use direct insert because RPC requires auth context for the booking customer
  const { data: slot } = await admin
    .from('availability_slots')
    .select('tenant_id, service_id')
    .eq('id', slotId)
    .single()
  // Ensure bridge
  await admin
    .from('tenant_customers')
    .upsert(
      { tenant_id: slot.tenant_id, customer_id: customerId },
      { onConflict: 'tenant_id,customer_id' },
    )
  const { data: booking } = await admin
    .from('bookings')
    .insert({
      tenant_id: slot.tenant_id,
      slot_id: slotId,
      customer_id: customerId,
      service_id: slot.service_id,
      status,
      customer_notes: notes ?? null,
    })
    .select()
    .single()
  // Update slot status to reflect booking
  const slotStatus =
    status === 'pending' ? 'pending' : status === 'confirmed' ? 'booked' : 'available'
  await admin.from('availability_slots').update({ status: slotStatus }).eq('id', slotId)
  return booking
}

async function createTemplate({ memberId, name, windows }) {
  const { data: tmpl, error } = await admin
    .from('availability_templates')
    .insert({ member_id: memberId, name })
    .select('id')
    .single()
  if (error) fail(`template ${name}: ${error.message}`)
  if (windows.length > 0) {
    const { error: wErr } = await admin
      .from('availability_template_windows')
      .insert(windows.map((w) => ({ template_id: tmpl.id, ...w })))
    if (wErr) fail(`template windows: ${wErr.message}`)
  }
  return tmpl
}

async function assignTemplate({ memberId, templateId, effectiveFrom }) {
  const { error } = await admin
    .from('availability_template_assignments')
    .insert({ member_id: memberId, template_id: templateId, effective_from: effectiveFrom })
  if (error) fail(`assignment: ${error.message}`)
}

async function createUnavailableEvent({ memberId, startAt, endAt, reason }) {
  const { data, error } = await admin
    .from('unavailable_events')
    .insert({ member_id: memberId, start_at: startAt, end_at: endAt, reason })
    .select('id')
    .single()
  if (error) fail(`event: ${error.message}`)
  return data
}

async function main() {
  log(`\n=== QuickReserve test data seed ===`)
  log(`Password for all accounts: ${PASSWORD}\n`)

  await cleanupExisting()

  log('\n─── Creating coaches ───')
  const wang = await createCoach({
    slug: `${TEST_PREFIX}wang-coach`,
    name: '王教練',
    email: `${TEST_PREFIX}coach-wang@example.com`,
  })
  log(`  ✓ ${wang.tenant.name} (/${wang.tenant.slug})`)

  const chen = await createCoach({
    slug: `${TEST_PREFIX}chen-coach`,
    name: '陳教練',
    email: `${TEST_PREFIX}coach-chen@example.com`,
  })
  log(`  ✓ ${chen.tenant.name} (/${chen.tenant.slug})`)

  const lin = await createCoach({
    slug: `${TEST_PREFIX}lin-coach`,
    name: '林教練',
    email: `${TEST_PREFIX}coach-lin@example.com`,
  })
  log(`  ✓ ${lin.tenant.name} (/${lin.tenant.slug})`)

  log('\n─── Creating staff (under 林教練) ───')
  const ming = await createStaff({
    tenantId: lin.tenant.id,
    name: '阿明助教',
    email: `${TEST_PREFIX}staff-ming@example.com`,
  })
  log(`  ✓ ${ming.user.user_metadata.display_name}`)

  log('\n─── Creating services ───')
  const wangSvc1 = await createService({
    tenantId: wang.tenant.id,
    name: '桌球 1 對 1 課',
    duration: 60,
    price: 1500,
    description: '專業桌球技術指導，從基本功到進階戰術',
  })
  const wangSvc2 = await createService({
    tenantId: wang.tenant.id,
    name: '桌球團體班',
    duration: 90,
    price: 800,
    description: '4-6 人小班制，含對打練習',
  })
  log(`  ✓ 王教練 + 2 services`)

  const chenSvc = await createService({
    tenantId: chen.tenant.id,
    name: '高爾夫初學',
    duration: 90,
    price: 2000,
    description: '揮桿基礎 + 推桿練習',
  })
  log(`  ✓ 陳教練 + 1 service`)

  const linSvc1 = await createService({
    tenantId: lin.tenant.id,
    name: '網球初級班',
    duration: 60,
    price: 1200,
  })
  const linSvc2 = await createService({
    tenantId: lin.tenant.id,
    name: '網球進階班',
    duration: 60,
    price: 1800,
  })
  log(`  ✓ 林教練 + 2 services`)

  log('\n─── Creating recurring rules ───')
  // 王教練: weekly Mon/Wed/Fri 19:00-21:00 for 12 occurrences (demo for /calendar/rules)
  const todayDate = todayStr()
  const { data: wangRule } = await admin
    .from('recurring_rules')
    .insert({
      tenant_id: wang.tenant.id,
      member_id: wang.member.id,
      service_id: wangSvc1.id,
      freq: 'weekly',
      interval_n: 1,
      by_weekday: [1, 3, 5],
      start_time: '19:00:00',
      end_time: '21:00:00',
      start_date: todayDate,
      end_condition: 'count',
      end_count: 12,
      is_active: true,
    })
    .select()
    .single()
  log(`  ✓ 王教練 rule: 每週一三五 19-21 共 12 次`)

  // 陳教練: weekly Tue/Thu 14:00-15:30 indefinite
  const { data: chenRule } = await admin
    .from('recurring_rules')
    .insert({
      tenant_id: chen.tenant.id,
      member_id: chen.member.id,
      service_id: chenSvc.id,
      freq: 'weekly',
      interval_n: 1,
      by_weekday: [2, 4],
      start_time: '14:00:00',
      end_time: '15:30:00',
      start_date: todayDate,
      end_condition: 'none',
      is_active: true,
    })
    .select()
    .single()
  log(`  ✓ 陳教練 rule: 每週二四 14-15:30 無限期`)

  log('\n─── Creating slots ───')
  // 王教練: this week + next 2 weeks, Mon/Wed/Fri 19-21
  const wangSchedule = []
  for (let w = 0; w < 3; w++) {
    for (let d = 0; d < 3; d++) {
      const offsetDay = d === 0 ? 1 : d === 1 ? 3 : 5 // Mon, Wed, Fri (from Mon-week start)
      const monday = new Date(today)
      monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7) + w * 7) // this Mon, next Mon...
      monday.setDate(monday.getDate() + offsetDay - 1)
      const date = monday.toISOString().slice(0, 10)
      wangSchedule.push({ date, start: '19:00', end: '21:00' })
    }
  }
  const wangSlots = await createSlots({
    tenantId: wang.tenant.id,
    memberId: wang.member.id,
    serviceId: wangSvc1.id,
    schedule: wangSchedule,
    ruleId: wangRule.id,
  })
  log(`  ✓ 王教練 (1對1): ${wangSlots.length} slots (linked to rule)`)

  // 陳教練: this week + next, Tue/Thu 14-16
  const chenSchedule = []
  for (let w = 0; w < 2; w++) {
    for (const offsetDay of [2, 4]) {
      const monday = new Date(today)
      monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7) + w * 7)
      monday.setDate(monday.getDate() + offsetDay - 1)
      const date = monday.toISOString().slice(0, 10)
      chenSchedule.push({ date, start: '14:00', end: '15:30' })
    }
  }
  const chenSlots = await createSlots({
    tenantId: chen.tenant.id,
    memberId: chen.member.id,
    serviceId: chenSvc.id,
    schedule: chenSchedule,
    ruleId: chenRule.id,
  })
  log(`  ✓ 陳教練 (高爾夫): ${chenSlots.length} slots (linked to rule)`)

  // 林教練: this week Sat AM
  const linSchedule = [
    { date: todayStr(5), start: '10:00', end: '11:00' },
    { date: todayStr(5), start: '11:30', end: '12:30' },
    { date: todayStr(12), start: '10:00', end: '11:00' },
  ]
  const linSlots = await createSlots({
    tenantId: lin.tenant.id,
    memberId: lin.member.id,
    serviceId: linSvc1.id,
    schedule: linSchedule,
  })
  log(`  ✓ 林教練 (網球初級): ${linSlots.length} slots`)

  // 阿明助教: 自己的時段
  const mingSchedule = [
    { date: todayStr(2), start: '15:00', end: '16:00' },
    { date: todayStr(4), start: '15:00', end: '16:00' },
  ]
  const mingSlots = await createSlots({
    tenantId: lin.tenant.id,
    memberId: ming.member.id,
    serviceId: linSvc1.id,
    schedule: mingSchedule,
  })
  log(`  ✓ 阿明助教: ${mingSlots.length} slots`)

  log('\n─── Creating students ───')
  const minming = await createStudent({
    name: '小明',
    email: `${TEST_PREFIX}student-ming@example.com`,
  })
  const minghua = await createStudent({
    name: '小華',
    email: `${TEST_PREFIX}student-hua@example.com`,
  })
  const minmei = await createStudent({
    name: '小美',
    email: `${TEST_PREFIX}student-mei@example.com`,
  })
  log(`  ✓ 小明 / 小華 / 小美`)

  log('\n─── Creating bookings ───')
  // 小明預約王教練第一個 slot (pending)
  await bookSlot({
    slotId: wangSlots[0].id,
    customerId: minming.id,
    notes: '第一次上課，想學發球',
    status: 'pending',
  })
  log(`  ✓ 小明 → 王教練 (pending, 第一個時段)`)

  // 小華預約王教練第三個 slot (confirmed)
  await bookSlot({
    slotId: wangSlots[2].id,
    customerId: minghua.id,
    notes: '想練習對打',
    status: 'confirmed',
  })
  log(`  ✓ 小華 → 王教練 (confirmed, 第三個時段)`)

  // 小美預約陳教練第一個 slot (pending)
  await bookSlot({
    slotId: chenSlots[0].id,
    customerId: minmei.id,
    notes: '完全新手',
    status: 'pending',
  })
  log(`  ✓ 小美 → 陳教練 (pending)`)

  // 小明預約林教練 slot (confirmed)
  await bookSlot({
    slotId: linSlots[0].id,
    customerId: minming.id,
    status: 'confirmed',
  })
  log(`  ✓ 小明 → 林教練 (confirmed)`)

  log('\n─── Creating availability templates (S3) ───')

  // 林教練「日常作息」: per S3 spec
  const linDaily = await createTemplate({
    memberId: lin.member.id,
    name: '日常作息',
    windows: [
      { weekday: 1, start_time: '09:00', end_time: '12:00' },
      { weekday: 1, start_time: '14:00', end_time: '17:00' },
      { weekday: 2, start_time: '14:00', end_time: '20:00' },
      { weekday: 3, start_time: '09:00', end_time: '12:00' },
      { weekday: 3, start_time: '14:00', end_time: '17:00' },
      { weekday: 4, start_time: '14:00', end_time: '20:00' },
      { weekday: 5, start_time: '09:00', end_time: '17:00' },
    ],
  })
  await assignTemplate({
    memberId: lin.member.id,
    templateId: linDaily.id,
    effectiveFrom: todayStr(),
  })
  log(`  ✓ 林教練 模板「日常作息」+ 生效中`)

  // 林教練「假期作息」: 不生效（demo 有多模板）
  await createTemplate({
    memberId: lin.member.id,
    name: '假期作息',
    windows: [
      { weekday: 6, start_time: '09:00', end_time: '12:00' },
      { weekday: 7, start_time: '09:00', end_time: '12:00' },
    ],
  })
  log(`  ✓ 林教練 模板「假期作息」（未生效）`)

  // 阿明助教「週末班」
  const mingTmpl = await createTemplate({
    memberId: ming.member.id,
    name: '週末班',
    windows: [
      { weekday: 6, start_time: '09:00', end_time: '17:00' },
      { weekday: 7, start_time: '09:00', end_time: '12:00' },
    ],
  })
  await assignTemplate({
    memberId: ming.member.id,
    templateId: mingTmpl.id,
    effectiveFrom: todayStr(),
  })
  log(`  ✓ 阿明助教 模板「週末班」+ 生效中`)

  log('\n─── Creating 林教練 recurring rule (S3) ───')
  const { data: linRule } = await admin
    .from('recurring_rules')
    .insert({
      tenant_id: lin.tenant.id,
      member_id: lin.member.id,
      service_id: linSvc2.id, // 網球進階班
      freq: 'weekly',
      interval_n: 1,
      by_weekday: [2], // 週二
      start_time: '14:00:00',
      end_time: '15:00:00',
      start_date: todayStr(),
      end_condition: 'count',
      end_count: 12,
      is_active: true,
    })
    .select()
    .single()
  log(`  ✓ 林教練 rule: 每週二 14:00-15:00 網球進階班 共 12 次 (rule id: ${linRule.id})`)

  log('\n─── Creating unavailable events (S3) ───')

  // 林：下下週四 14-15 看醫生 (將剛好撞 rule 的一個 occurrence — cron 應跳過)
  const linEvtDate = todayStr(((4 - new Date().getDay()) + 14) % 7 + 7)
  await createUnavailableEvent({
    memberId: lin.member.id,
    startAt: localIso(linEvtDate, '14:00'),
    endAt: localIso(linEvtDate, '15:00'),
    reason: '看醫生',
  })
  log(`  ✓ 林教練 event: ${linEvtDate} 14-15 看醫生`)

  // 林：建立一個故意撞 既有 slot 的 event (demo collision)
  const collisionEvtDate = todayStr(5)
  await createUnavailableEvent({
    memberId: lin.member.id,
    startAt: localIso(collisionEvtDate, '10:00'),
    endAt: localIso(collisionEvtDate, '11:00'),
    reason: 'Demo collision（會跟既有 slot 重疊，看 ⚠ 徽章）',
  })
  log(`  ✓ 林教練 event: ${collisionEvtDate} 10-11 故意撞 (demo collision)`)

  log('\n=== ✅ Seed complete ===\n')
  log('Accounts:')
  log(`  Platform admin: terry@gmail.com (existing)`)
  log(`  Coaches:`)
  log(
    `    王教練  ${TEST_PREFIX}coach-wang@example.com  ${PASSWORD}  (slug: ${TEST_PREFIX}wang-coach)`,
  )
  log(
    `    陳教練  ${TEST_PREFIX}coach-chen@example.com  ${PASSWORD}  (slug: ${TEST_PREFIX}chen-coach)`,
  )
  log(
    `    林教練  ${TEST_PREFIX}coach-lin@example.com   ${PASSWORD}  (slug: ${TEST_PREFIX}lin-coach)`,
  )
  log(`  Staff:`)
  log(`    阿明助教 ${TEST_PREFIX}staff-ming@example.com  ${PASSWORD}  (under 林教練)`)
  log(`  Students:`)
  log(`    小明  ${TEST_PREFIX}student-ming@example.com  ${PASSWORD}`)
  log(`    小華  ${TEST_PREFIX}student-hua@example.com   ${PASSWORD}`)
  log(`    小美  ${TEST_PREFIX}student-mei@example.com   ${PASSWORD}`)
}

main().catch((e) => {
  console.error('UNCAUGHT:', e)
  process.exit(1)
})
