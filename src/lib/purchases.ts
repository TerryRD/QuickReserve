export type ApprovalStatus = 'pending_review' | 'confirmed' | 'rejected'
export type PaymentSelfReport = 'claimed_paid' | 'awaiting_payment'

export type CustomerPurchase = {
  id: string
  approval_status: ApprovalStatus
  classes_total: number
  classes_used: number
  expires_at: string | null // ISO timestamp or null = never expires
}

/**
 * A purchase is "active" (usable for booking) when:
 *   - approved by coach
 *   - has remaining balance
 *   - not expired (null expires_at means permanent)
 */
export function isActivePurchase(p: CustomerPurchase, now: Date): boolean {
  if (p.approval_status !== 'confirmed') return false
  if (p.classes_used >= p.classes_total) return false
  if (p.expires_at !== null && new Date(p.expires_at) <= now) return false
  return true
}
