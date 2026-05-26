-- supabase/migrations/20260526100001_tenant_photos_schema.sql
create table public.tenant_photos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  storage_path text not null,
  caption text,
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

create index idx_tenant_photos_tenant_order
  on public.tenant_photos(tenant_id, display_order, created_at);

comment on table public.tenant_photos is 'Coach intro page photos. storage_path = <tenant_id>/<uuid>.<ext> in coach-media bucket. Max 10 per tenant (enforced in server action).';
