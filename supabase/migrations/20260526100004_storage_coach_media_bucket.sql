-- supabase/migrations/20260526100004_storage_coach_media_bucket.sql

-- Bucket: public read (URLs are public), 5MB file limit, image MIME only
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'coach-media',
  'coach-media',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- RLS policies on storage.objects
-- Path format: <tenant_id>/<filename>
-- foldername(name)[1] = first path segment, cast to uuid → must be in caller's owner tenants

drop policy if exists coach_media_select_public on storage.objects;
create policy coach_media_select_public on storage.objects for select
  using (bucket_id = 'coach-media');

drop policy if exists coach_media_insert_owner on storage.objects;
create policy coach_media_insert_owner on storage.objects for insert
  with check (
    bucket_id = 'coach-media'
    and (storage.foldername(name))[1]::uuid in (
      select current_user_owner_tenant_ids()
    )
  );

drop policy if exists coach_media_update_owner on storage.objects;
create policy coach_media_update_owner on storage.objects for update
  using (
    bucket_id = 'coach-media'
    and (storage.foldername(name))[1]::uuid in (
      select current_user_owner_tenant_ids()
    )
  )
  with check (
    bucket_id = 'coach-media'
    and (storage.foldername(name))[1]::uuid in (
      select current_user_owner_tenant_ids()
    )
  );

drop policy if exists coach_media_delete_owner on storage.objects;
create policy coach_media_delete_owner on storage.objects for delete
  using (
    bucket_id = 'coach-media'
    and (storage.foldername(name))[1]::uuid in (
      select current_user_owner_tenant_ids()
    )
  );
