-- Drop the broad SELECT policy on coach-media bucket. The bucket stays public
-- so direct URL access (https://<ref>.supabase.co/storage/v1/object/public/coach-media/<path>)
-- still works — that code path doesn't require an RLS SELECT policy.
--
-- The removed policy only enabled clients to LIST all files in the bucket via
-- the REST API. Nothing in this codebase calls .list() on coach-media (verified
-- 2026-05-28); only .upload/.remove/.getPublicUrl are used. The listing surface
-- was an enumeration risk flagged by Supabase advisor lint 0025
-- (public_bucket_allows_listing).
--
-- If a future feature needs to list a tenant's own photos, prefer querying the
-- public.tenant_photos table (which has its own RLS scoped to owner) over
-- listing the bucket.

drop policy if exists coach_media_select_public on storage.objects;
