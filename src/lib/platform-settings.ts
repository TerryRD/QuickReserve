import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { AppError } from './errors'
import type { Database } from './supabase/types'

type Client = SupabaseClient<Database>

const LOAD_FAILED_MESSAGE = '目前無法取得取消原因，請稍後再試'

/** 學員常用取消原因。讀不到或格式不對時丟出 AppError，不回傳預設清單（B4.2、B6.9）。 */
export async function getCustomerCancelReasons(supabase: Client): Promise<string[]> {
  const { data, error } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', 'customer_cancel_reasons')
    .maybeSingle()

  if (error || !data) {
    console.error('[platform-settings] customer_cancel_reasons 讀取失敗', error)
    throw new AppError('SETTINGS_UNAVAILABLE', LOAD_FAILED_MESSAGE)
  }

  const value = data.value
  const valid =
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((v) => typeof v === 'string' && v.trim().length > 0)
  if (!valid) {
    console.error('[platform-settings] customer_cancel_reasons 格式不符', value)
    throw new AppError('SETTINGS_INVALID', LOAD_FAILED_MESSAGE)
  }

  return (value as string[]).map((v) => v.trim())
}
