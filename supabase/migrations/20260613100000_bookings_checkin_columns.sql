-- Student check-in (spec 2026-06-13-student-checkin-design):
-- bookings gains check-in tracking; check-in = completed.
-- tenants gains a tenant-wide pre-class reminder lead (null = disabled).

alter table public.bookings
  add column if not exists checked_in_at timestamptz,
  add column if not exists checked_in_by uuid references auth.users(id);

comment on column public.bookings.checked_in_at is 'When the student checked in; null = not checked in';
comment on column public.bookings.checked_in_by is 'auth.users id of the student who performed the check-in';

alter table public.tenants
  add column if not exists checkin_reminder_minutes int default 15
    check (checkin_reminder_minutes is null or checkin_reminder_minutes >= 1);

comment on column public.tenants.checkin_reminder_minutes is 'Minutes before start_at to remind student to check in; null = disabled';

-- Partial index to support the every-minute cron scan for un-checked-in confirmed bookings.
create index if not exists idx_bookings_checkin_scan
  on public.bookings (slot_id)
  where checked_in_at is null and status = 'confirmed';
