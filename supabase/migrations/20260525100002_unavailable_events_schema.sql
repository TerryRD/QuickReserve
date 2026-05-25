-- 不可用事件：教練 / 助教任意時間區段不可用
create table public.unavailable_events (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.tenant_members(id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null check (end_at > start_at),
  reason text,
  created_at timestamptz not null default now()
);
create index idx_unavailable_events_member_range on
  public.unavailable_events(member_id, start_at, end_at);
