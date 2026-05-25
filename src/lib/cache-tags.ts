export function publicSlotsTag(tenantId: string): string {
  if (!tenantId) throw new Error('publicSlotsTag: tenantId required')
  return `public-slots-${tenantId}`
}
