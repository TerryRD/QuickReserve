-- A-9 services drag-reorder: give the owner control over how their services
-- appear on the public page. Today /<slug> orders services by name; this
-- migration adds an int display_order so the order can be set explicitly.
--
-- Backfill: for each tenant, sort existing rows alphabetically by name and
-- assign sequential 0..N-1 numbers. Tenants with no services skip cleanly.
--
-- Non-uniqueness: display_order is NOT unique — the reorder action overwrites
-- the whole list atomically. If two clients race, the later UPDATE wins;
-- there's no constraint to violate. Default 0 means "new services land at the
-- top" until the owner reorders.

alter table public.services
  add column if not exists display_order int not null default 0;

-- One-time backfill, alphabetical within each tenant.
with ordered as (
  select id,
         (row_number() over (partition by tenant_id order by name)) - 1 as ord
    from public.services
)
update public.services s
  set display_order = ordered.ord
  from ordered
  where s.id = ordered.id;

create index if not exists idx_services_tenant_display_order
  on public.services(tenant_id, display_order);
