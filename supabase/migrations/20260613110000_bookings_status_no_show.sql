-- Cancel-deadline + no-show (spec 2026-06-13): add a terminal 'no_show' status.
-- The original status CHECK is inline (auto-named); drop by looked-up name then recreate.
do $$
declare cname text;
begin
  select conname into cname
    from pg_constraint
    where conrelid = 'public.bookings'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
      and pg_get_constraintdef(oid) ilike '%pending%';
  if cname is not null then
    execute format('alter table public.bookings drop constraint %I', cname);
  end if;
end $$;

alter table public.bookings
  add constraint bookings_status_check
  check (status in ('pending', 'confirmed', 'completed', 'cancelled', 'no_show'));
