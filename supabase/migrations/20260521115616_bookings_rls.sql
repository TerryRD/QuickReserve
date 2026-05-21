alter table public.bookings enable row level security;

-- Tenant members read their tenant's bookings
create policy bookings_select_member on public.bookings for select
  using (tenant_id in (select current_user_tenant_ids()));

-- Customer reads their own bookings
create policy bookings_select_own_customer on public.bookings for select
  using (customer_id = auth.uid());

-- Platform admin sees all
create policy bookings_select_admin on public.bookings for select using (is_platform_admin());

-- Customer creates own booking (slot validation done via book_slot_atomic RPC)
create policy bookings_insert_customer on public.bookings for insert
  with check (customer_id = auth.uid());

-- Tenant members can also insert (e.g. recording an off-platform booking)
create policy bookings_insert_member on public.bookings for insert
  with check (tenant_id in (select current_user_tenant_ids()));

-- Customer can update own booking (used for cancel)
create policy bookings_update_own_customer on public.bookings for update
  using (customer_id = auth.uid());

-- Tenant members can update bookings in their tenant (approve / cancel)
create policy bookings_update_member on public.bookings for update
  using (tenant_id in (select current_user_tenant_ids()));
