-- Drop 1-slot-1-booking guard (incompatible with group classes)
drop index if exists public.bookings_slot_unique_active;

-- Replace with: one customer can only book a slot once (still no double-booking)
create unique index bookings_slot_customer_unique
  on public.bookings(slot_id, customer_id)
  where status <> 'cancelled';
