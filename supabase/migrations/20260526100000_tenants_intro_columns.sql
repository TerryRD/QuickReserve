alter table public.tenants
  add column bio_html text,
  add column intro_video_url text;

comment on column public.tenants.bio_html is 'Sanitized HTML for coach bio (rich text). Set via updateTenantProfileAction after sanitize-html filter.';
comment on column public.tenants.intro_video_url is 'YouTube or Vimeo URL; only host/id are used to compose iframe src.';
