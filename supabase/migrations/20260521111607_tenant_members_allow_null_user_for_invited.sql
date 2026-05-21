-- Allow tenant_members.user_id to be NULL while status = 'invited' (pre-acceptance)
alter table public.tenant_members
  alter column user_id drop not null;

-- But require it when status = 'active'
alter table public.tenant_members
  drop constraint if exists tenant_members_user_id_required_when_active;
alter table public.tenant_members
  add constraint tenant_members_user_id_required_when_active
  check (status <> 'active' or user_id is not null);

-- Drop the old UNIQUE (tenant_id, user_id) and rebuild excluding nulls
alter table public.tenant_members
  drop constraint if exists tenant_members_tenant_id_user_id_key;
create unique index if not exists tenant_members_tenant_user_unique
  on public.tenant_members (tenant_id, user_id)
  where user_id is not null;
