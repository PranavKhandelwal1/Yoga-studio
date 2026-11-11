-- 0006: reminder emails, guest self-cancellation (with a policy window), retreat deposits.
-- Safe to run once on top of 0001–0005.

-- ---------------------------------------------------------------------------
-- 1. Reminder emails: remember which bookings were already reminded, so a cron run can never email twice.
-- ---------------------------------------------------------------------------
alter table public.bookings add column if not exists reminder_sent_at timestamptz;
create index if not exists bookings_reminder_idx on public.bookings (session_id) where status = 'approved' and reminder_sent_at is null;

-- Atomically claims approved, not-yet-reminded bookings whose class starts within the next p_hours hours.
-- "Claims" = stamps reminder_sent_at and returns the ids, so two overlapping cron runs can't both send.
create or replace function public.claim_booking_reminders(p_hours integer default 30)
returns table (booking_id uuid)
language plpgsql security definer set search_path = public as $$
begin
  return query
  with due as (
    select b.id from public.bookings b
      join public.class_sessions s on s.id = b.session_id
     where b.status = 'approved' and b.reminder_sent_at is null
       and s.status = 'scheduled' and s.starts_at > now() and s.starts_at <= now() + make_interval(hours => p_hours)
     for update of b skip locked
  )
  update public.bookings b set reminder_sent_at = now() from due where b.id = due.id returning b.id;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Guest self-cancellation. The guest must supply BOTH reference and email; cancelling is only allowed
--    until p_min_hours before the class starts (the cancellation policy). Returns whether a refund is due.
-- ---------------------------------------------------------------------------
create or replace function public.customer_cancel_booking(p_reference text, p_email text, p_min_hours integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare b public.bookings; v_start timestamptz;
begin
  select * into b from public.bookings where reference = upper(trim(p_reference)) and lower(email) = lower(trim(p_email)) for update;
  if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
  if b.status not in ('pending', 'approved') then raise exception 'NOT_CANCELLABLE'; end if;
  select starts_at into v_start from public.class_sessions where id = b.session_id;
  if v_start - now() < make_interval(hours => greatest(p_min_hours, 0)) then raise exception 'TOO_LATE'; end if;
  update public.bookings set status = 'cancelled',
         admin_notes = trim(both E'\n' from coalesce(admin_notes, '') || E'\nCancelled by the guest.')
   where id = b.id;
  return jsonb_build_object('booking_id', b.id, 'paid', b.payment_status = 'paid');
end $$;

-- ---------------------------------------------------------------------------
-- 3. Retreat deposits
-- ---------------------------------------------------------------------------
alter table public.retreats add column if not exists deposit_cents integer check (deposit_cents is null or deposit_cents >= 0);

alter table public.retreat_enquiries
  add column if not exists reference text not null default upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8)),
  add column if not exists deposit_cents integer,
  add column if not exists payment_status text not null default 'not_required' check (payment_status in ('unpaid', 'paid', 'refunded', 'not_required')),
  add column if not exists payment_provider text check (payment_provider in ('stripe', 'paypal')),
  add column if not exists stripe_session_id text,
  add column if not exists stripe_payment_intent text,
  add column if not exists paypal_order_id text,
  add column if not exists paypal_capture_id text,
  add column if not exists amount_paid_cents integer,
  add column if not exists paid_at timestamptz;
create unique index if not exists retreat_enquiries_reference_uq on public.retreat_enquiries (reference);
create unique index if not exists retreat_enquiries_stripe_uq on public.retreat_enquiries (stripe_session_id) where stripe_session_id is not null;
create unique index if not exists retreat_enquiries_paypal_uq on public.retreat_enquiries (paypal_order_id) where paypal_order_id is not null;

-- Confirms a paid deposit (Stripe or PayPal). Idempotent. Locks the retreat row so two simultaneous payments
-- can never take more places than exist. If the retreat filled up in the meantime the payment is flagged for refund.
create or replace function public.confirm_retreat_deposit(p_enquiry_id uuid, p_provider text, p_ref text, p_intent text, p_amount integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare e public.retreat_enquiries; r public.retreats;
begin
  select * into e from public.retreat_enquiries where id = p_enquiry_id for update;
  if not found then raise exception 'ENQUIRY_NOT_FOUND'; end if;
  if p_provider not in ('stripe', 'paypal') then raise exception 'BAD_PROVIDER'; end if;
  if (p_provider = 'stripe' and e.stripe_session_id is distinct from p_ref) or (p_provider = 'paypal' and e.paypal_order_id is distinct from p_ref) then
    raise exception 'PAYMENT_REFERENCE_MISMATCH';
  end if;
  if e.deposit_cents is null or p_amount is distinct from e.deposit_cents then raise exception 'AMOUNT_MISMATCH'; end if;
  if e.payment_status in ('paid', 'refunded') then
    return jsonb_build_object('changed', false, 'needs_refund', false, 'status', e.status);
  end if;

  select * into r from public.retreats where id = e.retreat_id for update;
  if r.capacity is not null and r.capacity - r.places_taken < e.participants then
    update public.retreat_enquiries set payment_status = 'paid', payment_provider = p_provider, amount_paid_cents = p_amount, paid_at = now(),
           stripe_payment_intent = case when p_provider = 'stripe' then p_intent else stripe_payment_intent end,
           paypal_capture_id = case when p_provider = 'paypal' then p_intent else paypal_capture_id end,
           admin_notes = trim(both E'\n' from coalesce(admin_notes, '') || E'\nPaid after the retreat filled up — refund required.')
     where id = e.id;
    return jsonb_build_object('changed', true, 'needs_refund', true, 'status', e.status);
  end if;

  update public.retreats set places_taken = places_taken + e.participants where id = r.id;
  update public.retreat_enquiries set status = 'confirmed', payment_status = 'paid', payment_provider = p_provider, amount_paid_cents = p_amount, paid_at = now(),
         stripe_payment_intent = case when p_provider = 'stripe' then p_intent else stripe_payment_intent end,
         paypal_capture_id = case when p_provider = 'paypal' then p_intent else paypal_capture_id end
   where id = e.id;
  return jsonb_build_object('changed', true, 'needs_refund', false, 'status', 'confirmed');
end $$;

-- Marks a deposit refunded and gives the places back (only if they were actually taken). Idempotent.
create or replace function public.refund_retreat_deposit(p_enquiry_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare e public.retreat_enquiries;
begin
  select * into e from public.retreat_enquiries where id = p_enquiry_id for update;
  if not found or e.payment_status <> 'paid' then return false; end if;
  if e.status = 'confirmed' then
    update public.retreats set places_taken = greatest(places_taken - e.participants, 0) where id = e.retreat_id;
  end if;
  update public.retreat_enquiries set payment_status = 'refunded', status = 'closed' where id = e.id;
  return true;
end $$;

revoke all on function public.claim_booking_reminders(integer) from public, anon, authenticated;
revoke all on function public.customer_cancel_booking(text, text, integer) from public, anon, authenticated;
revoke all on function public.confirm_retreat_deposit(uuid, text, text, text, integer) from public, anon, authenticated;
revoke all on function public.refund_retreat_deposit(uuid) from public, anon, authenticated;
grant execute on function public.claim_booking_reminders(integer) to service_role;
grant execute on function public.customer_cancel_booking(text, text, integer) to service_role;
grant execute on function public.confirm_retreat_deposit(uuid, text, text, text, integer) to service_role;
grant execute on function public.refund_retreat_deposit(uuid) to service_role;
