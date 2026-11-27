import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { pushToUser } from '@/lib/push'
import { previewReason } from '@/lib/booking-terms'
import { formatTaipeiDateTime } from '@/lib/taipei-time'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

export type BookingEvent = 'created' | 'confirmed' | 'cancelled'

export type NoticeCopy = { title: string; body: string }

export type CancelNoticeInput = {
  tenantName: string | null
  customerName: string | null
  serviceName: string | null
  /** 已換算成顯示用的上課時間 */
  startAt: string
  /** bookings.cancel_category */
  category: string | null
  /** bookings.cancel_reason */
  reason: string | null
  /** bookings.class_disposition */
  disposition: string | null
  /** bookings.cancel_actor_role */
  actorRole: string | null
}

export type CancelNotice = {
  /** 給學員 */
  toCustomer?: NoticeCopy
  /** 給時段負責成員 */
  toCoach?: NoticeCopy
  /** 給租戶所有 Owner（助教操作時，§12） */
  toOwners?: NoticeCopy
}

/** 推播內文的原因句；過長時截斷（與教練端清單摘要同長度），完整原因在明細頁看 */
function reasonSentence(reason: string | null): string {
  const r = previewReason(reason)
  return r ? `原因：${r}。` : ''
}

/** 教練取消／拒絕時給學員的堂數結果句 */
function coachDispositionSentence(disposition: string | null): string {
  switch (disposition) {
    case 'refunded':
      return '已退回 1 堂。'
    case 'forfeited':
      return '不退回。'
    case 'transferred':
      return '已轉到新預約。'
    default:
      return ''
  }
}

/** 購買申請被拒絕時給學員的內文；沒有原因時不加冒號那段 */
export function purchaseRejectedBody(tenantName: string | null, reason: string | null): string {
  const r = reason?.trim()
  return `${tenantName ?? '教練'} 已拒絕您的購買申請${r ? `：${r}` : ''}`
}

/**
 * 組出取消（含改期）通知的標題與內文。純函式，不查資料庫。
 * 學員收到的一律稱「教練」（或租戶名稱），不出現 Owner／助教。
 */
export function buildCancelNotice(input: CancelNoticeInput): CancelNotice {
  const customer = input.customerName ?? '學員'
  const coach = input.tenantName ?? '教練'

  if (input.category === 'rescheduled') {
    return {
      toCoach: {
        title: '預約已改期',
        body: `${customer} 將預約改期（原時間 ${input.startAt}）`,
      },
    }
  }

  if (input.actorRole === 'customer') {
    return {
      toCoach: {
        title: '預約已取消',
        body:
          `${customer} 取消了預約（${input.startAt}）。${reasonSentence(input.reason)}` +
          (input.disposition === 'forfeited'
            ? '已過取消期限，不退回。'
            : input.disposition === 'refunded'
              ? '已退回 1 堂。'
              : ''),
      },
    }
  }

  if (input.actorRole === 'owner' || input.actorRole === 'staff') {
    const rejected = input.category === 'coach_rejected'
    const notice: CancelNotice = {
      toCustomer: {
        title: rejected ? '預約未被接受' : '預約已取消',
        body:
          `${coach} ${rejected ? '未接受您的預約' : '取消了您的預約'}（${input.startAt}）。` +
          reasonSentence(input.reason) +
          coachDispositionSentence(input.disposition),
      },
    }
    if (input.actorRole === 'staff') {
      notice.toOwners = {
        title: rejected ? '助教拒絕了預約' : '助教取消了預約',
        body: `${customer} 的 ${input.serviceName ?? ''}（${input.startAt}）。${reasonSentence(input.reason)}`,
      }
    }
    return notice
  }

  // 系統取消（人數不足）由 notifyGroupAutoCancel 通知
  return {}
}

/**
 * Fire-and-forget push notifications for booking lifecycle events.
 * Uses admin client so it can read other users' subscriptions and write logs.
 *
 * Failures are logged but never thrown — booking actions must succeed even
 * if notifications fail.
 */
export async function notifyBookingChange(
  bookingId: string,
  event: BookingEvent,
  _triggeredByUserId: string,
): Promise<void> {
  try {
    const admin = createSupabaseAdminClient()
    const { data: booking, error } = await admin
      .from('bookings')
      .select(
        'id, tenant_id, customer_id, cancel_category, cancel_reason, class_disposition, cancel_actor_role, customers(display_name), services(name), availability_slots(start_at, tenant_members(user_id)), tenants(name, slug)',
      )
      .eq('id', bookingId)
      .maybeSingle()
    if (error) {
      console.error('[notify-booking] 讀取預約失敗', error)
      return
    }
    if (!booking) return

    const customer = booking.customers as { display_name: string | null } | null
    const service = booking.services as { name: string } | null
    const slot = booking.availability_slots as {
      start_at: string
      tenant_members: { user_id: string | null } | null
    } | null
    const tenant = booking.tenants as { name: string; slug: string } | null

    const customerUserId = booking.customer_id
    const memberUserId = slot?.tenant_members?.user_id ?? null
    const startAt = slot?.start_at ? formatTaipeiDateTime(slot.start_at, { withYear: true }) : ''

    if (event === 'created' && memberUserId) {
      await pushToUser(admin, {
        userId: memberUserId,
        type: 'booking_status',
        payload: {
          title: '新預約申請',
          body: `${customer?.display_name ?? '學員'} 申請 ${service?.name ?? '服務'} (${startAt})`,
          url: '/bookings?status=pending',
          tag: `booking-${bookingId}`,
        },
        relatedId: bookingId,
      })
    } else if (event === 'confirmed' && customerUserId) {
      await pushToUser(admin, {
        userId: customerUserId,
        type: 'booking_status',
        payload: {
          title: '預約已確認',
          body: `${tenant?.name ?? ''} 確認您的 ${service?.name ?? ''} (${startAt})`,
          url: '/my-bookings',
          tag: `booking-${bookingId}`,
        },
        relatedId: bookingId,
      })
    } else if (event === 'cancelled') {
      if (!booking.cancel_actor_role) {
        console.error('[notify-booking] 取消的預約沒有取消紀錄，無法決定通知對象', bookingId)
        return
      }
      const notice = buildCancelNotice({
        tenantName: tenant?.name ?? null,
        customerName: customer?.display_name ?? null,
        serviceName: service?.name ?? null,
        startAt,
        category: booking.cancel_category,
        reason: booking.cancel_reason,
        disposition: booking.class_disposition,
        actorRole: booking.cancel_actor_role,
      })

      if (notice.toCustomer && customerUserId) {
        await pushToUser(admin, {
          userId: customerUserId,
          type: 'booking_status',
          payload: {
            ...notice.toCustomer,
            url: `/my-bookings/${bookingId}`,
            tag: `booking-${bookingId}`,
          },
          relatedId: bookingId,
        })
      }
      if (notice.toCoach && memberUserId) {
        await pushToUser(admin, {
          userId: memberUserId,
          type: 'booking_status',
          payload: {
            ...notice.toCoach,
            url: `/bookings/${bookingId}`,
            tag: `booking-${bookingId}`,
          },
          relatedId: bookingId,
        })
      }
      if (notice.toOwners) {
        const { data: owners, error: ownersErr } = await admin
          .from('tenant_members')
          .select('user_id')
          .eq('tenant_id', booking.tenant_id)
          .eq('role', 'owner')
          .eq('status', 'active')
        if (ownersErr) console.error('[notify-booking] 讀取 Owner 失敗', ownersErr)
        for (const owner of owners ?? []) {
          if (!owner.user_id) continue
          await pushToUser(admin, {
            userId: owner.user_id,
            type: 'booking_status',
            payload: {
              ...notice.toOwners,
              url: `/bookings/${bookingId}`,
              tag: `booking-${bookingId}-owner`,
            },
            relatedId: bookingId,
          })
        }
      }
    }
  } catch (err) {
    console.error('[notify-booking]', err)
  }
}

export async function notifyPurchaseDecision(
  purchaseId: string,
  decision: 'approved' | 'rejected',
  _triggeredByUserId: string,
): Promise<void> {
  try {
    const admin = createSupabaseAdminClient()
    const { data: p } = await admin
      .from('customer_purchases')
      .select(
        'id, customer_id, classes_total, rejected_reason, services(name), service_packages(name), tenants(name, slug)',
      )
      .eq('id', purchaseId)
      .maybeSingle()
    if (!p) return

    const svc = p.services as { name: string } | null
    const pkg = p.service_packages as { name: string } | null
    const tenant = p.tenants as { name: string; slug: string } | null
    const title = decision === 'approved' ? '購買已核准' : '購買申請已拒絕'
    const body =
      decision === 'approved'
        ? `${tenant?.name ?? '教練'} 已核准您購買的 ${pkg?.name ?? svc?.name ?? ''} ${p.classes_total} 堂課，可以開始預約了`
        : purchaseRejectedBody(tenant?.name ?? null, p.rejected_reason)

    await pushToUser(admin, {
      userId: p.customer_id,
      type: 'booking_status',
      payload: {
        title,
        body,
        url:
          decision === 'approved'
            ? '/my-bookings'
            : tenant?.slug
              ? `/${tenant.slug}/purchases`
              : '/my-bookings',
        tag: `purchase-${purchaseId}`,
      },
      relatedId: purchaseId,
    })
  } catch (err) {
    console.error('[notify-purchase]', err)
  }
}

/** 學員送出購買申請時自報的付款狀態（customer_purchases.payment_self_reported）→ 通知內文用語 */
const PAYMENT_SELF_REPORTED_LABEL: Record<string, string> = {
  claimed_paid: '我已轉帳',
  partial_paid: '已部分付款',
  awaiting_payment: '尚未付款',
}

export type PurchaseRequestNoticeInput = {
  customerName: string | null
  productName: string | null
  classCount: number
  /** customer_purchases.payment_self_reported */
  paymentSelfReported: string
}

/** 學員送出購買申請時，給教練端的通知標題與內文。純函式，不查資料庫。 */
export function buildPurchaseRequestNotice(input: PurchaseRequestNoticeInput): NoticeCopy {
  const customer = input.customerName?.trim() || '學員'
  const product = input.productName?.trim() || '課程'
  const payment = PAYMENT_SELF_REPORTED_LABEL[input.paymentSelfReported]
  return {
    title: '新的購買申請',
    body:
      `${customer} 申請購買 ${product}（${input.classCount} 堂課）。` +
      (payment ? `付款申報：${payment}` : ''),
  }
}

/**
 * 誰可以審購買申請：這個租戶所有在職成員（Owner 與助教），排除還沒綁帳號的。
 * 查詢失敗會 throw——不可回空陣列冒充「沒有人要通知」。
 * 第 3 階段會收緊成只有 Owner，到時只改這一支。
 */
export async function purchaseReviewerUserIds(
  admin: SupabaseClient<Database>,
  tenantId: string,
): Promise<string[]> {
  const { data, error } = await admin
    .from('tenant_members')
    .select('user_id')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
  if (error || !data) {
    throw new Error(`查詢可審核購買申請的成員失敗：${error?.message ?? '沒有回傳資料'}`)
  }
  return data.flatMap((m) => (m.user_id ? [m.user_id] : []))
}

/**
 * 學員送出購買申請後，通知可以審核的教練端成員。
 * 失敗只記 log，絕不往外丟——購買申請本身必須成功。
 */
export async function notifyPurchaseRequested(purchaseId: string): Promise<void> {
  try {
    const admin = createSupabaseAdminClient()
    const { data: p, error } = await admin
      .from('customer_purchases')
      .select(
        'id, tenant_id, customer_id, classes_total, payment_self_reported, customers(display_name), services(name), service_packages(name)',
      )
      .eq('id', purchaseId)
      .maybeSingle()
    if (error || !p) {
      console.error('[notify-purchase-request] 查詢購買申請失敗，未發通知', purchaseId, error)
      return
    }

    let reviewers: string[]
    try {
      reviewers = await purchaseReviewerUserIds(admin, p.tenant_id)
    } catch (err) {
      console.error('[notify-purchase-request] 查詢審核者失敗，未發通知', purchaseId, err)
      return
    }

    const customer = p.customers as { display_name: string | null } | null
    const svc = p.services as { name: string } | null
    const pkg = p.service_packages as { name: string } | null
    const notice = buildPurchaseRequestNotice({
      customerName: customer?.display_name ?? null,
      productName: pkg?.name ?? svc?.name ?? null,
      classCount: p.classes_total,
      paymentSelfReported: p.payment_self_reported,
    })

    for (const userId of reviewers) {
      if (userId === p.customer_id) continue
      await pushToUser(admin, {
        userId,
        type: 'package_request',
        payload: {
          ...notice,
          url: '/packages/pending',
          tag: `purchase-request-${purchaseId}`,
        },
        relatedId: purchaseId,
      })
    }
  } catch (err) {
    console.error('[notify-purchase-request]', err)
  }
}

export async function notifyGroupAutoConfirm(slotId: string): Promise<void> {
  try {
    const admin = createSupabaseAdminClient()
    const { data: bookings } = await admin
      .from('bookings')
      .select('id, customer_id, services(name), availability_slots(start_at), tenants(name)')
      .eq('slot_id', slotId)
      .eq('status', 'confirmed')
    if (!bookings) return

    for (const b of bookings) {
      const svc = b.services as { name: string } | null
      const slot = b.availability_slots as { start_at: string } | null
      const tenant = b.tenants as { name: string } | null
      const startLabel = slot?.start_at
        ? formatTaipeiDateTime(slot.start_at, { withYear: true })
        : ''
      await pushToUser(admin, {
        userId: b.customer_id,
        type: 'booking_status',
        payload: {
          title: '團班已開課',
          body: `${tenant?.name ?? ''} ${svc?.name ?? '課程'} (${startLabel}) 已達開課人數，課程確認`,
          url: '/my-bookings',
          tag: `group-confirm-${b.id}`,
        },
        relatedId: b.id,
      })
    }
  } catch (err) {
    console.error('[notify-group-confirm]', err)
  }
}

export async function notifyGroupAutoCancel(
  customerId: string,
  memberUserId: string | null,
  serviceName: string,
  slotStartAt: string,
): Promise<void> {
  try {
    const admin = createSupabaseAdminClient()
    const startLabel = formatTaipeiDateTime(slotStartAt, { withYear: true })
    // Customer notification
    await pushToUser(admin, {
      userId: customerId,
      type: 'booking_status',
      payload: {
        title: '課程取消',
        body: `${serviceName} (${startLabel}) 因人數不足取消，已退回 1 堂。`,
        url: '/my-bookings',
        tag: `auto-cancel-${slotStartAt}-${customerId}`,
      },
      relatedId: customerId,
    })
    // Coach notification
    if (memberUserId) {
      await pushToUser(admin, {
        userId: memberUserId,
        type: 'booking_status',
        payload: {
          title: '團班取消',
          body: `${serviceName} (${startLabel}) 因人數不足，系統已自動取消，並把堂數退回給學員。`,
          url: '/calendar',
          tag: `auto-cancel-${slotStartAt}`,
        },
        relatedId: customerId,
      })
    }
  } catch (err) {
    console.error('[notify-group-auto-cancel]', err)
  }
}
