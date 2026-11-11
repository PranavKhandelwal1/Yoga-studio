-- Row Level Security. Default deny; explicit policies only.
-- Visitor writes (bookings, contact, newsletter, enquiries) go through server routes using the
-- service role, so NO anonymous insert/update policies exist on those tables.

alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.class_sessions enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_events enable row level security;
alter table public.retreats enable row level security;
alter table public.retreat_enquiries enable row level security;
alter table public.pages enable row level security;
alter table public.site_settings enable row level security;
alter table public.gallery_images enable row level security;
alter table public.testimonials enable row level security;
alter table public.blog_categories enable row level security;
alter table public.blog_posts enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.contact_messages enable row level security;
alter table public.rate_limits enable row level security;   -- no policies: service role only

-- profiles: a user can read their own row; admins read all. No client-side writes
-- (a trigger additionally blocks role changes).
create policy profiles_self_read on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy profiles_admin_update on public.profiles for update using (public.is_admin()) with check (public.is_admin());

-- Public read of published content
create policy classes_public_read on public.classes for select using (status = 'published');
create policy sessions_public_read on public.class_sessions for select using (
  exists (select 1 from public.classes c where c.id = class_id and c.status = 'published')
);
create policy retreats_public_read on public.retreats for select using (status = 'published');
create policy pages_public_read on public.pages for select using (status = 'published');
create policy settings_public_read on public.site_settings for select using (true);
create policy gallery_public_read on public.gallery_images for select using (status = 'published');
create policy testimonials_public_read on public.testimonials for select using (status = 'published');
create policy categories_public_read on public.blog_categories for select using (true);
create policy posts_public_read on public.blog_posts for select using (
  status = 'published' and published_at is not null and published_at <= now()
);

-- Admin: full access
do $$
declare t text;
begin
  foreach t in array array[
    'classes','class_sessions','bookings','booking_events','retreats','retreat_enquiries','pages',
    'site_settings','gallery_images','testimonials','blog_categories','blog_posts',
    'newsletter_subscribers','contact_messages'
  ] loop
    execute format('create policy %I on public.%I for all using (public.is_admin()) with check (public.is_admin())',
                   t || '_admin_all', t);
  end loop;
end $$;

-- Tighten privileges: anon never touches private tables at all (defence in depth on top of RLS).
revoke all on public.bookings, public.booking_events, public.retreat_enquiries,
              public.newsletter_subscribers, public.contact_messages, public.rate_limits,
              public.profiles from anon;

-- ---------------------------------------------------------------------------
-- Storage: public-read 'media' bucket, admin-only writes. Size/type limits enforced by bucket.
-- Folders: homepage/, portraits/, classes/, retreats/, gallery/, blog/
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do update set public = true, file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

create policy media_public_read on storage.objects for select using (bucket_id = 'media');
create policy media_admin_insert on storage.objects for insert with check (bucket_id = 'media' and public.is_admin());
create policy media_admin_update on storage.objects for update using (bucket_id = 'media' and public.is_admin());
create policy media_admin_delete on storage.objects for delete using (bucket_id = 'media' and public.is_admin());

-- ---------------------------------------------------------------------------
-- Seed: ONLY facts taken from the existing bewithyoga.live site (verified 2026-11-04).
-- Nothing is invented. Review each value in Admin > Settings before launch.
-- ---------------------------------------------------------------------------
insert into public.site_settings (key, value) values
  ('general', jsonb_build_object(
      'site_name', 'Be With Yoga',
      'tagline', 'Stay with an open heart',
      'teacher_name', 'Angela')),
  ('contact', jsonb_build_object(
      'email', 'bewithyoga@gmail.com',
      'phone', '+34 662 410 119',
      'whatsapp', '34662410119',
      'location', 'Puerto Portals, Mallorca, Spain',
      'studio_name', 'Bodhana Wellness Centre',
      'studio_address', 'Calle Benito Jerónimo Feijoo 2, Puerto Portals, Mallorca, Spain',
      'map_query', 'Bodhana Wellness Centre, Calle Benito Jerónimo Feijoo 2, Puerto Portals, Mallorca, Spain')),
  ('social', jsonb_build_object(
      'instagram', 'https://www.instagram.com/bewithyoga',
      'facebook', 'https://www.facebook.com/angela.s.santosa',
      'twitter', 'https://twitter.com/bewithyoga')),
  ('schedule_note', jsonb_build_object(
      'text', E'Group classes at Bodhana Wellness Centre: Mondays 18:00–20:00, Wednesdays 18:00–20:00, Fridays 10:00–12:00.'))
on conflict (key) do nothing;

insert into public.blog_categories (slug, name) values ('journal', 'Journal') on conflict (slug) do nothing;

-- Existing authentic photographs from the current site. They are hot-linked until you run
-- `npm run migrate:wordpress`, which copies them into Supabase Storage and rewrites these URLs.
insert into public.gallery_images (url, alt, category, sort_order)
select * from (values
  ('https://bewithyoga.live/wp-content/uploads/2020/10/122036635_10223193197128847_4541167618081591532_o.jpg', 'Angela practising yoga', 'practice', 1),
  ('https://bewithyoga.live/wp-content/uploads/2019/06/62532142_10218773372115984_923381087755829248_n.jpg', 'Yoga retreat in Mallorca', 'retreats', 2),
  ('https://bewithyoga.files.wordpress.com/2017/04/dscn3990-e1491142252229.jpg', 'Angela, yoga teacher in Mallorca', 'portraits', 3),
  ('https://bewithyoga.files.wordpress.com/2016/10/10555239_10153380159591317_219961796_n.jpg', 'Yoga class with Angela', 'classes', 4),
  ('https://bewithyoga.files.wordpress.com/2017/04/img-20160522-wa0001-e1491142538708.jpg', 'Yoga moment from the Be With Yoga gallery', 'practice', 5),
  ('https://bewithyoga.live/wp-content/uploads/2023/05/400591.jpg', 'Yoga retreat setting in Mallorca', 'retreats', 6)
) as v(url, alt, category, sort_order)
where not exists (select 1 from public.gallery_images);
