import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './types'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(url, anonKey)
}
