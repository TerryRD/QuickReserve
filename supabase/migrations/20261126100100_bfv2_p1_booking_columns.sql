-- ============================================================================
-- 預約流程改版 v2 / P1 — Migration 2：bookings / customer_purchases 新欄位
-- 可重複執行。只新增欄位與限制，不動既有資料。
-- ============================================================================

alter table public.bookings
  add column if not exists cancel_category text,
  add column if not exists cancel_reason text,
  add column if not exists cancel_actor_role text,
  add column if not exists class_disposition text,
  add column if not exists leave_source text,
  add column if not exists cancel_deadline_at timestamptz,
  add column if not exists rescheduled_from_booking_id uuid references public.bookings(id);

comment on column public.bookings.cancel_category is '取消類別（設計文件 §3.2）';
comment on column public.bookings.cancel_reason is '取消原因說明';
comment on column public.bookings.cancel_actor_role is '取消人身分：customer / owner / staff / system';
comment on column public.bookings.class_disposition is '堂數處理目前有效值：refunded 退回 / forfeited 不退回 / transferred 轉到新預約';
comment on column public.bookings.leave_source is '請假來源：request / coach_entry / dispute（P2 起使用）';
comment on column public.bookings.cancel_deadline_at is '這筆預約的取消期限（成立時算好，之後不因服務設定變更而改變）';
comment on column public.bookings.rescheduled_from_booking_id is '由哪一筆預約改期而來';

alter table public.bookings drop constraint if exists bookings_cancel_category_check;
alter table public.bookings add constraint bookings_cancel_category_check
  check (cancel_category is null or cancel_category in (
    'customer', 'rescheduled', 'coach_rejected', 'confirm_expired', 'leave',
    'coach_cancelled', 'late_cancel', 'under_min', 'legacy'));

alter table public.bookings drop constraint if exists bookings_cancel_actor_role_check;
alter table public.bookings add constraint bookings_cancel_actor_role_check
  check (cancel_actor_role is null or cancel_actor_role in ('customer', 'owner', 'staff', 'system'));

alter table public.bookings drop constraint if exists bookings_class_disposition_check;
alter table public.bookings add constraint bookings_class_disposition_check
  check (class_disposition is null or class_disposition in ('refunded', 'forfeited', 'transferred'));

alter table public.bookings drop constraint if exists bookings_leave_source_check;
alter table public.bookings add constraint bookings_leave_source_check
  check (leave_source is null or leave_source in ('request', 'coach_entry', 'dispute'));

alter table public.bookings drop constraint if exists bookings_cancel_reason_length_check;
alter table public.bookings add constraint bookings_cancel_reason_length_check
  check (cancel_reason is null or char_length(cancel_reason) <= 500);

create index if not exists idx_bookings_rescheduled_from
  on public.bookings (rescheduled_from_booking_id)
  where rescheduled_from_booking_id is not null;

-- 新增預約時自動補上取消期限（函式會自己帶值；這裡是保險）
create or replace function public.bookings_fill_cancel_deadline()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.cancel_deadline_at is null then
    select s.start_at - sv.cancel_deadline_hours * interval '1 hour'
      into new.cancel_deadline_at
      from public.availability_slots s
      join public.services sv on sv.id = s.service_id
     where s.id = new.slot_id;
  end if;
  return new;
end;
$$;

revoke execute on function public.bookings_fill_cancel_deadline() from public, anon, authenticated;

drop trigger if exists bookings_fill_cancel_deadline on public.bookings;
create trigger bookings_fill_cancel_deadline
  before insert on public.bookings
  for each row execute function public.bookings_fill_cancel_deadline();

-- customer_purchases.origin
alter table public.customer_purchases
  add column if not exists origin text not null default 'purchase';

comment on column public.customer_purchases.origin is '來源：purchase 一般購買 / makeup 補堂 / legacy 改版前合成的 1 堂紀錄';

alter table public.customer_purchases drop constraint if exists customer_purchases_origin_check;
alter table public.customer_purchases add constraint customer_purchases_origin_check
  check (origin in ('purchase', 'makeup', 'legacy'));
