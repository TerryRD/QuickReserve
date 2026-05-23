import ws from 'ws'
globalThis.WebSocket = ws
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const PROD_URL = 'https://quick-reserve-mu.vercel.app'

const admin = createClient(SUPABASE_URL, SERVICE_KEY)
const log = (...a) => console.log(...a)
const fail = (msg) => {
  console.error('FAIL:', msg)
  process.exit(1)
}

async function main() {
  log('\n─── Step 1: Smoke-test public routes ───')
  const routes = [
    { path: '/', expect: [200] },
    { path: '/login', expect: [200] },
    { path: '/signup', expect: [200] },
    { path: '/non-existent-tenant', expect: [200, 404] },
    { path: '/platform/dashboard', expect: [307] },
    { path: '/dashboard', expect: [307] },
    { path: '/calendar', expect: [307] },
    { path: '/services', expect: [307] },
    { path: '/bookings', expect: [307] },
    { path: '/staff', expect: [307] },
    { path: '/my-bookings', expect: [307] },
    { path: '/settings/notifications', expect: [307] },
  ]
  for (const r of routes) {
    const res = await fetch(`${PROD_URL}${r.path}`, { redirect: 'manual' })
    const ok = r.expect.includes(res.status)
    log(
      `  ${ok ? '✓' : '✗'} ${r.path} → ${res.status}${ok ? '' : ` (expected ${r.expect.join('/')})`}`,
    )
    if (!ok) fail(`route ${r.path} returned ${res.status}`)
  }

  log('\n─── Step 2: Login as platform admin via Supabase Auth ───')
  const userClient = createClient(SUPABASE_URL, ANON_KEY)
  const { data: signIn, error: signInErr } = await userClient.auth.signInWithPassword({
    email: 'terry@gmail.com',
    password: 'Nx7$kPm9!Lq3vRz2',
  })
  if (signInErr) fail(`Login: ${signInErr.message}`)
  log(`  ✓ Signed in as ${signIn.user.email}`)

  const { data: isAdmin } = await admin
    .from('platform_admins')
    .select('user_id')
    .eq('user_id', signIn.user.id)
    .maybeSingle()
  if (!isAdmin) fail('User is not in platform_admins')
  log(`  ✓ Confirmed platform_admins membership`)

  log('\n─── Step 3: Clean stale E2E test data ───')
  await admin.from('tenants').delete().like('slug', 'e2e-%')
  log('  ✓ Cleaned')

  log('\n─── Step 4: Simulate platform admin inviting a coach ───')
  const ts = Date.now()
  const slug = `e2e-coach-${ts}`
  const { data: tenant, error: tErr } = await admin
    .from('tenants')
    .insert({ slug, name: 'E2E Test Coach', status: 'active' })
    .select()
    .single()
  if (tErr) fail(`Tenant insert: ${tErr.message}`)
  log(`  ✓ Tenant created: ${tenant.id} (slug=${slug})`)

  const { data: coach, error: coachErr } = await admin.auth.admin.createUser({
    email: `e2e-coach-${ts}@example.com`,
    password: 'TestPass123!',
    email_confirm: true,
  })
  if (coachErr) fail(`Coach user: ${coachErr.message}`)
  await admin.from('customers').upsert({ id: coach.user.id, display_name: 'E2E Coach' })
  const { data: memberInsert, error: memberErr } = await admin
    .from('tenant_members')
    .insert({
      tenant_id: tenant.id,
      user_id: coach.user.id,
      role: 'owner',
      status: 'active',
    })
    .select()
    .single()
  if (memberErr) fail(`tenant_members: ${memberErr.message}`)
  log(`  ✓ Coach owner created: member_id=${memberInsert.id}`)

  log('\n─── Step 5: Coach creates service ───')
  const { data: service, error: svcErr } = await admin
    .from('services')
    .insert({
      tenant_id: tenant.id,
      name: '桌球 1 對 1 課',
      duration_minutes: 60,
      price: 1500,
    })
    .select()
    .single()
  if (svcErr) fail(`Service: ${svcErr.message}`)
  log(`  ✓ Service created: ${service.name} ($${service.price})`)

  log('\n─── Step 6: Coach creates availability slot ───')
  const slotStart = new Date(Date.now() + 24 * 3600 * 1000).toISOString()
  const slotEnd = new Date(Date.now() + 25 * 3600 * 1000).toISOString()
  const { data: slot, error: slotErr } = await admin
    .from('availability_slots')
    .insert({
      tenant_id: tenant.id,
      member_id: memberInsert.id,
      service_id: service.id,
      start_at: slotStart,
      end_at: slotEnd,
    })
    .select()
    .single()
  if (slotErr) fail(`Slot: ${slotErr.message}`)
  log(`  ✓ Slot created: ${slot.id}`)

  log('\n─── Step 7: Customer signs up and books via atomic RPC ───')
  const { data: student } = await admin.auth.admin.createUser({
    email: `e2e-student-${ts}@example.com`,
    password: 'TestPass123!',
    email_confirm: true,
  })
  await admin.from('customers').upsert({ id: student.user.id, display_name: 'E2E Student' })

  const { data: booking, error: bookErr } = await admin.rpc('book_slot_atomic', {
    p_slot_id: slot.id,
    p_customer_id: student.user.id,
    p_customer_notes: 'E2E test booking',
  })
  if (bookErr) fail(`Book: ${bookErr.message}`)
  log(`  ✓ Booking created via book_slot_atomic: ${booking.id}`)

  log('\n─── Step 8: Verify slot locked to pending ───')
  const { data: s1 } = await admin
    .from('availability_slots')
    .select('status')
    .eq('id', slot.id)
    .single()
  if (s1.status !== 'pending') fail(`Expected pending, got ${s1.status}`)
  log(`  ✓ Slot status = pending`)

  log('\n─── Step 9: Verify second customer CANNOT book same slot ───')
  const { data: student2 } = await admin.auth.admin.createUser({
    email: `e2e-student2-${ts}@example.com`,
    password: 'TestPass123!',
    email_confirm: true,
  })
  await admin.from('customers').upsert({ id: student2.user.id, display_name: 'E2E Student 2' })
  const { error: doubleBookErr } = await admin.rpc('book_slot_atomic', {
    p_slot_id: slot.id,
    p_customer_id: student2.user.id,
  })
  if (!doubleBookErr || !doubleBookErr.message.includes('SLOT_UNAVAILABLE'))
    fail(`Expected SLOT_UNAVAILABLE, got ${doubleBookErr?.message ?? 'no error'}`)
  log(`  ✓ Second customer rejected with SLOT_UNAVAILABLE`)

  log('\n─── Step 10: Coach confirms booking (via direct UPDATE for service_role) ───')
  await admin.from('bookings').update({ status: 'confirmed' }).eq('id', booking.id)
  await admin.from('availability_slots').update({ status: 'booked' }).eq('id', slot.id)
  log(`  ✓ Booking confirmed, slot → booked`)

  log('\n─── Step 11: Customer cancels (via RPC) ───')
  // Use customer's JWT context for cancel_booking, which checks auth.uid()
  const studentClient = createClient(SUPABASE_URL, ANON_KEY)
  await studentClient.auth.signInWithPassword({
    email: `e2e-student-${ts}@example.com`,
    password: 'TestPass123!',
  })
  const { error: cancelErr } = await studentClient.rpc('cancel_booking', {
    p_booking_id: booking.id,
  })
  if (cancelErr) fail(`cancel_booking: ${cancelErr.message}`)
  const { data: bAfter } = await admin
    .from('bookings')
    .select('status')
    .eq('id', booking.id)
    .single()
  const { data: sAfter } = await admin
    .from('availability_slots')
    .select('status')
    .eq('id', slot.id)
    .single()
  if (bAfter.status !== 'cancelled') fail(`Expected cancelled, got ${bAfter.status}`)
  if (sAfter.status !== 'available') fail(`Expected available, got ${sAfter.status}`)
  log(`  ✓ Booking cancelled, slot released to available`)

  log('\n─── Step 12: Verify public tenant page renders correctly ───')
  const tenantPageRes = await fetch(`${PROD_URL}/${slug}`)
  const html = await tenantPageRes.text()
  if (tenantPageRes.status !== 200) fail(`Tenant page status ${tenantPageRes.status}`)
  if (!html.includes('E2E Test Coach')) fail('Tenant page missing coach name')
  if (!html.includes('桌球')) fail('Tenant page missing service name')
  log(`  ✓ /${slug} renders correctly (200 + coach name + service)`)

  log('\n─── Step 13: Verify suspended tenant shows "服務暫停中" ───')
  await admin.from('tenants').update({ status: 'suspended' }).eq('id', tenant.id)
  // Cache-bust + no-store
  const suspendedRes = await fetch(`${PROD_URL}/${slug}?_=${Date.now()}`, {
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache' },
  })
  const suspHtml = await suspendedRes.text()
  if (!suspHtml.includes('服務暫停中')) {
    log(
      '  HTML snippet:',
      suspHtml.slice(suspHtml.indexOf('<main'), suspHtml.indexOf('<main') + 400),
    )
    fail('Suspended tenant should show 服務暫停中')
  }
  log(`  ✓ Suspended tenant shows "服務暫停中"`)

  log('\n─── Cleanup ───')
  await admin.from('tenants').delete().eq('id', tenant.id)
  await admin.auth.admin.deleteUser(coach.user.id)
  await admin.auth.admin.deleteUser(student.user.id)
  await admin.auth.admin.deleteUser(student2.user.id)
  log('  ✓ Test data removed')

  log('\n✅ ALL E2E CHECKS PASSED ✅')
}

main().catch((e) => {
  console.error('UNCAUGHT:', e)
  process.exit(1)
})
