alter table public.services
  add column max_capacity int not null default 1
    check (max_capacity >= 1),
  add column min_attendance int not null default 1
    check (min_attendance >= 1),
  add column cancel_deadline_hours int not null default 24
    check (cancel_deadline_hours >= 1);

-- Cross-column check: min_attendance <= max_capacity
alter table public.services
  add constraint services_min_le_max
  check (min_attendance <= max_capacity);
