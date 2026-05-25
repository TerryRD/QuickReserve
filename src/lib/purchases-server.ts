import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { isActivePurchase, type CustomerPurchase } from './purchases'
import type { Database } from './supabase/types'

type Client = SupabaseClient<Database>

/**
 * Returns the count of active classes (sum of classes_total - classes_used
 * across all active purchases) for a (customer, service) pair.
 */
export async function getCustomerBalance(
  supabase: Client,
  customerId: string,
  serviceId: string,
): Promise<number> {
  const now = new Date()
  const { data, error } = await supabase
    .from('customer_purchases')
    .select('id, approval_status, classes_total, classes_used, expires_at')
    .eq('customer_id', customerId)
    .eq('service_id', serviceId)
    .eq('approval_status', 'confirmed')
  if (error) throw error
  let balance = 0
  for (const p of (data ?? []) as CustomerPurchase[]) {
    if (isActivePurchase(p, now)) {
      balance += p.classes_total - p.classes_used
    }
  }
  return balance
}

/**
 * Returns the oldest-expiring active purchase for booking attribution.
 * Returns null if no eligible purchase exists.
 */
export async function findActivePurchaseForBooking(
  supabase: Client,
  customerId: string,
  serviceId: string,
): Promise<CustomerPurchase | null> {
  const now = new Date()
  const { data, error } = await supabase
    .from('customer_purchases')
    .select('id, approval_status, classes_total, classes_used, expires_at')
    .eq('customer_id', customerId)
    .eq('service_id', serviceId)
    .eq('approval_status', 'confirmed')
    .order('expires_at', { ascending: true, nullsFirst: false })
  if (error) throw error
  for (const p of (data ?? []) as CustomerPurchase[]) {
    if (isActivePurchase(p, now)) return p
  }
  return null
}
