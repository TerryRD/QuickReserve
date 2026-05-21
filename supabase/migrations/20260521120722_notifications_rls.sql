alter table public.push_subscriptions enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notification_log enable row level security;

-- push_subscriptions: only self can read/write
create policy push_subs_self on public.push_subscriptions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- notification_preferences: only self can read/write
create policy notif_prefs_self on public.notification_preferences
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- notification_log: only self can read (writes happen via service_role)
create policy notif_log_self on public.notification_log
  for select using (user_id = auth.uid() or is_platform_admin());
