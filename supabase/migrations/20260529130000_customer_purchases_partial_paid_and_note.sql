-- A-4: support 'partial_paid' as a third self-reported payment status,
-- plus an optional receipt_note column so customers can include payment
-- reference (e.g. "轉帳末四碼 1234" or "已付 5000 / 剩 5000 預約後付").
--
-- Original constraint was inline in 20260525200002 with an auto-generated
-- name. The do-block looks up the actual constraint name from pg_constraint
-- so this migration doesn't break if PostgreSQL named it differently.

do $$
declare
  cname text;
begin
  select conname
    into cname
    from pg_constraint
    where conrelid = 'public.customer_purchases'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%payment_self_reported%';
  if cname is not null then
    execute format(
      'alter table public.customer_purchases drop constraint %I',
      cname
    );
  end if;
end
$$;

alter table public.customer_purchases
  add constraint customer_purchases_payment_self_reported_check
  check (payment_self_reported in ('claimed_paid', 'awaiting_payment', 'partial_paid'));

-- Optional free-form note. Length cap is enforced at the application layer
-- (Zod max 500) to keep validation co-located with the form.
alter table public.customer_purchases
  add column if not exists receipt_note text;
