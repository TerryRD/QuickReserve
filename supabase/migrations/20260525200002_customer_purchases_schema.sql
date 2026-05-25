-- customer_purchases: every booking source (both single class N=1 and packages N>1)
create table public.customer_purchases (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid not null references public.customers(id),
  service_id uuid not null references public.services(id),
  package_id uuid references public.service_packages(id),
  classes_total int not null check (classes_total >= 1),
  classes_used int not null default 0
    check (classes_used >= 0 and classes_used <= classes_total),
  expires_at timestamptz,
  payment_self_reported text not null
    check (payment_self_reported in ('claimed_paid', 'awaiting_payment')),
  approval_status text not null default 'pending_review'
    check (approval_status in ('pending_review', 'confirmed', 'rejected')),
  approved_at timestamptz,
  approved_by uuid references auth.users(id),
  rejected_reason text,
  created_at timestamptz not null default now()
);

create index idx_customer_purchases_lookup
  on public.customer_purchases(customer_id, service_id, approval_status, expires_at);

create index idx_customer_purchases_tenant_pending
  on public.customer_purchases(tenant_id, approval_status)
  where approval_status = 'pending_review';
