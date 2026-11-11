-- Booking logic: concurrency-safe request function, state machine, audit log, rate limiter.

-- Seats currently held on a session (pending + approved).
create or replace function public.session_seats_taken(p_session_id uuid)
returns integer language sql stable as $$
  select coalesce(sum(participants), 0)::int
  from public.bookings
  where session_id = p_session_id and status in ('pending', 'approved');
$$;

-- ---------------------------------------------------------------------------
-- request_booking: the ONLY way a visitor creates a booking.
-- Locks the session row, so two simultaneous requests cannot oversell the last seats.
-- Price and capacity come from the database, never from the client.
-- Raises exceptions with stable messages the API maps to HTTP errors:
--   SESSION_NOT_FOUND, SESSION_CANCELLED, SESSION_PAST, CLASS_UNAVAILABLE,
--   SESSION_FULL, DUPLICATE_BOOKING
-- ---------------------------------------------------------------------------
create or replace function public.request_booking(
  p_session_id uuid,
  p_full_name text,
  p_email text,
  p_phone text,
  p_participants integer,
  p_message text,
  p_privacy_consent boolean
) returns table (booking_id uuid, reference text, seats_left integer)
language plpgsql security definer set search_path = public as $$
declare
  s public.class_sessions;
  c public.classes;
  taken integer;
  new_id uuid;
  new_ref text;
  unit integer;
begin
  select * into s from public.class_sessions where id = p_session_id for update;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;

  select * into c from public.classes where id = s.class_id;
  if c.status <> 'published' then raise exception 'CLASS_UNAVAILABLE'; end if;
  if s.status <> 'scheduled' then raise exception 'SESSION_CANCELLED'; end if;
  if s.starts_at <= now() then raise exception 'SESSION_PAST'; end if;

  taken := public.session_seats_taken(s.id);
  if taken + p_participants > s.capacity then raise exception 'SESSION_FULL'; end if;

  unit := c.price_cents;

  begin
    insert into public.bookings (session_id, full_name, email, phone, participants, message,
                                 privacy_consent, status, unit_price_cents, total_price_cents, currency)
    values (s.id, btrim(p_full_name), btrim(p_email), nullif(btrim(coalesce(p_phone, '')), ''),
            p_participants, nullif(btrim(coalesce(p_message, '')), ''), p_privacy_consent, 'pending',
            unit, case when unit is null then null else unit * p_participants end, c.currency)
    returning id, bookings.reference into new_id, new_ref;
  exception when unique_violation then
    raise exception 'DUPLICATE_BOOKING';
  end;

  return query select new_id, new_ref, (s.capacity - taken - p_participants);
end $$;

revoke all on function public.request_booking(uuid, text, text, text, integer, text, boolean) from public, anon, authenticated;
grant execute on function public.request_booking(uuid, text, text, text, integer, text, boolean) to service_role;

-- ---------------------------------------------------------------------------
-- Status state machine (enforced in the database, regardless of which client updates):
--   pending  -> approved | rejected | cancelled
--   approved -> cancelled
--   rejected, cancelled are terminal
-- Core booking facts are immutable after creation.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_booking_rules()
returns trigger language plpgsql as $$
begin
  if new.session_id <> old.session_id
     or new.participants <> old.participants
     or new.email <> old.email
     or new.unit_price_cents is distinct from old.unit_price_cents
     or new.total_price_cents is distinct from old.total_price_cents then
    raise exception 'BOOKING_IMMUTABLE_FIELDS' using errcode = '42501';
  end if;

  if new.status <> old.status then
    if not (
      (old.status = 'pending'  and new.status in ('approved', 'rejected', 'cancelled')) or
      (old.status = 'approved' and new.status = 'cancelled')
    ) then
      raise exception 'INVALID_STATUS_TRANSITION: % -> %', old.status, new.status;
    end if;
    new.decided_at = now();
  end if;
  return new;
end $$;

create trigger bookings_rules before update on public.bookings
  for each row execute function public.enforce_booking_rules();

-- Audit log
create or replace function public.log_booking_event()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.booking_events (booking_id, event, to_status) values (new.id, 'created', new.status);
  elsif new.status <> old.status then
    insert into public.booking_events (booking_id, event, from_status, to_status, actor)
    values (new.id, 'status_changed', old.status, new.status, auth.uid());
  elsif new.admin_notes is distinct from old.admin_notes then
    insert into public.booking_events (booking_id, event, actor, note)
    values (new.id, 'note_updated', auth.uid(), new.admin_notes);
  end if;
  return new;
end $$;

create trigger bookings_audit_ins after insert on public.bookings
  for each row execute function public.log_booking_event();
create trigger bookings_audit_upd after update on public.bookings
  for each row execute function public.log_booking_event();

-- Don't let admins shrink a session below seats already held.
create or replace function public.guard_session_capacity()
returns trigger language plpgsql as $$
begin
  if new.capacity < public.session_seats_taken(new.id) then
    raise exception 'CAPACITY_BELOW_BOOKED_SEATS';
  end if;
  return new;
end $$;
create trigger class_sessions_capacity before update of capacity on public.class_sessions
  for each row execute function public.guard_session_capacity();

-- When a session is cancelled, cancel its live bookings (admin is notified by the app layer).
create or replace function public.cascade_session_cancellation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    update public.bookings set status = 'cancelled',
           admin_notes = trim(both E'\n' from coalesce(admin_notes, '') || E'\nSession cancelled.')
     where session_id = new.id and status in ('pending', 'approved');
  end if;
  return new;
end $$;
create trigger class_sessions_cancel_cascade after update of status on public.class_sessions
  for each row execute function public.cascade_session_cancellation();

-- ---------------------------------------------------------------------------
-- Public availability view data: seats left per upcoming session.
-- Exposes ONLY counts, never booking rows or personal data.
-- ---------------------------------------------------------------------------
create or replace function public.session_availability(p_from timestamptz, p_to timestamptz)
returns table (
  session_id uuid, class_id uuid, starts_at timestamptz, ends_at timestamptz,
  capacity integer, seats_left integer, status text, location_override text
)
language sql stable security definer set search_path = public as $$
  select s.id, s.class_id, s.starts_at, s.ends_at, s.capacity,
         greatest(s.capacity - public.session_seats_taken(s.id), 0), s.status, s.location_override
  from public.class_sessions s
  join public.classes c on c.id = s.class_id and c.status = 'published'
  where s.starts_at >= p_from and s.starts_at < p_to
  order by s.starts_at;
$$;
grant execute on function public.session_availability(timestamptz, timestamptz) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Rate limiter: returns true if the call is allowed.
-- ---------------------------------------------------------------------------
create or replace function public.check_rate_limit(p_key text, p_max integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  w timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  h integer;
begin
  insert into public.rate_limits (key, window_start, hits) values (p_key, w, 1)
  on conflict (key, window_start) do update set hits = public.rate_limits.hits + 1
  returning hits into h;

  -- opportunistic cleanup
  if random() < 0.02 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;
  return h <= p_max;
end $$;

revoke all on function public.check_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, integer, integer) to service_role;
