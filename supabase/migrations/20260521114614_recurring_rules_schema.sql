-- recurring_rules: per-member rules that materialize into availability_slots
create table public.recurring_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  member_id uuid not null references public.tenant_members(id) on delete cascade,
  service_id uuid not null references public.services(id),
  freq text not null check (freq in ('daily', 'weekly', 'monthly', 'every_n_days')),
  interval_n int not null default 1 check (interval_n >= 1),
  by_weekday int[],                -- ISO 8601: 1=Mon..7=Sun. Used by 'weekly'.
  by_month_day int check (by_month_day between 1 and 31),  -- Used by 'monthly'.
  start_time time not null,
  end_time time not null check (end_time > start_time),
  start_date date not null,
  end_condition text not null check (end_condition in ('count', 'until', 'none')),
  end_count int,
  end_until date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (
    (end_condition = 'count' and end_count is not null and end_count > 0)
    or (end_condition = 'until' and end_until is not null)
    or (end_condition = 'none')
  )
);
create index idx_recurring_rules_active on public.recurring_rules(is_active, tenant_id);

-- Now that recurring_rules exists, add FK from availability_slots
alter table public.availability_slots
  add constraint availability_slots_recurring_rule_fk
  foreign key (recurring_rule_id) references public.recurring_rules(id) on delete set null;
