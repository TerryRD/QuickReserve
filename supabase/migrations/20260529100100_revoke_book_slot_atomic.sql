-- Follow-up to 20260529100000: book_slot_atomic is functionally dead since S4
-- added bookings.purchase_id NOT NULL (it inserts NULL → 23502). Application
-- code (verified by grep) only calls book_with_purchase; book_slot_atomic is
-- referenced only from generated types.ts and the cross-customer guard test.
--
-- Revoke its grant from `authenticated` to shrink attack surface. Function
-- definition stays in place — the auth.uid() guard added in the previous
-- migration is the belt; this REVOKE is the suspenders.

revoke execute on function public.book_slot_atomic(uuid, uuid, text) from authenticated;
