'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { actionClient } from '@/lib/safe-action'
import { requireTenantOwner } from '@/lib/auth/get-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AppError } from '@/lib/errors'
import { deleteCoachMedia } from '@/lib/storage'

const PHOTO_LIMIT = 10

const AddPhotoSchema = z.object({
  storagePath: z.string().min(1),
  caption: z.string().max(140).optional().nullable(),
})

export const addPhotoAction = actionClient.inputSchema(AddPhotoSchema).action(async ({ parsedInput }) => {
  const session = await requireTenantOwner()
  // path must start with tenant_id/
  if (!parsedInput.storagePath.startsWith(`${session.tenantId}/`)) {
    throw new AppError('PHOTO_PATH_MISMATCH', '上傳路徑不符')
  }
  const supabase = await createSupabaseServerClient()
  const { count, error: cntErr } = await supabase
    .from('tenant_photos')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', session.tenantId)
  if (cntErr) throw new AppError('PHOTO_COUNT_FAILED', cntErr.message)
  if ((count ?? 0) >= PHOTO_LIMIT) {
    throw new AppError('PHOTO_LIMIT_REACHED', `最多 ${PHOTO_LIMIT} 張照片`)
  }
  const { error } = await supabase.from('tenant_photos').insert({
    tenant_id: session.tenantId,
    storage_path: parsedInput.storagePath,
    caption: parsedInput.caption ?? null,
    display_order: count ?? 0,
  })
  if (error) throw new AppError('PHOTO_INSERT_FAILED', error.message)
  revalidatePath('/settings/profile')
  return { ok: true }
})

const UpdateCaptionSchema = z.object({
  id: z.string().uuid(),
  caption: z.string().max(140).optional().nullable(),
})

export const updatePhotoCaptionAction = actionClient
  .inputSchema(UpdateCaptionSchema)
  .action(async ({ parsedInput }) => {
    const session = await requireTenantOwner()
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase
      .from('tenant_photos')
      .update({ caption: parsedInput.caption ?? null })
      .eq('id', parsedInput.id)
      .eq('tenant_id', session.tenantId)
    if (error) throw new AppError('PHOTO_UPDATE_FAILED', error.message)
    revalidatePath('/settings/profile')
    return { ok: true }
  })

const DeletePhotoSchema = z.object({ id: z.string().uuid() })

export const deletePhotoAction = actionClient.inputSchema(DeletePhotoSchema).action(async ({ parsedInput }) => {
  const session = await requireTenantOwner()
  const supabase = await createSupabaseServerClient()
  const { data: row, error: selErr } = await supabase
    .from('tenant_photos')
    .select('storage_path')
    .eq('id', parsedInput.id)
    .eq('tenant_id', session.tenantId)
    .maybeSingle()
  if (selErr) throw new AppError('PHOTO_LOOKUP_FAILED', selErr.message)
  if (!row) throw new AppError('PHOTO_NOT_FOUND', '找不到照片')
  const { error: delErr } = await supabase
    .from('tenant_photos')
    .delete()
    .eq('id', parsedInput.id)
    .eq('tenant_id', session.tenantId)
  if (delErr) throw new AppError('PHOTO_DELETE_FAILED', delErr.message)
  // Best-effort: remove file (ignore failure to avoid blocking row deletion)
  try {
    await deleteCoachMedia(row.storage_path)
  } catch {
    // file may already be gone; row delete is the source of truth
  }
  revalidatePath('/settings/profile')
  return { ok: true }
})
