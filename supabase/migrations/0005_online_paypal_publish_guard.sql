-- 0005: online classes, "no publishing without a date", PayPal payments.
-- Safe to run once on top of 0001–0004.

-- ---------------------------------------------------------------------------
-- 1. Online classes
--    `delivery` is public (it only says "online" or "in person").
--    The meeting link is PRIVATE: it lives in class_private (admin-only RLS) and is only ever emailed
--    to visitors whose booking is confirmed — it is never readable through the public API.
-- ---------------------------------------------------------------------------
alter table public.classes
  add column if not exists delivery text not null default 'in_person' check (delivery in ('in_person', 'online'));

create table if not exists public.class_private (
  class_id uuid primary key references public.classes(id) on delete cascade,
  online_url text check (online_url is null or online_url ~* '^https://'),
  updated_at timestamptz not null default now()
);
alter table public.class_private enable row level security;
drop policy if exists class_private_admin on public.class_private;
create policy class_private_admin on public.class_private for all using (public.is_admin()) with check (public.is_admin());
revoke all on public.class_private from anon;

-- ---------------------------------------------------------------------------
-- 2. A class can only be PUBLISHED while it has at least one upcoming (scheduled) session.
--    Enforced in the database so no code path (admin UI, API, SQL editor) can bypass it.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_class_has_date()
returns trigger language plpgsql as $$
begin
  if new.status = 'published' and not exists (
    select 1 from public.class_sessions s
     where s.class_id = new.id and s.status = 'scheduled' and s.starts_at > now()
  ) then
    raise exception 'PUBLISH_REQUIRES_SESSION: add at least one upcoming date before publishing this class'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists classes_publish_guard on public.classes;
create trigger classes_publish_guard before insert or update of status on public.classes
  for each row execute function public.enforce_class_has_date();

-- Classes that are already published but have no upcoming date are moved back to draft, so the
-- rule holds for existing data too (they simply wait for new dates).
update public.classes c set status = 'draft'
 where status = 'published'
   and not exists (select 1 from public.class_sessions s where s.class_id = c.id and s.status = 'scheduled' and s.starts_at > now());

-- ---------------------------------------------------------------------------
-- 3. PayPal (Orders v2). The payment provider is recorded per booking.
-- ---------------------------------------------------------------------------
alter table public.bookings
  add column if not exists payment_provider text check (payment_provider in ('stripe', 'paypal')),
  add column if not exists paypal_order_id text,
  add column if not exists paypal_capture_id text;
create unique index if not exists bookings_paypal_order_uq on public.bookings (paypal_order_id) where paypal_order_id is not null;

update public.bookings set payment_provider = 'stripe' where payment_provider is null and stripe_session_id is not null;

-- Same rules as confirm_booking_payment, keyed by the PayPal order. Idempotent. Returns { changed, status, needs_refund }.
create or replace function public.confirm_paypal_payment(p_booking_id uuid, p_order_id text, p_capture_id text, p_amount integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare b public.bookings;
begin
  select * into b from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
  if b.paypal_order_id is distinct from p_order_id then raise exception 'ORDER_MISMATCH'; end if;
  if p_amount is distinct from b.total_price_cents then raise exception 'AMOUNT_MISMATCH'; end if;

  if b.payment_status in ('paid', 'refunded') then
    return jsonb_build_object('changed', false, 'status', b.status, 'needs_refund', false);
  end if;

  if b.status <> 'pending' then
    update public.bookings set payment_status = 'paid', payment_provider = 'paypal', paypal_capture_id = p_capture_id, amount_paid_cents = p_amount, paid_at = now() where id = b.id;
    insert into public.booking_events (booking_id, event, note) values (b.id, 'payment_received', 'PayPal payment after the booking was ' || b.status || ' — refund required');
    return jsonb_build_object('changed', true, 'status', b.status, 'needs_refund', true);
  end if;

  update public.bookings set status = 'approved', payment_status = 'paid', payment_provider = 'paypal', paypal_capture_id = p_capture_id, amount_paid_cents = p_amount, paid_at = now() where id = b.id;
  insert into public.booking_events (booking_id, event, note) values (b.id, 'payment_received', 'PayPal payment received — booking confirmed automatically');
  return jsonb_build_object('changed', true, 'status', 'approved', 'needs_refund', false);
end $$;

-- Frees seats held by checkouts that were started but never paid (e.g. the visitor closed the PayPal tab).
-- Only bookings that actually went to a payment page are touched; manual-approval requests are left alone.
create or replace function public.release_stale_unpaid_bookings(p_minutes integer default 35)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  with r as (
    update public.bookings
       set status = 'cancelled', admin_notes = trim(both E'\n' from coalesce(admin_notes, '') || E'\nPayment not completed in time — seats released.')
     where status = 'pending' and payment_status = 'unpaid'
       and (stripe_session_id is not null or paypal_order_id is not null)
       and created_at < now() - make_interval(mins => p_minutes)
    returning 1)
  select count(*) into n from r;
  return n;
end $$;

revoke all on function public.confirm_paypal_payment(uuid, text, text, integer) from public, anon, authenticated;
revoke all on function public.release_stale_unpaid_bookings(integer) from public, anon, authenticated;
grant execute on function public.confirm_paypal_payment(uuid, text, text, integer) to service_role;
grant execute on function public.release_stale_unpaid_bookings(integer) to service_role;
