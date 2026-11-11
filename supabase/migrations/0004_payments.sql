-- Online payments (Stripe Checkout). Visitors pay first; a successful payment confirms the booking automatically.
-- Payment state lives on the booking. All payment functions are callable ONLY by the server (service role).

alter table public.bookings
  add column if not exists payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'paid', 'refunded', 'not_required')),
  add column if not exists stripe_session_id text,
  add column if not exists stripe_payment_intent text,
  add column if not exists amount_paid_cents integer check (amount_paid_cents is null or amount_paid_cents >= 0),
  add column if not exists paid_at timestamptz;

create unique index if not exists bookings_stripe_session_uq on public.bookings (stripe_session_id) where stripe_session_id is not null;
create index if not exists bookings_payment_idx on public.bookings (payment_status, status);

-- Free / price-on-request bookings need no payment (they stay PENDING for manual approval).
create or replace function public.set_initial_payment_status()
returns trigger language plpgsql as $$
begin
  if coalesce(new.total_price_cents, 0) = 0 then new.payment_status := 'not_required'; end if;
  return new;
end $$;
drop trigger if exists bookings_payment_default on public.bookings;
create trigger bookings_payment_default before insert on public.bookings
  for each row execute function public.set_initial_payment_status();

-- Called after Stripe confirms payment. Idempotent (webhook + success page may both call it).
-- Returns { changed, status, needs_refund }.
create or replace function public.confirm_booking_payment(p_booking_id uuid, p_session_id text, p_payment_intent text, p_amount integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare b public.bookings;
begin
  select * into b from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
  if b.stripe_session_id is distinct from p_session_id then raise exception 'SESSION_MISMATCH'; end if;
  if p_amount is distinct from b.total_price_cents then raise exception 'AMOUNT_MISMATCH'; end if;

  if b.payment_status in ('paid', 'refunded') then
    return jsonb_build_object('changed', false, 'status', b.status, 'needs_refund', false);
  end if;

  if b.status <> 'pending' then
    -- Money arrived for a booking that was already cancelled/rejected: record it; the app refunds it.
    update public.bookings set payment_status = 'paid', stripe_payment_intent = p_payment_intent, amount_paid_cents = p_amount, paid_at = now() where id = b.id;
    insert into public.booking_events (booking_id, event, note) values (b.id, 'payment_received', 'Paid after the booking was ' || b.status || ' — refund required');
    return jsonb_build_object('changed', true, 'status', b.status, 'needs_refund', true);
  end if;

  update public.bookings set status = 'approved', payment_status = 'paid', stripe_payment_intent = p_payment_intent, amount_paid_cents = p_amount, paid_at = now() where id = b.id;
  insert into public.booking_events (booking_id, event, note) values (b.id, 'payment_received', 'Payment received — booking confirmed automatically');
  return jsonb_build_object('changed', true, 'status', 'approved', 'needs_refund', false);
end $$;

-- Releases the seats held by a booking whose payment was abandoned / expired. Never touches paid bookings.
create or replace function public.release_unpaid_booking(p_booking_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update public.bookings
     set status = 'cancelled', admin_notes = trim(both E'\n' from coalesce(admin_notes, '') || E'\nPayment not completed — seats released.')
   where id = p_booking_id and status = 'pending' and payment_status = 'unpaid';
  return found;
end $$;

create or replace function public.mark_booking_refunded(p_booking_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update public.bookings set payment_status = 'refunded' where id = p_booking_id and payment_status = 'paid';
  if found then insert into public.booking_events (booking_id, event, note) values (p_booking_id, 'refunded', 'Payment refunded'); end if;
  return found;
end $$;

revoke all on function public.confirm_booking_payment(uuid, text, text, integer) from public, anon, authenticated;
revoke all on function public.release_unpaid_booking(uuid) from public, anon, authenticated;
revoke all on function public.mark_booking_refunded(uuid) from public, anon, authenticated;
grant execute on function public.confirm_booking_payment(uuid, text, text, integer) to service_role;
grant execute on function public.release_unpaid_booking(uuid) to service_role;
grant execute on function public.mark_booking_refunded(uuid) to service_role;
