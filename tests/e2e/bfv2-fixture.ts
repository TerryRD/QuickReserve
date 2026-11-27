// 預約流程改版 v2 / P1 e2e 專用測試資料。
//
// 用 service role 建立一個獨立的測試租戶（slug 前綴 bfv2e2e-）與 Owner、助教、學員三個帳號
// （email 前綴 bfv2e2e-，密碼同 demo 帳號，可直接用 helpers.ts 的 login 從畫面登入），
// 再透過各角色登入後呼叫資料庫函式，把每個情境需要的預約準備到指定狀態。
// 每個情境用不同名稱的服務，畫面上可用服務名稱找到對應的卡片。
// cleanupBfv2E2e() 刪掉所有 bfv2e2e- 開頭的租戶（連帶時段、預約、購買、歷程、明細）與使用者，
// 只動這裡建立的資料，不碰 demo 帳號或其他既有資料。
import WebSocket from 'ws'
if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket
}

import { config } from 'dotenv'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../src/lib/supabase/types'
import { TEST_PASSWORD } from './helpers'

config({ path: '.env.local', quiet: true })

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!URL || !SERVICE || !ANON) {
  throw new Error('bfv2 e2e：.env.local 缺少 Supabase 連線設定，無法建立測試資料')
}

const clientOpts = { auth: { persistSession: false, autoRefreshToken: false } }
const admin: SupabaseClient<Database> = createClient<Database>(URL, SERVICE, clientOpts)

/** 測試資料的 slug 與 email 前綴 */
export const E2E_PREFIX = 'bfv2e2e-'

const MIN = 60_000
const DAY = 24 * 60 * MIN

/** 每個情境的服務名稱（卡片標題），同時是畫面上找卡片的依據 */
export const SVC = {
  custCancelPreset: 'E2E 學員取消一般原因',
  custCancelOther: 'E2E 學員取消其他原因',
  custCancelled: 'E2E 學員已取消',
  ownerReject: 'E2E 教練拒絕',
  ownerCancel: 'E2E 教練取消',
  ownerSlotPending: 'E2E 教練時段待確認',
  staffSlotPending: 'E2E 助教時段待確認',
} as const

/** 已由學員自己取消（透過資料庫函式）那筆預約的原因 */
export const CUSTOMER_CANCELLED_REASON = '工作：臨時要加班'

export type Bfv2E2e = {
  ts: number
  tenantId: string
  tenantName: string
  owner: { email: string; name: string; userId: string; memberId: string }
  staff: { email: string; name: string; userId: string; memberId: string }
  customer: { email: string; name: string; userId: string }
  /** 情境 → 預約 id */
  bookings: Record<keyof typeof SVC, string>
}

async function signedInClient(email: string): Promise<SupabaseClient<Database>> {
  // 不走密碼登入，避免撞到 Supabase Auth 的登入次數上限（作法同 tests/integration/helpers/bfv2-fixture.ts）
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (error) throw new Error(`generateLink ${email}: ${error.message}`)
  const c = createClient<Database>(URL!, ANON!, clientOpts)
  const { error: vErr } = await c.auth.verifyOtp({
    token_hash: data.properties.hashed_token,
    type: 'magiclink',
  })
  if (vErr) throw new Error(`verifyOtp ${email}: ${vErr.message}`)
  return c
}

async function createUser(email: string, name: string): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: name, display_name: name },
  })
  if (error) throw new Error(`createUser ${email}: ${error.message}`)
  return data.user.id
}

/** 刪掉所有 bfv2e2e- 開頭的租戶與使用者（含先前中斷留下的） */
export async function cleanupBfv2E2e(): Promise<void> {
  const errors: string[] = []
  const { data: tenants, error: tErr } = await admin
    .from('tenants')
    .select('id')
    .like('slug', `${E2E_PREFIX}%`)
  if (tErr) errors.push(`查詢租戶：${tErr.message}`)
  for (const t of tenants ?? []) {
    const { error } = await admin.from('tenants').delete().eq('id', t.id)
    if (error) errors.push(`刪除租戶 ${t.id}：${error.message}`)
  }
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) {
      errors.push(`列出使用者：${error.message}`)
      break
    }
    for (const u of data.users) {
      if (!u.email?.startsWith(E2E_PREFIX)) continue
      const { error: dErr } = await admin.auth.admin.deleteUser(u.id)
      if (dErr) errors.push(`刪除使用者 ${u.email}：${dErr.message}`)
    }
    if (data.users.length < 1000) break
  }
  if (errors.length) throw new Error(`bfv2 e2e 清理失敗：\n${errors.join('\n')}`)
}

/** 剩下多少 bfv2e2e- 的租戶與使用者（驗證清理用） */
export async function countBfv2E2eLeftovers(): Promise<{ tenants: number; users: number }> {
  const { count, error } = await admin
    .from('tenants')
    .select('id', { count: 'exact', head: true })
    .like('slug', `${E2E_PREFIX}%`)
  if (error) throw new Error(`查詢租戶：${error.message}`)
  let users = 0
  for (let page = 1; ; page++) {
    const { data, error: uErr } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (uErr) throw new Error(`列出使用者：${uErr.message}`)
    users += data.users.filter((u) => u.email?.startsWith(E2E_PREFIX)).length
    if (data.users.length < 1000) break
  }
  return { tenants: count ?? 0, users }
}

function check<T>(
  res: { data: T; error: { message: string } | null },
  what: string,
): NonNullable<T> {
  if (res.error) throw new Error(`${what}: ${res.error.message}`)
  if (res.data === null || res.data === undefined) throw new Error(`${what}: 沒有回傳資料`)
  return res.data
}

export async function setupBfv2E2e(): Promise<Bfv2E2e> {
  // 先清掉之前中斷時可能留下的測試資料
  await cleanupBfv2E2e()
  try {
    return await build()
  } catch (e) {
    await cleanupBfv2E2e()
    throw e
  }
}

async function build(): Promise<Bfv2E2e> {
  const ts = Date.now()
  const tenantName = `E2E 預約改版 ${ts}`
  const tenant = check(
    await admin
      .from('tenants')
      .insert({ slug: `${E2E_PREFIX}${ts}`, name: tenantName, status: 'active' })
      .select('id')
      .single(),
    'tenants',
  )

  const ownerEmail = `${E2E_PREFIX}owner-${ts}@example.com`
  const staffEmail = `${E2E_PREFIX}staff-${ts}@example.com`
  const customerEmail = `${E2E_PREFIX}student-${ts}@example.com`
  const ownerName = 'E2E王教練'
  const staffName = 'E2E阿明助教'
  const customerName = 'E2E小明'

  const ownerUserId = await createUser(ownerEmail, ownerName)
  const staffUserId = await createUser(staffEmail, staffName)
  const customerUserId = await createUser(customerEmail, customerName)

  const ownerMember = check(
    await admin
      .from('tenant_members')
      .insert({ tenant_id: tenant.id, user_id: ownerUserId, role: 'owner', status: 'active' })
      .select('id')
      .single(),
    'tenant_members owner',
  )
  const staffMember = check(
    await admin
      .from('tenant_members')
      .insert({ tenant_id: tenant.id, user_id: staffUserId, role: 'staff', status: 'active' })
      .select('id')
      .single(),
    'tenant_members staff',
  )
  const { error: cErr } = await admin
    .from('customers')
    .insert({ id: customerUserId, display_name: customerName })
  if (cErr) throw new Error(`customers: ${cErr.message}`)

  const ownerClient = await signedInClient(ownerEmail)
  const customerClient = await signedInClient(customerEmail)

  // 每個情境一個團班服務（4 人班、2 人開班、24 小時取消期限）：只有 1 人預約時會停在待確認
  let slotIndex = 0
  const prepare = async (
    key: keyof typeof SVC,
    memberId: string,
  ): Promise<{ bookingId: string }> => {
    const service = check(
      await admin
        .from('services')
        .insert({
          tenant_id: tenant.id,
          name: SVC[key],
          duration_minutes: 60,
          max_capacity: 4,
          min_attendance: 2,
          cancel_deadline_hours: 24,
        })
        .select('id')
        .single(),
      `services ${key}`,
    )
    check(
      await admin
        .from('customer_purchases')
        .insert({
          tenant_id: tenant.id,
          customer_id: customerUserId,
          service_id: service.id,
          classes_total: 5,
          classes_used: 0,
          approval_status: 'confirmed',
          approved_at: new Date().toISOString(),
          payment_self_reported: 'claimed_paid',
        })
        .select('id')
        .single(),
      `customer_purchases ${key}`,
    )
    // 7 天後起，每個時段錯開 2 小時，不會互相重疊，也遠在取消期限之前
    const start = Date.now() + 7 * DAY + slotIndex++ * 120 * MIN
    const slot = check(
      await admin
        .from('availability_slots')
        .insert({
          tenant_id: tenant.id,
          member_id: memberId,
          service_id: service.id,
          start_at: new Date(start).toISOString(),
          end_at: new Date(start + 60 * MIN).toISOString(),
        })
        .select('id')
        .single(),
      `availability_slots ${key}`,
    )
    const { data, error } = await customerClient.rpc('book_with_purchase', {
      p_slot_id: slot.id,
      p_customer_id: customerUserId,
    })
    if (error) throw new Error(`book_with_purchase ${key}: ${error.message}`)
    const row = (data as Array<{ booking_id: string; auto_confirmed: boolean }>)[0]
    if (!row || row.auto_confirmed) throw new Error(`book_with_purchase ${key}: 預約應停在待確認`)
    return { bookingId: row.booking_id }
  }

  const confirm = async (bookingId: string) => {
    const { error } = await ownerClient.rpc('confirm_booking', { p_booking_id: bookingId })
    if (error) throw new Error(`confirm_booking: ${error.message}`)
  }

  const bookings = {} as Record<keyof typeof SVC, string>

  // 情境 1：已確認，學員在畫面上取消
  for (const key of ['custCancelPreset', 'custCancelOther'] as const) {
    const { bookingId } = await prepare(key, ownerMember.id)
    await confirm(bookingId)
    bookings[key] = bookingId
  }

  // 情境 2、4：建立 → 教練確認 → 學員自己取消（走資料庫函式）
  {
    const { bookingId } = await prepare('custCancelled', ownerMember.id)
    await confirm(bookingId)
    const { error } = await customerClient.rpc('cancel_booking', {
      p_booking_id: bookingId,
      p_reason: CUSTOMER_CANCELLED_REASON,
    })
    if (error) throw new Error(`cancel_booking custCancelled: ${error.message}`)
    bookings.custCancelled = bookingId
  }

  // 情境 3：待確認（教練拒絕）、已確認（教練取消）
  bookings.ownerReject = (await prepare('ownerReject', ownerMember.id)).bookingId
  {
    const { bookingId } = await prepare('ownerCancel', ownerMember.id)
    await confirm(bookingId)
    bookings.ownerCancel = bookingId
  }

  // 情境 5：Owner 時段的待確認預約（助教不能操作）、助教自己時段的待確認預約（助教可以操作）
  bookings.ownerSlotPending = (await prepare('ownerSlotPending', ownerMember.id)).bookingId
  bookings.staffSlotPending = (await prepare('staffSlotPending', staffMember.id)).bookingId

  return {
    ts,
    tenantId: tenant.id,
    tenantName,
    owner: { email: ownerEmail, name: ownerName, userId: ownerUserId, memberId: ownerMember.id },
    staff: { email: staffEmail, name: staffName, userId: staffUserId, memberId: staffMember.id },
    customer: { email: customerEmail, name: customerName, userId: customerUserId },
    bookings,
  }
}

/** 教練的聯絡方式（tenants 的四個聯絡欄位） */
export type TenantContact = {
  contact_line_id: string | null
  contact_phone: string | null
  contact_email: string | null
  contact_note: string | null
}

/** 直接改測試租戶的聯絡方式（驗證學員端「聯絡教練」段落用；測試結束要自行還原成 null） */
export async function setTenantContact(tenantId: string, contact: TenantContact): Promise<void> {
  check(
    await admin.from('tenants').update(contact).eq('id', tenantId).select('id').single(),
    'tenants contact',
  )
}

/** 直接讀資料庫的預約狀態（驗證畫面操作真的寫進資料庫） */
export async function readBooking(bookingId: string) {
  return check(
    await admin
      .from('bookings')
      .select('status, cancel_category, cancel_reason, cancel_actor_role, class_disposition')
      .eq('id', bookingId)
      .single(),
    'bookings',
  )
}

// ---------------------------------------------------------------------------
// 站內通知 e2e（tests/e2e/in-app-notifications.spec.ts）用的資料準備
// ---------------------------------------------------------------------------

/** 測試租戶的 slug（建立時為 E2E_PREFIX + ts） */
export function tenantSlugOf(ctx: Pick<Bfv2E2e, 'ts'>): string {
  return `${E2E_PREFIX}${ctx.ts}`
}

/** 在測試租戶建立一個服務與一個上架中的 N 堂課方案（學員在公開頁送出購買申請用），回傳方案名稱 */
export async function createServicePackage(
  tenantId: string,
  o: { serviceName: string; packageName: string; classCount: number; price: number },
): Promise<string> {
  const service = check(
    await admin
      .from('services')
      .insert({
        tenant_id: tenantId,
        name: o.serviceName,
        duration_minutes: 60,
        max_capacity: 1,
        min_attendance: 1,
        cancel_deadline_hours: 24,
      })
      .select('id')
      .single(),
    `services ${o.serviceName}`,
  )
  check(
    await admin
      .from('service_packages')
      .insert({
        tenant_id: tenantId,
        service_id: service.id,
        name: o.packageName,
        class_count: o.classCount,
        price: o.price,
      })
      .select('id')
      .single(),
    `service_packages ${o.packageName}`,
  )
  return o.packageName
}

/** 以後端身分（service role）直接寫入一則站內通知給指定使用者 */
export async function insertInAppNotification(
  userId: string,
  o: { title: string; body: string; url: string | null },
): Promise<void> {
  check(
    await admin
      .from('notification_log')
      .insert({
        user_id: userId,
        type: 'booking_confirmed',
        channel: 'in_app',
        status: 'skipped',
        title: o.title,
        body: o.body,
        url: o.url,
      })
      .select('id')
      .single(),
    'notification_log',
  )
}
