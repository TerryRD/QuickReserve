alter table public.tenant_photos enable row level security;

-- Public read (學員瀏覽公開頁) — 任何 active tenant 的照片
create policy tenant_photos_select_public on public.tenant_photos for select
  using (
    tenant_id in (select id from public.tenants where status = 'active')
  );

-- Tenant members read their own
create policy tenant_photos_select_member on public.tenant_photos for select
  using (tenant_id in (select current_user_tenant_ids()));

-- Platform admin sees all
create policy tenant_photos_select_admin on public.tenant_photos for select
  using (is_platform_admin());

-- Only owner can write
create policy tenant_photos_insert_owner on public.tenant_photos for insert
  with check (tenant_id in (select current_user_owner_tenant_ids()));
create policy tenant_photos_update_owner on public.tenant_photos for update
  using (tenant_id in (select current_user_owner_tenant_ids()));
create policy tenant_photos_delete_owner on public.tenant_photos for delete
  using (tenant_id in (select current_user_owner_tenant_ids()));
