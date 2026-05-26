import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server'
import { AppError } from '@/lib/errors'

export const COACH_MEDIA_BUCKET = 'coach-media'

/**
 * Returns a public URL for an object in the coach-media bucket.
 * The bucket is public, so the URL doesn't require auth.
 */
export function getCoachMediaPublicUrl(storagePath: string): string {
  const admin = createSupabaseAdminClient()
  const { data } = admin.storage.from(COACH_MEDIA_BUCKET).getPublicUrl(storagePath)
  return data.publicUrl
}

/**
 * Server-side upload (used by avatar uploader server action).
 * Photo gallery uses client-side upload through the browser Supabase client
 * to benefit from streaming + RLS enforcement.
 */
export async function uploadCoachMedia(opts: {
  tenantId: string
  filename: string
  body: Blob | ArrayBuffer | Uint8Array
  contentType: string
}): Promise<{ path: string; publicUrl: string }> {
  const supabase = await createSupabaseServerClient()
  const path = `${opts.tenantId}/${opts.filename}`
  const { error } = await supabase.storage
    .from(COACH_MEDIA_BUCKET)
    .upload(path, opts.body, { contentType: opts.contentType, upsert: true })
  if (error) throw new AppError('STORAGE_UPLOAD_FAILED', error.message)
  return { path, publicUrl: getCoachMediaPublicUrl(path) }
}

export async function deleteCoachMedia(storagePath: string): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.storage.from(COACH_MEDIA_BUCKET).remove([storagePath])
  if (error) throw new AppError('STORAGE_DELETE_FAILED', error.message)
}
