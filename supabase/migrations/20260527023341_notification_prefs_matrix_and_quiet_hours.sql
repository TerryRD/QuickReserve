-- Add per-channel toggle matrix and quiet-hours window to notification_preferences.
-- Email channel is intentionally not included (cost / rate-limit considerations).
alter table public.notification_preferences
  add column if not exists channels jsonb not null default jsonb_build_object(
    'web_push', jsonb_build_object(
      'booking_created', true,
      'booking_confirmed', true,
      'booking_cancelled', true,
      'booking_rescheduled', true,
      'package_request', true,
      'package_approved', true,
      'pre_event', true,
      'daily_reminder', true,
      'weekly_summary', true
    ),
    'in_app', jsonb_build_object(
      'booking_created', true,
      'booking_confirmed', true,
      'booking_cancelled', true,
      'booking_rescheduled', true,
      'package_request', true,
      'package_approved', true,
      'pre_event', true,
      'daily_reminder', true,
      'weekly_summary', true
    )
  ),
  add column if not exists quiet_hours_start time,
  add column if not exists quiet_hours_end time;

comment on column public.notification_preferences.channels is
  'Per-channel-per-event toggle matrix. Top-level keys: web_push, in_app. Email intentionally omitted.';
comment on column public.notification_preferences.quiet_hours_start is
  'Local-time start of do-not-disturb window (null = disabled). Inclusive.';
comment on column public.notification_preferences.quiet_hours_end is
  'Local-time end of do-not-disturb window (null = disabled). Exclusive. Wraps midnight if end < start.';
