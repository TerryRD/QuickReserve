import { createServerClient } from '@supabase/ssr'
import type { Database } from '@/lib/supabase/types'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * 驗證 email + 密碼是否正確，用於敏感操作（改密碼 / 改 email）前的再驗身。
 * 使用不寫 cookie、不持久化的臨時 client，避免污染呼叫者目前的登入 session。
 */
export async function verifyCurrentPassword(email: string, password: string): Promise<boolean> {
  const client = createServerClient<Database>(url, anonKey, {
    cookies: { getAll: () => [], setAll: () => {} },
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error } = await client.auth.signInWithPassword({ email, password })
  return !error
}
