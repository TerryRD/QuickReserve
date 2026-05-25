alter table public.bookings
  add column purchase_id uuid references public.customer_purchases(id);
create index idx_bookings_purchase on public.bookings(purchase_id);
