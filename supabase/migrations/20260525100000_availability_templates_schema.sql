-- 作息模板：教練 / 助教設定每週固定可上課時段
create table public.availability_templates (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.tenant_members(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_availability_templates_member on public.availability_templates(member_id);

-- 模板每週時段（多 row × weekday × 多段；不列出 = 該日休）
create table public.availability_template_windows (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.availability_templates(id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),  -- ISO 1=Mon..7=Sun
  start_time time not null,
  end_time time not null check (end_time > start_time)
);
create index idx_template_windows_template on public.availability_template_windows(template_id);

-- 模板生效歷史（時間軸 versioning）
create table public.availability_template_assignments (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.tenant_members(id) on delete cascade,
  template_id uuid not null references public.availability_templates(id) on delete restrict,
  effective_from date not null,
  created_at timestamptz not null default now()
);
create index idx_template_assignments_member_effective on
  public.availability_template_assignments(member_id, effective_from desc);
