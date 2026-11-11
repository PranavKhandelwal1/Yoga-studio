-- Be With Yoga 2.0 — core schema
-- Timezone note: all timestamps are timestamptz (UTC). The app renders them in Europe/Madrid.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- profiles (1:1 with auth.users). Role 'admin' is the only role that unlocks management.
-- New auth users get role 'user' (no privileges). Admins are promoted via scripts/create-admin.ts.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''), 'user')
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Prevent privilege escalation: a role change is only allowed for service_role / postgres
-- (i.e. server scripts), never through a user JWT.
create or replace function public.guard_profile_role()
returns trigger language plpgsql as $$
begin
  if new.role is distinct from old.role and coalesce(auth.role(), 'service_role') not in ('service_role') then
    raise exception 'role changes are not permitted' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger profiles_guard_role before update on public.profiles
  for each row execute function public.guard_profile_role();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin');
$$;

-- ---------------------------------------------------------------------------
-- classes & sessions
-- ---------------------------------------------------------------------------
create table public.classes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null,
  summary text,
  description text,
  style text,
  duration_minutes integer not null default 90 check (duration_minutes between 10 and 600),
  price_cents integer check (price_cents is null or price_cents >= 0),   -- null = "price on request"
  currency text not null default 'EUR',
  location_name text,
  location_address text,
  map_url text,
  teacher_name text,
  teacher_bio text,
  image_url text,
  image_alt text,
  default_capacity integer not null default 10 check (default_capacity between 1 and 500),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  sort_order integer not null default 0,
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index classes_status_sort_idx on public.classes (status, sort_order);
create trigger classes_updated before update on public.classes
  for each row execute function public.set_updated_at();

create table public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity integer not null check (capacity between 1 and 500),
  status text not null default 'scheduled' check (status in ('scheduled', 'cancelled')),
  cancel_reason text,
  location_override text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  unique (class_id, starts_at)
);
create index class_sessions_starts_idx on public.class_sessions (starts_at);
create index class_sessions_class_idx on public.class_sessions (class_id, starts_at);
create trigger class_sessions_updated before update on public.class_sessions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- bookings (+ audit history)
-- Seats are held by 'pending' AND 'approved' bookings. Seat price is snapshotted server-side.
-- ---------------------------------------------------------------------------
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default upper(substr(encode(gen_random_bytes(5), 'hex'), 1, 8)),
  session_id uuid not null references public.class_sessions(id) on delete restrict,
  full_name text not null check (char_length(full_name) between 2 and 120),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254),
  phone text check (phone is null or char_length(phone) <= 40),
  participants integer not null default 1 check (participants between 1 and 10),
  message text check (message is null or char_length(message) <= 2000),
  privacy_consent boolean not null check (privacy_consent = true),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  unit_price_cents integer,            -- snapshot of class price at request time (server-set)
  total_price_cents integer,
  currency text not null default 'EUR',
  admin_notes text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index bookings_session_idx on public.bookings (session_id);
create index bookings_status_idx on public.bookings (status, created_at desc);
create index bookings_email_idx on public.bookings (lower(email));
-- Duplicate protection: one live booking per email per session.
create unique index bookings_unique_active_email
  on public.bookings (session_id, lower(email)) where status in ('pending', 'approved');
create trigger bookings_updated before update on public.bookings
  for each row execute function public.set_updated_at();

create table public.booking_events (
  id bigint generated always as identity primary key,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  event text not null,                 -- created | status_changed | note_updated
  from_status text,
  to_status text,
  actor uuid,                          -- auth.uid() of admin, null for visitor/system
  note text,
  created_at timestamptz not null default now()
);
create index booking_events_booking_idx on public.booking_events (booking_id, created_at);

-- ---------------------------------------------------------------------------
-- retreats & enquiries
-- ---------------------------------------------------------------------------
create table public.retreats (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null,
  summary text,
  description text,
  location text,
  start_date date,
  end_date date,
  price_cents integer check (price_cents is null or price_cents >= 0),
  currency text not null default 'EUR',
  capacity integer check (capacity is null or capacity >= 0),
  places_taken integer not null default 0 check (places_taken >= 0),
  programme jsonb not null default '[]'::jsonb,   -- [{ "title": "...", "description": "..." }]
  hero_image_url text,
  hero_image_alt text,
  gallery jsonb not null default '[]'::jsonb,     -- [{ "url": "...", "alt": "..." }]
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  is_featured boolean not null default false,
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);
create index retreats_status_idx on public.retreats (status, start_date);
create trigger retreats_updated before update on public.retreats
  for each row execute function public.set_updated_at();

create table public.retreat_enquiries (
  id uuid primary key default gen_random_uuid(),
  retreat_id uuid not null references public.retreats(id) on delete cascade,
  kind text not null default 'enquiry' check (kind in ('enquiry', 'booking_request')),
  full_name text not null check (char_length(full_name) between 2 and 120),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text,
  participants integer not null default 1 check (participants between 1 and 20),
  message text check (message is null or char_length(message) <= 4000),
  privacy_consent boolean not null check (privacy_consent = true),
  status text not null default 'new' check (status in ('new', 'contacted', 'confirmed', 'closed')),
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index retreat_enquiries_retreat_idx on public.retreat_enquiries (retreat_id, created_at desc);
create index retreat_enquiries_status_idx on public.retreat_enquiries (status);
create trigger retreat_enquiries_updated before update on public.retreat_enquiries
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- CMS: pages, settings, gallery, testimonials
-- ---------------------------------------------------------------------------
create table public.pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,                        -- home | about | ...
  title text not null,
  content jsonb not null default '{}'::jsonb,       -- section key -> value (see lib/content/schema.ts)
  seo_title text,
  seo_description text,
  og_image_url text,
  status text not null default 'published' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger pages_updated before update on public.pages
  for each row execute function public.set_updated_at();

create table public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create trigger site_settings_updated before update on public.site_settings
  for each row execute function public.set_updated_at();

create table public.gallery_images (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  alt text not null default '',
  caption text,
  category text not null default 'general',
  width integer,
  height integer,
  sort_order integer not null default 0,
  status text not null default 'published' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index gallery_status_sort_idx on public.gallery_images (status, sort_order);
create index gallery_category_idx on public.gallery_images (category);
create trigger gallery_updated before update on public.gallery_images
  for each row execute function public.set_updated_at();

create table public.testimonials (
  id uuid primary key default gen_random_uuid(),
  author_name text not null,
  author_detail text,
  quote text not null,
  sort_order integer not null default 0,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger testimonials_updated before update on public.testimonials
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Journal
-- ---------------------------------------------------------------------------
create table public.blog_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null,
  excerpt text,
  body text not null default '',                  -- Markdown
  featured_image_url text,
  featured_image_alt text,
  category_id uuid references public.blog_categories(id) on delete set null,
  author_name text,
  status text not null default 'draft' check (status in ('draft', 'published')),
  -- A published post with a future published_at is "scheduled" and invisible until that time.
  published_at timestamptz,
  seo_title text,
  seo_description text,
  search tsvector generated always as (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(excerpt, '') || ' ' || coalesce(body, ''))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index blog_posts_published_idx on public.blog_posts (status, published_at desc);
create index blog_posts_category_idx on public.blog_posts (category_id);
create index blog_posts_search_idx on public.blog_posts using gin (search);
create trigger blog_posts_updated before update on public.blog_posts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Newsletter & contact
-- ---------------------------------------------------------------------------
create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  status text not null default 'subscribed' check (status in ('subscribed', 'unsubscribed')),
  source text,
  subscribed_at timestamptz not null default now(),
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index newsletter_email_unique on public.newsletter_subscribers (lower(email));
create trigger newsletter_updated before update on public.newsletter_subscribers
  for each row execute function public.set_updated_at();

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text,
  subject text,
  message text not null check (char_length(message) between 5 and 4000),
  privacy_consent boolean not null check (privacy_consent = true),
  status text not null default 'new' check (status in ('new', 'read', 'replied', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index contact_messages_status_idx on public.contact_messages (status, created_at desc);
create trigger contact_messages_updated before update on public.contact_messages
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Rate limiting (durable across serverless instances). Accessed only via service role.
-- ---------------------------------------------------------------------------
create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits integer not null default 1,
  primary key (key, window_start)
);
create index rate_limits_window_idx on public.rate_limits (window_start);
