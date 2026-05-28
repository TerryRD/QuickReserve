-- Add covering indexes for foreign keys flagged by Supabase performance advisor
-- (unindexed_foreign_keys, lint 0001). Each FK without a covering index forces
-- sequential scans of the child table when the parent row is deleted/updated,
-- and slows JOINs filtered by the FK column.

create index if not exists idx_availability_template_assignments_template_id
  on public.availability_template_assignments (template_id);

create index if not exists idx_customer_purchases_approved_by
  on public.customer_purchases (approved_by);

create index if not exists idx_customer_purchases_package_id
  on public.customer_purchases (package_id);

create index if not exists idx_customer_purchases_service_id
  on public.customer_purchases (service_id);

create index if not exists idx_service_packages_tenant_id
  on public.service_packages (tenant_id);
