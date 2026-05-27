-- Add is_popular flag for /<slug>/packages "popular" yellow Pill marker.
alter table public.service_packages
  add column if not exists is_popular boolean not null default false;

comment on column public.service_packages.is_popular is 'When true, show "POPULAR" yellow Pill badge on /<slug>/packages cards.';
