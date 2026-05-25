import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { pushToUser } from '@/lib/push'

export type BookingEvent = 'created' | 'confirmed' | 'cancelled'

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
  triggeredByUserId: string,
): Promise<void> {
  try {
    const admin = createSupabaseAdminClient()
    const { data: booking } = await admin
      .from('bookings')
      .select(
        'id, customer_id, customers(display_name), services(name), availability_slots(start_at, tenant_members(user_id)), tenants(name, slug)',
      )
      .eq('id', bookingId)
      .maybeSingle()
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
    const startAt = slot?.start_at
      ? new Date(new Date(slot.start_at).getTime() + 8 * 3600 * 1000).toLocaleString('zh-TW')
      : ''

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
      const target = triggeredByUserId === customerUserId ? memberUserId : customerUserId
      const isCustomerCancelled = triggeredByUserId === customerUserId
      if (target) {
        await pushToUser(admin, {
          userId: target,
          type: 'booking_status',
          payload: {
            title: '預約已取消',
            body: isCustomerCancelled
              ? `${customer?.display_name ?? '學員'} 取消了預約 (${startAt})`
              : `${tenant?.name ?? '教練'} 取消了您的預約 (${startAt})`,
            url: isCustomerCancelled ? '/bookings' : '/my-bookings',
            tag: `booking-${bookingId}`,
          },
          relatedId: bookingId,
        })
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
    const title = decision === 'approved' ? '套裝已確認' : '套裝申請被拒絕'
    const body =
      decision === 'approved'
        ? `${tenant?.name ?? ''} 確認您的 ${pkg?.name ?? svc?.name ?? '套裝'}（${p.classes_total} 堂），可開始預約`
        : `${tenant?.name ?? '教練'} 拒絕了您的套裝申請：${p.rejected_reason ?? ''}`

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
