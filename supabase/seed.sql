-- supabase/seed.sql
-- Optional seed data for local/dev environments. Production platform admins
-- must be inserted manually via SQL Editor.

-- ─────────────── Platform admin bootstrap (manual) ───────────────
-- Plan 1 acceptance requires one platform admin. There is no UI to elevate a
-- user; this is intentional (security boundary). Process:
--
-- 1. Sign up at https://your-app.vercel.app/signup with your real email/password
-- 2. Find your auth user_id in Supabase Dashboard → Authentication → Users
-- 3. Run the SQL below (in Supabase Dashboard → SQL Editor) with your UUID
--
--   insert into public.platform_admins (user_id)
--   values ('00000000-0000-0000-0000-000000000000')
--   on conflict (user_id) do nothing;

-- ─────────────── Dev demo: tenant + services + packages ──────────────────
-- Idempotent: skips if demo tenant already present. Re-running `supabase db
-- reset` (local stack only — never run against the linked remote dev project!)
-- produces the same demo state.
--
-- LIMITATION: customers, tenant_members, availability_slots, and bookings all
-- depend on rows in auth.users which cannot be safely seeded from pure SQL
-- (auth.users is owned by GoTrue and FK-protected). For a full demo dataset
-- (coaches with logins, students, slots, bookings), run the existing Node
-- script which uses the service-role auth admin API:
--
--   node scripts/seed-test-data.mjs    # needs SUPABASE_SERVICE_ROLE_KEY
--
-- This SQL file only seeds the tenant + service catalogue so the public page
-- (/<slug>) renders with content out of the box even without running the
-- Node seeder.

do $$
declare
  v_tenant_id    uuid := '11111111-1111-1111-1111-111111111111';
  v_svc_1on1_id  uuid := 'cccccccc-cccc-cccc-cccc-ccccccccccc1';
  v_svc_group_id uuid := 'cccccccc-cccc-cccc-cccc-ccccccccccc2';
  v_pkg_1on1_id  uuid := 'dddddddd-dddd-dddd-dddd-ddddddddddd1';
  v_pkg_group_id uuid := 'dddddddd-dddd-dddd-dddd-ddddddddddd2';
begin
  if exists (select 1 from public.tenants where id = v_tenant_id) then
    raise notice 'Demo tenant % already seeded — skipping.', v_tenant_id;
    return;
  end if;

  -- TENANT (hero meta + contact + bio fields all in one insert)
  insert into public.tenants (
    id, slug, name, status, description,
    contact_email, contact_phone, contact_line_id, contact_note,
    bio_html, intro_video_url,
    years_exp, established_year, city
  ) values (
    v_tenant_id, 'coach-poyu', '陳柏宇教練', 'active',
    '一對一肌力訓練 · 七年經驗',
    'poyu@example.com', '0912-345-678', 'poyu_coach', '預約請先填表',
    '<p>我是 <strong>柏宇</strong>，從事一對一肌力訓練教學已邁入第七年。我相信運動的核心不在於追求短期成果，而是讓你長期、規律地把訓練放進日常生活裡。</p><p>訓練前先評估、再設計動作組合；過程中以姿勢與技術為優先、循序加重。</p>',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    7, 2018, 'TAIPEI · 內湖'
  );

  -- SERVICES (one 1-on-1 + one small-group)
  -- Group-class columns: max_capacity, min_attendance, cancel_deadline_hours
  -- come from migration 20260525200007_services_group_class_columns.sql.
  insert into public.services (
    id, tenant_id, name, description, duration_minutes, price,
    max_capacity, min_attendance, cancel_deadline_hours, is_active
  ) values
    (v_svc_1on1_id,  v_tenant_id, '一對一肌力訓練',
     '60 分鐘專屬訓練，含評估與動作矯正',
     60, 2000, 1, 1, 24, true),
    (v_svc_group_id, v_tenant_id, '小團體 (3-4 人)',
     '小團班肌力訓練，適合朋友／同事一起練',
     75,  800, 4, 3, 24, true);

  -- SERVICE_PACKAGES
  -- Column is `class_count` (not sessions_total). `is_popular` added in
  -- 20260527023249_service_packages_is_popular.sql for the yellow Pill badge
  -- on /<slug>/packages.
  insert into public.service_packages (
    id, tenant_id, service_id, name,
    class_count, price, expires_in_days, is_active, is_popular
  ) values
    (v_pkg_1on1_id,  v_tenant_id, v_svc_1on1_id,  '一對一 10 堂',
     10, 18000, 180, true, true),
    (v_pkg_group_id, v_tenant_id, v_svc_group_id, '小團體 12 堂',
     12,  8400, 180, true, false);

  raise notice 'Demo tenant seeded: % (slug=coach-poyu)', v_tenant_id;
end$$;
