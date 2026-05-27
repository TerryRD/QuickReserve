-- Add tenant hero meta fields used by /<slug> public page.
alter table public.tenants
  add column if not exists years_exp int check (years_exp >= 0),
  add column if not exists established_year int check (established_year between 1900 and 2100),
  add column if not exists city text;

comment on column public.tenants.years_exp is 'Years of coaching experience displayed on public page hero (e.g. "7 YRS").';
comment on column public.tenants.established_year is 'Studio establishment year displayed on public page hero (e.g. "EST 2018").';
comment on column public.tenants.city is 'Free-form city/area label displayed on public page hero (e.g. "TAIPEI 內湖").';
