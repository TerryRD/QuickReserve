-- push_subscriptions: one row per device per user
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now()
);
create index idx_push_subs_user on public.push_subscriptions(user_id);

-- notification_preferences: 1:1 with auth.users
create table public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  weekly_summary_enabled boolean not null default true,
  daily_reminder_enabled boolean not null default true,
  daily_reminder_hour int not null default 7 check (daily_reminder_hour between 0 and 23),
  pre_event_minutes int[] not null default '{30}',
  pre_event_enabled boolean not null default true,
  booking_status_changes_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
create trigger notification_preferences_set_updated_at
  before update on public.notification_preferences
  for each row execute function public.set_updated_at();

-- notification_log: idempotency + audit
create table public.notification_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  related_id uuid,
  scheduled_for timestamptz,
  channel text not null default 'web_push',
  status text not null check (status in ('sent', 'failed', 'skipped')),
  error_message text,
  sent_at timestamptz not null default now()
);
-- Dedup: same user + type + related_id + scheduled_for sent at most once
create unique index notification_log_dedup
  on public.notification_log(user_id, type, related_id, scheduled_for)
  where related_id is not null and scheduled_for is not null;
create index idx_notification_log_user on public.notification_log(user_id, sent_at desc);
