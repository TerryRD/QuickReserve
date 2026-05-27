// src/app/(tenant)/settings/profile/actions.ts
'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { actionClient } from '@/lib/safe-action'
import { requireTenantOwner } from '@/lib/auth/get-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AppError } from '@/lib/errors'
import { sanitizeBioHtml } from '@/lib/sanitize'
import { parseVideoUrl } from '@/components/public-page/video-embed'

const UpdateProfileSchema = z.object({
  name: z.string().min(1, '請填租戶名稱').max(60),
  description: z.string().max(500).optional().nullable(),
  contactEmail: z.string().email().or(z.literal('')).optional().nullable(),
  contactPhone: z.string().max(40).optional().nullable(),
  contactLineId: z.string().max(40).optional().nullable(),
  contactNote: z.string().max(280).optional().nullable(),
  avatarUrl: z.string().url().or(z.literal('')).optional().nullable(),
  bioHtml: z.string().max(20_000).optional().nullable(),
  introVideoUrl: z.string().url().or(z.literal('')).optional().nullable(),
  yearsExp: z.number().int().nonnegative().max(120).nullable().optional(),
  establishedYear: z.number().int().min(1900).max(2100).nullable().optional(),
  city: z.string().max(80).nullable().optional(),
})

export const updateTenantProfileAction = actionClient
  .inputSchema(UpdateProfileSchema)
  .action(async ({ parsedInput }) => {
    const session = await requireTenantOwner()

    // Validate video URL (if provided, must be YouTube or Vimeo)
    if (parsedInput.introVideoUrl && parseVideoUrl(parsedInput.introVideoUrl) === null) {
      throw new AppError('INVALID_VIDEO_URL', '只接受 YouTube 或 Vimeo 連結')
    }

    const cleanBio = parsedInput.bioHtml ? sanitizeBioHtml(parsedInput.bioHtml) : null

    const supabase = await createSupabaseServerClient()
    const { error } = await supabase
      .from('tenants')
      .update({
        name: parsedInput.name,
        description: parsedInput.description ?? null,
        contact_email: parsedInput.contactEmail || null,
        contact_phone: parsedInput.contactPhone || null,
        contact_line_id: parsedInput.contactLineId || null,
        contact_note: parsedInput.contactNote || null,
        avatar_url: parsedInput.avatarUrl || null,
        bio_html: cleanBio,
        intro_video_url: parsedInput.introVideoUrl || null,
        years_exp: parsedInput.yearsExp ?? null,
        established_year: parsedInput.establishedYear ?? null,
        city: parsedInput.city ? parsedInput.city.trim() || null : null,
      })
      .eq('id', session.tenantId)
    if (error) throw new AppError('TENANT_UPDATE_FAILED', error.message)
    revalidatePath('/settings/profile')
    revalidatePath('/dashboard')
    return { ok: true }
  })
