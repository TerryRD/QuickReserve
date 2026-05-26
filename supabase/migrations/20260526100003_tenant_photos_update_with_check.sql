-- Fix: add WITH CHECK to tenant_photos UPDATE policy so an owner cannot
-- reassign a photo row's tenant_id to another tenant they don't own.
drop policy if exists tenant_photos_update_owner on public.tenant_photos;
create policy tenant_photos_update_owner on public.tenant_photos for update
  using (tenant_id in (select current_user_owner_tenant_ids()))
  with check (tenant_id in (select current_user_owner_tenant_ids()));
