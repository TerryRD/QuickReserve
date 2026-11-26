// 預約流程改版 v2 / P1 整合測試共用骨架（任務 9）
//
// 每個測試檔呼叫 setupBfv2(label) 建立一個獨立的測試租戶與使用者，
// afterAll 呼叫 teardownBfv2(ctx)：先刪平台管理員列，再刪租戶（連帶刪掉時段、預約、購買、歷程、明細），最後刪使用者。
// 只會讀寫這裡建立的資料，不碰任何既有租戶、使用者或預約。
import WebSocket from 'ws'
if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket
}

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const PW = 'TestPass123!'

const clientOpts = { auth: { persistSession: false, autoRefreshToken: false } }

export const admin: SupabaseClient<Database> = createClient<Database>(URL, SERVICE, clientOpts)

type Member = { userId: string; memberId: string; client: SupabaseClient<Database> }
type User = { userId: string; client: SupabaseClient<Database> }

export type Bfv2Ctx = {
  /** 這次執行的時間戳，所有 slug／email 都帶著它 */
  ts: number
  label: string
  tenantId: string
  tenantSlug: string
  owner: Member
  staffA: Member
  staffB: Member
  customer: User
  otherCustomer: User
  platformAdmin: User
  soloServiceId: string // max_capacity 1、min_attendance 1、cancel_deadline_hours 24
  groupServiceId: string // max_capacity 3、min_attendance 2、cancel_deadline_hours 24
  otherServiceId: string // 同租戶另一個服務，測 SERVICE_MISMATCH 用
  /** 這個測試檔建立的所有使用者（teardown 逐一刪除） */
  userIds: string[]
  /** 這個測試檔額外建立的租戶（例如「另一個租戶」），teardown 一併刪除 */
  extraTenantIds: string[]
}

/**
 * 取得一個以該使用者身分登入的 client（走 anon key，受 RLS 約束）。
 * 不用 signInWithPassword：整合測試全量執行時，密碼登入會撞到 Supabase Auth 每個 IP 的登入次數上限
 * （over_request_rate_limit）。改由 service role 產生一次性登入連結的 token，再用 verifyOtp 換成 session，
 * 得到的仍是一般登入者的 JWT（role＝authenticated），不會寄出任何信件。
 */
export async function signedInClient(email: string): Promise<SupabaseClient<Database>> {
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (error) throw new Error(`generateLink ${email}: ${error.message}`)
  const c = createClient<Database>(URL, ANON, clientOpts)
  const { data: v, error: vErr } = await c.auth.verifyOtp({
    token_hash: data.properties.hashed_token,
    type: 'magiclink',
  })
  if (vErr) throw new Error(`verifyOtp ${email}: ${vErr.message}`)
  if (v.user?.email !== email) throw new Error(`verifyOtp ${email}: 登入身分不符`)
  return c
}

/** 建立一個測試使用者並登入；email 帶 label 與時間戳 */
export async function makeUser(ctx: Pick<Bfv2Ctx, 'ts' | 'label' | 'userIds'>, role: string) {
  const email = `${role}-bfv2-${ctx.label}-${ctx.ts}@example.com`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PW,
    email_confirm: true,
  })
  if (error) throw new Error(`createUser ${email}: ${error.message}`)
  const userId = data.user!.id
  ctx.userIds.push(userId)
  return { userId, email }
}

/** 建立一位學員（auth 使用者＋customers 列）並登入 */
export async function makeCustomer(
  ctx: Pick<Bfv2Ctx, 'ts' | 'label' | 'userIds'>,
  role: string,
): Promise<User> {
  const { userId, email } = await makeUser(ctx, role)
  const { error } = await admin.from('customers').insert({ id: userId, display_name: role })
  if (error) throw new Error(`customers ${role}: ${error.message}`)
  return { userId, client: await signedInClient(email) }
}

async function makeMember(
  ctx: Pick<Bfv2Ctx, 'ts' | 'label' | 'userIds'>,
  tenantId: string,
  role: 'owner' | 'staff',
  name: string,
): Promise<Member> {
  const { userId, email } = await makeUser(ctx, name)
  const { data, error } = await admin
    .from('tenant_members')
    .insert({ tenant_id: tenantId, user_id: userId, role, status: 'active' })
    .select('id')
    .single()
  if (error) throw new Error(`tenant_members ${name}: ${error.message}`)
  return { userId, memberId: data.id, client: await signedInClient(email) }
}

export async function makeTenant(ctx: Pick<Bfv2Ctx, 'ts' | 'label'>, suffix = '') {
  const slug = `bfv2-${ctx.label}${suffix}-${ctx.ts}`
  const { data, error } = await admin
    .from('tenants')
    .insert({ slug, name: `BFV2 ${ctx.label}${suffix}` })
    .select('id')
    .single()
  if (error) throw new Error(`tenants ${slug}: ${error.message}`)
  return { tenantId: data.id, slug }
}

/** 在指定租戶建立一位 Owner（給「另一個租戶」用） */
export async function makeOwnerOfNewTenant(ctx: Bfv2Ctx, suffix: string) {
  const { tenantId } = await makeTenant(ctx, suffix)
  ctx.extraTenantIds.push(tenantId)
  const owner = await makeMember(ctx, tenantId, 'owner', `owner${suffix}`)
  return { tenantId, owner }
}

export async function makeService(
  ctx: Pick<Bfv2Ctx, 'tenantId'>,
  o: { name: string; maxCapacity: number; minAttendance: number; cancelDeadlineHours: number },
) {
  const { data, error } = await admin
    .from('services')
    .insert({
      tenant_id: ctx.tenantId,
      name: o.name,
      duration_minutes: 60,
      max_capacity: o.maxCapacity,
      min_attendance: o.minAttendance,
      cancel_deadline_hours: o.cancelDeadlineHours,
    })
    .select('id')
    .single()
  if (error) throw new Error(`services ${o.name}: ${error.message}`)
  return data.id
}

export async function setupBfv2(label: string): Promise<Bfv2Ctx> {
  const base = { ts: Date.now(), label, userIds: [] as string[], extraTenantIds: [] as string[] }
  const { tenantId, slug } = await makeTenant(base)
  const partial = { ...base, tenantId, tenantSlug: slug }
  try {
    return await setupInTenant(partial)
  } catch (e) {
    // 建到一半失敗：把已建立的租戶與使用者清掉再丟出原錯誤
    await admin.from('tenants').delete().eq('id', tenantId)
    for (const id of partial.userIds) await admin.auth.admin.deleteUser(id)
    throw e
  }
}

async function setupInTenant(
  partial: Pick<Bfv2Ctx, 'ts' | 'label' | 'userIds' | 'extraTenantIds' | 'tenantId' | 'tenantSlug'>,
): Promise<Bfv2Ctx> {
  const { tenantId } = partial

  const owner = await makeMember(partial, tenantId, 'owner', 'owner')
  const staffA = await makeMember(partial, tenantId, 'staff', 'staffa')
  const staffB = await makeMember(partial, tenantId, 'staff', 'staffb')
  const customer = await makeCustomer(partial, 'cust')
  const otherCustomer = await makeCustomer(partial, 'othercust')

  const { userId: paId, email: paEmail } = await makeUser(partial, 'padmin')
  const { error: paErr } = await admin.from('platform_admins').insert({ user_id: paId })
  if (paErr) throw new Error(`platform_admins: ${paErr.message}`)
  const platformAdmin = { userId: paId, client: await signedInClient(paEmail) }

  const soloServiceId = await makeService(partial, {
    name: 'Solo',
    maxCapacity: 1,
    minAttendance: 1,
    cancelDeadlineHours: 24,
  })
  const groupServiceId = await makeService(partial, {
    name: 'Group',
    maxCapacity: 3,
    minAttendance: 2,
    cancelDeadlineHours: 24,
  })
  const otherServiceId = await makeService(partial, {
    name: 'Other',
    maxCapacity: 1,
    minAttendance: 1,
    cancelDeadlineHours: 24,
  })

  return {
    ...partial,
    owner,
    staffA,
    staffB,
    customer,
    otherCustomer,
    platformAdmin,
    soloServiceId,
    groupServiceId,
    otherServiceId,
  }
}

export async function teardownBfv2(ctx: Bfv2Ctx | undefined): Promise<void> {
  if (!ctx) return
  const errors: string[] = []
  const { error: paErr } = await admin
    .from('platform_admins')
    .delete()
    .eq('user_id', ctx.platformAdmin.userId)
  if (paErr) errors.push(`platform_admins: ${paErr.message}`)
  for (const id of [ctx.tenantId, ...ctx.extraTenantIds]) {
    const { error } = await admin.from('tenants').delete().eq('id', id)
    if (error) errors.push(`tenants ${id}: ${error.message}`)
  }
  for (const id of ctx.userIds) {
    const { error } = await admin.auth.admin.deleteUser(id)
    if (error) errors.push(`deleteUser ${id}: ${error.message}`)
  }
  if (errors.length) throw new Error(`teardownBfv2 失敗：\n${errors.join('\n')}`)
}

// ---------------------------------------------------------------------------
// 時段開始時間（時段長 60 分鐘），用遞增序號錯開，同一檔案內不會重疊（availability_slots_no_overlap）：
//   uniqueOffset(base)：遠期用，每次多 90 分鐘，偏移會一路變大。
//   nearOffset()：距開課 12 小時起算、每次多 61 分鐘，給「已過 24 小時取消期限但尚未開課」用；
//                 一個檔案最多呼叫 10 次（仍在 12～21 小時內），超過就丟錯，避免偏移超過 24 小時讓測試失去意義。
// 兩者的範圍不會互相重疊（遠期一律從 7 天後起算）。
// ---------------------------------------------------------------------------
let slotSeq = 0
/** 回傳「距現在 baseMin 分鐘起」且與本檔其他時段不重疊的開始分鐘數 */
export function uniqueOffset(baseMin: number): number {
  return baseMin + slotSeq++ * 90
}

let nearSeq = 0
/** 回傳距現在 12～21 小時之間、與本檔其他時段不重疊的開始分鐘數 */
export function nearOffset(): number {
  if (nearSeq >= 10) throw new Error('nearOffset 用完了（每個檔案最多 10 次）')
  return 12 * 60 + nearSeq++ * 61
}

const MIN = 60_000

function slotWindow(startOffsetMin: number) {
  const start = Date.now() + startOffsetMin * MIN
  return {
    start_at: new Date(start).toISOString(),
    end_at: new Date(start + 60 * MIN).toISOString(),
  }
}

/** 建立時段；startOffsetMin 為距離現在的分鐘數（可為負，直接用 service role 寫入） */
export async function makeSlot(
  ctx: Bfv2Ctx,
  o: { memberId: string; serviceId: string; startOffsetMin: number },
): Promise<string> {
  const { data, error } = await admin
    .from('availability_slots')
    .insert({
      tenant_id: ctx.tenantId,
      member_id: o.memberId,
      service_id: o.serviceId,
      ...slotWindow(o.startOffsetMin),
    })
    .select('id')
    .single()
  if (error) throw new Error(`makeSlot: ${error.message}`)
  return data.id
}

/** 把時段搬到距現在 startOffsetMin 分鐘（長度 60 分鐘），回傳新的開始時間 */
export async function moveSlot(slotId: string, startOffsetMin: number): Promise<Date> {
  const w = slotWindow(startOffsetMin)
  const { error } = await admin.from('availability_slots').update(w).eq('id', slotId)
  if (error) throw new Error(`moveSlot: ${error.message}`)
  return new Date(w.start_at)
}

/** 直接改預約上存的取消期限（模擬「已過期限」的狀態） */
export async function setBookingDeadline(bookingId: string, at: Date): Promise<void> {
  const { error } = await admin
    .from('bookings')
    .update({ cancel_deadline_at: at.toISOString() })
    .eq('id', bookingId)
  if (error) throw new Error(`setBookingDeadline: ${error.message}`)
}

/** 建立一筆已核准、classes_used 為 0 的購買 */
export async function makePurchase(
  ctx: Bfv2Ctx,
  o: { customerId: string; serviceId: string; total?: number },
): Promise<string> {
  const { data, error } = await admin
    .from('customer_purchases')
    .insert({
      tenant_id: ctx.tenantId,
      customer_id: o.customerId,
      service_id: o.serviceId,
      classes_total: o.total ?? 10,
      classes_used: 0,
      approval_status: 'confirmed',
      approved_at: new Date().toISOString(),
      payment_self_reported: 'claimed_paid',
    })
    .select('id')
    .single()
  if (error) throw new Error(`makePurchase: ${error.message}`)
  return data.id
}

/** 用學員自己登入的 client 透過 book_with_purchase 預約，回傳預約 id */
export async function book(
  client: SupabaseClient<Database>,
  o: { slotId: string; customerId: string; purchaseId?: string },
): Promise<{ bookingId: string; autoConfirmed: boolean }> {
  const { data, error } = await client.rpc('book_with_purchase', {
    p_slot_id: o.slotId,
    p_customer_id: o.customerId,
    ...(o.purchaseId ? { p_purchase_id: o.purchaseId } : {}),
  })
  if (error) throw new Error(`book_with_purchase: ${error.message}`)
  const row = (data as Array<{ booking_id: string; auto_confirmed: boolean }>)[0]!
  return { bookingId: row.booking_id, autoConfirmed: row.auto_confirmed }
}

export async function getBooking(bookingId: string) {
  const { data, error } = await admin.from('bookings').select('*').eq('id', bookingId).single()
  if (error) throw new Error(`getBooking: ${error.message}`)
  return data
}

export async function ledgerRows(purchaseId: string) {
  const { data, error } = await admin
    .from('class_ledger')
    .select('*')
    .eq('purchase_id', purchaseId)
    .order('created_at')
  if (error) throw new Error(`ledgerRows: ${error.message}`)
  return data
}

export async function ledgerSum(purchaseId: string): Promise<number> {
  return (await ledgerRows(purchaseId)).reduce((s, r) => s + r.delta, 0)
}

export async function usedCount(purchaseId: string): Promise<number> {
  const { data, error } = await admin
    .from('customer_purchases')
    .select('classes_used')
    .eq('id', purchaseId)
    .single()
  if (error) throw new Error(`usedCount: ${error.message}`)
  return data.classes_used
}

export type ActivityRow = {
  id: string
  event: string
  actor_role: string
  actor_user_id: string | null
  reason: string | null
  subject_type: string
  created_at: string
  detail: Record<string, unknown>
}

export async function activityFor(bookingId: string): Promise<ActivityRow[]> {
  const { data, error } = await admin
    .from('activity_log')
    .select('id, event, actor_role, actor_user_id, reason, subject_type, created_at, detail')
    .eq('booking_id', bookingId)
    .order('created_at')
  if (error) throw new Error(`activityFor: ${error.message}`)
  return data.map((r) => ({ ...r, detail: (r.detail ?? {}) as Record<string, unknown> }))
}
