-- Enforce the upper bound on the pre-class reminder lead. The check-in cron
-- fetch window is now()+3h; a lead > 180 min would fall outside the window and
-- silently drop the reminder. Cap at 180 to keep the window/lead coupling safe.
alter table public.tenants drop constraint if exists tenants_checkin_reminder_minutes_check;
alter table public.tenants add constraint tenants_checkin_reminder_minutes_check
  check (checkin_reminder_minutes is null or (checkin_reminder_minutes >= 1 and checkin_reminder_minutes <= 180));
