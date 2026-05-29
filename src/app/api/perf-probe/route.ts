import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * One-shot perf probe: measures Vercel function ↔ Supabase round-trip time.
 * Delete after audit is done.
 */
export async function GET() {
  const admin = createSupabaseAdminClient()
  const samples = []
  for (let i = 0; i < 5; i++) {
    const t0 = Date.now()
    await admin.from('tenants').select('id', { count: 'exact', head: true })
    samples.push(Date.now() - t0)
  }
  const region = process.env.VERCEL_REGION ?? 'unknown'
  return NextResponse.json({
    region,
    supabaseRtt: samples,
    minMs: Math.min(...samples),
    medianMs: samples.sort((a, b) => a - b)[Math.floor(samples.length / 2)],
  })
}
