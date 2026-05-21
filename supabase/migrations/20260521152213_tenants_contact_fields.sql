-- Add contact / profile fields to tenants
alter table public.tenants
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists contact_line_id text,
  add column if not exists contact_note text;

-- Allow Owner to update own tenant profile (description, avatar, contact info)
-- (existing tenants_update policy already permits this via owner check)
