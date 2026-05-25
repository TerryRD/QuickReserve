-- For each existing booking, create a 1-class synthetic purchase
-- (pre-S4 legacy data) so that the FK NOT NULL constraint can be
-- safely added next. Synthetic purchases are marked 'confirmed' +
-- 'claimed_paid' and never expire.
do $$
declare
  v_booking record;
  v_purchase_id uuid;
begin
  for v_booking in
    select id, tenant_id, customer_id, service_id, created_at
    from public.bookings
    where purchase_id is null
  loop
    insert into public.customer_purchases (
      tenant_id, customer_id, service_id, package_id,
      classes_total, classes_used,
      expires_at,
      payment_self_reported, approval_status,
      approved_at, approved_by,
      created_at
    ) values (
      v_booking.tenant_id, v_booking.customer_id, v_booking.service_id, null,
      1, 1,
      null,
      'claimed_paid', 'confirmed',
      v_booking.created_at, null,
      v_booking.created_at
    )
    returning id into v_purchase_id;

    update public.bookings
      set purchase_id = v_purchase_id
      where id = v_booking.id;
  end loop;
end $$;
