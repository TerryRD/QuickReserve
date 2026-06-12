-- Schedule the check-in reminder cron (spec 2026-06-13-student-checkin-design, Task 9).
-- pg_cron pings the deployed Next.js route every minute via pg_net. This avoids the
-- Vercel Hobby daily-cron limit (the route is intentionally NOT in vercel.json).
--
-- Uses net.http_get (the route only exports a GET handler; pg_net supports GET with
-- headers). Requires two Vault secrets, created out-of-band before this runs:
--   * app_base_url -- the deployed production origin, e.g. https://app.example.com
--   * cron_secret  -- must equal the CRON_SECRET env var the route validates
-- The Authorization header mirrors the existing cron routes' Bearer guard.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'checkin-reminder',
  '* * * * *',
  $$
  select net.http_get(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'app_base_url')
           || '/api/cron/checkin-reminder',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    timeout_milliseconds := 5000
  );
  $$
);
