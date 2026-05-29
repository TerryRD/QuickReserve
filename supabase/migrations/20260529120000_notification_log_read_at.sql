-- A-5 /notifications persistent read state.
-- Replaces the previous 24h "anything younger than X is unread" heuristic with
-- a real per-row timestamp. read_at is null = unread, set = read.

alter table public.notification_log
  add column if not exists read_at timestamptz;

-- Allow a user to flip read_at on their own rows. The existing policy only
-- covers SELECT; writes have been service_role only. We add UPDATE with
-- USING + WITH CHECK both gated on user_id = auth.uid(), so a user can mark
-- read but can't reassign rows to another user or insert new logs.
create policy notif_log_self_update on public.notification_log
  for update
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Partial index speeds up "any unread for this user?" lookups (small table
-- per user but worth it once the log grows; matches the `read_at is null`
-- filter pattern used by the UI).
create index if not exists idx_notification_log_user_unread
  on public.notification_log(user_id, sent_at desc)
  where read_at is null;
