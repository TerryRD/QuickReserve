alter table public.customer_purchases enable row level security;

-- Customer reads own; tenant_member reads all in own tenant; admin all
create policy customer_purchases_select_customer on public.customer_purchases for select
  using (customer_id = auth.uid());

create policy customer_purchases_select_member on public.customer_purchases for select
  using (tenant_id in (select current_user_tenant_ids()));

create policy customer_purchases_select_admin on public.customer_purchases for select
  using (is_platform_admin());

-- Customer can request own purchase (must start as pending_review)
create policy customer_purchases_insert_customer on public.customer_purchases for insert
  with check (
    customer_id = auth.uid()
    and approval_status = 'pending_review'
    and classes_used = 0
    and approved_at is null
    and approved_by is null
  );

-- Tenant members can also create (e.g. coach walks customer through purchase in person)
create policy customer_purchases_insert_member on public.customer_purchases for insert
  with check (tenant_id in (select current_user_tenant_ids()));

-- Only tenant members can update (approve/reject/adjust classes)
create policy customer_purchases_update_member on public.customer_purchases for update
  using (tenant_id in (select current_user_tenant_ids()));

-- Delete: deny for everyone via no policy (we don't hard-delete; reject + leave audit trail)
