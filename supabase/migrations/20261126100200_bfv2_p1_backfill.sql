-- ============================================================================
-- 預約流程改版 v2 / P1 — Migration 3：既有資料回填（設計文件 §16）
-- 純資料變更，可重複執行。需在 Migration 1、2 之後執行。
-- ============================================================================

-- 1. 已取消的舊預約 → legacy（不推斷類別）
update public.bookings
   set cancel_category = 'legacy'
 where status = 'cancelled'
   and cancel_category is null;

-- 2. 未開課的既有預約 → 回填取消期限
update public.bookings b
   set cancel_deadline_at = s.start_at - sv.cancel_deadline_hours * interval '1 hour'
  from public.availability_slots s
  join public.services sv on sv.id = s.service_id
 where s.id = b.slot_id
   and b.cancel_deadline_at is null
   and b.status in ('pending', 'confirmed')
   and s.start_at > now();

-- 3. 改版前合成的 1 堂購買 → legacy
update public.customer_purchases cp
   set origin = 'legacy'
 where cp.origin = 'purchase'
   and cp.package_id is null
   and cp.classes_total = 1
   and cp.expires_at is null
   and cp.approved_by is null
   and cp.approval_status = 'confirmed'
   and cp.payment_self_reported = 'claimed_paid'
   and cp.approved_at is not distinct from cp.created_at;

-- 4. 既有堂數 → 補一筆彙總明細（改版前累計），補的是差額
insert into public.class_ledger (purchase_id, booking_id, delta, reason_code, actor_user_id)
select cp.id,
       null,
       -cp.classes_used - coalesce(l.total, 0),
       'opening_balance',
       null
  from public.customer_purchases cp
  left join (
    select purchase_id, sum(delta) as total
      from public.class_ledger
     group by purchase_id
  ) l on l.purchase_id = cp.id
 where -cp.classes_used - coalesce(l.total, 0) <> 0;
