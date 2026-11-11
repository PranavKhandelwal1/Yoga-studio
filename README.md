# Be With Yoga 2.0

Full-stack website for Angela's yoga & retreat business in Mallorca — public site, online booking with admin approval, and a custom admin dashboard.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Framer Motion · Supabase (Postgres, Auth, Storage, RLS) · Zod · Resend · Vercel.

## What's included
| Area | Details |
|---|---|
| Public site | Home, About, Classes (+detail), Schedule (week / month / upcoming), Retreats (+detail, enquiry form), Gallery (masonry, lightbox, filters), Journal (search, categories, related), Contact (form, WhatsApp, map), Booking, Privacy, 404 |
| Booking | Visitor requests → stored as **PENDING** → admin e-mailed → admin approves / rejects / cancels → visitor e-mailed. Capacity, duplicate, past-date and cancelled-session rules enforced **inside Postgres** with row locking. Prices are computed server-side. |
| Admin `/admin` | Dashboard, bookings (search, filters, notes, history), classes + sessions (single & weekly recurring, cancel session), retreats + enquiries, content (home/about/privacy sections, SEO), gallery uploads, journal (drafts, scheduling, categories), testimonials, newsletter (search, CSV export, remove), messages, settings (contact / social). |
| Security | Supabase Auth (email+password, no public sign-up), role stored in `profiles`, RLS on every table, admin checked server-side on every page/action/route, DB-backed rate limiting, honeypot, Origin (CSRF) checks, Zod validation, upload magic-byte sniffing + re-encode, HSTS & security headers. |
| SEO | Per-page metadata, Open Graph, canonical URLs, JSON-LD, `sitemap.xml`, `robots.txt`, legacy WordPress URL redirects, `next/image` (AVIF/WebP, responsive, lazy). |

## 1. Run locally
```bash
npm install
cp .env.example .env.local      # then fill it in (step 2)
npm run dev                     # http://localhost:3000
```
Without Supabase variables the public site still renders (default content, empty lists) but bookings/admin are disabled.

## 2. Supabase setup
1. Create a project at <https://supabase.com> (region close to Spain, e.g. Frankfurt/Paris).
2. **Database:** SQL Editor → run the files in `supabase/migrations/` **in order**: `0001_schema.sql`, `0002_booking_logic.sql`, `0003_rls_storage_seed.sql`, `0004_payments.sql`, `0005_online_paypal_publish_guard.sql`, `0006_reminders_cancellation_deposits.sql`. (Paste each file's *contents* into the editor. If you set up earlier, only run `0004_payments.sql`.) (Or `supabase db push` with the Supabase CLI.) The last file also creates the public `media` storage bucket and seeds only facts taken from the current website (contact details, studio address, social links, the 6 known photographs).
3. **Auth → Providers → Email:** keep *Email* enabled; **disable "Allow new users to sign up"** (Authentication → Sign In / Providers) so nobody can register. Optionally enable "Confirm email".
4. **Auth → URL Configuration:** Site URL = `https://bewithyoga.live`; add redirect URLs `https://bewithyoga.live/admin/auth/callback` and `http://localhost:3000/admin/auth/callback`.
5. **Project Settings → API:** copy the URL, `anon` key and `service_role` key into `.env.local`. The service-role key is **server only** — never prefix it with `NEXT_PUBLIC_`.
6. **Create the first administrator** (one time, from your computer):
   ```bash
   # Put ADMIN_EMAIL and ADMIN_PASSWORD in .env.local (cmd/PowerShell do not understand VAR=value prefixes), then:
   npm run create:admin
   ```
   Sign in at `/admin/login`. "Forgot password?" sends a reset e-mail.

## 3. Online payments (Stripe)
Angela needs her own Stripe account (<https://stripe.com>, Spain, EUR) — payouts go to her bank account.
1. **Test first.** In the Stripe dashboard switch to *Test mode*, copy the **Secret key** (`sk_test_…`) into `STRIPE_SECRET_KEY`.
2. **Webhook (needed in production):** Developers → Webhooks → *Add endpoint* → URL `https://bewithyoga.live/api/stripe/webhook` → events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`. Copy its **Signing secret** (`whsec_…`) into `STRIPE_WEBHOOK_SECRET`.
3. **Local testing:** install the [Stripe CLI](https://stripe.com/docs/stripe-cli) and run `stripe listen --forward-to localhost:3000/api/stripe/webhook`; it prints a `whsec_…` for your `.env.local`. Even without the CLI the success page confirms paid bookings itself, but *expired/abandoned* payments are only released (a) when the visitor presses "back to site" on Stripe's page or (b) by the webhook.
4. Pay with the test card `4242 4242 4242 4242`, any future expiry, any CVC.
5. **Going live:** complete Stripe's business verification, switch to Live mode, put the live `sk_live_…` key and a new live webhook secret into Vercel's environment variables, and redeploy.
Until `STRIPE_SECRET_KEY` is set the site shows a red banner in the admin dashboard and uses manual approval.
Refunds are issued from the original payment; the refunded amount returns to the customer in 5–10 working days (Stripe's fees are generally not returned).

### PayPal (optional, alongside cards)
1. Create a PayPal **Business** account for Angela, then open <https://developer.paypal.com> → *Apps & Credentials*.
2. In **Sandbox** create an app, copy *Client ID* and *Secret* into `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, and set `PAYPAL_ENV=sandbox`. Restart `npm run dev`.
3. Book a class with the **PayPal** option and pay with a sandbox *personal* test account (developer.paypal.com → Testing tools → Sandbox accounts).
4. **Going live:** switch the dashboard to *Live*, create a live app, put the live keys in Vercel and set `PAYPAL_ENV=live`.
When both Stripe and PayPal are configured the booking form lets the visitor choose; with only one configured it is used automatically. No PayPal webhook is needed: the visitor is returned to `/book/paypal/return`, where the server captures the payment and checks its status and amount before confirming. If someone approves but never returns, nothing is captured (no money moves) and the held seats are released after 35 minutes.

## 4. E-mail (Resend)
1. Create an account at <https://resend.com>, add and verify the domain `bewithyoga.live` (DNS records: SPF + DKIM).
2. Create an API key → `RESEND_API_KEY`.
3. Set `EMAIL_FROM="Be With Yoga <bookings@bewithyoga.live>"` (an address on the verified domain) and `ADMIN_NOTIFICATION_EMAIL` (where booking/enquiry/contact alerts go).
4. E-mails sent: request received (visitor), new booking (admin), approved / rejected / cancelled (visitor), session cancelled (visitor), contact & retreat-enquiry alerts (admin).
If the keys are missing the app keeps working, logs a warning and the admin UI says "no email sent".

## Classes: dates, batches and online classes
- **No class goes live without a date.** A class can only be *Published* once it has at least one upcoming session (enforced in the database). Saving a class as Published without a date saves it as a draft and tells you why.
- **Batch scheduler** (class page → *Batch: whole week or month*): tick the days (or use a preset like Mon–Fri), choose a start date, a period (whole week / 2 weeks / 4 weeks / rest of the month / until a date), one or two class times, and create every session in one go. Existing or past dates are skipped, so it is safe to run again.
- **Online classes:** set *Format* to *Online* on the class and paste the Zoom/Meet link. The link is private — it is not shown on the website; it is emailed only when a booking is confirmed. Visitors can filter classes and the schedule by *Online*.
- **Gallery:** photos go live the moment they are uploaded and keep their own proportions. Add a short description to each afterwards (accessibility + SEO).

> **Upgrading an existing database:** run `supabase/migrations/0005_online_paypal_publish_guard.sql` in the Supabase SQL Editor (paste the file's *contents*). Any published class with no upcoming date is moved back to draft by this migration.

## Reminders, cancellations, deposits, private sessions

- **Reminder emails.** Confirmed bookings get a reminder email about a day before class (online classes include the private joining link). It runs from a Vercel Cron job (`vercel.json`, daily at 16:00 UTC → 17:00/18:00 in Mallorca). Set **`CRON_SECRET`** (any long random string) in Vercel's environment variables; Vercel sends it automatically as a Bearer token. Without it the endpoint refuses to run. Each booking is claimed in the database, so it can never be emailed twice, and a failed send is retried on the next run. Vercel's free plan allows one cron run per day — that is what this uses.
- **Cancellation policy.** *Admin → Settings → Booking & cancellation*: set the number of hours before class until guests can cancel online, and the policy wording shown on the booking page, class pages and in emails. Guests cancel from **Find my booking** with their reference + email; paid bookings are refunded automatically (card or PayPal). The window is enforced in the database. The defaults (24 hours, full refund) are a starting point — **confirm or change them before launch.**
- **Retreat deposits.** In *Admin → Retreats*, set a **Deposit per person**. Guests who request places then pay the deposit (card or PayPal) and their places are reserved automatically; if the retreat fills up while someone is paying, they are refunded automatically. Without a deposit (or without payments configured) the retreat form stays a simple request. *Refund deposit & release places* is on each enquiry. The balance is arranged directly with the guest.
- **Private sessions.** `/private` has an editable page (*Admin → Content → Private sessions*) and a request form. Requests land in *Admin → Messages* labelled "Private session request", and Angela replies by email. No prices are shown unless you write them into the page text.

## Before you go live — checklist
The admin **Dashboard** shows a live "Before you go live" list. In short:
1. Run migrations 0001–0006 in Supabase; disable public sign-ups; rotate any key or password that was ever shared or pasted into a screenshot/chat.
2. Add your own photographs (*Admin → Content*, *Gallery*, classes, retreats), write the About text, add real testimonials, describe each photo (alt text), set class prices/capacity.
3. Review the privacy policy (*Admin → Content → Privacy policy*) with a professional.
4. Vercel environment variables: Supabase keys, `NEXT_PUBLIC_SITE_URL=https://bewithyoga.live`, Stripe live keys + `STRIPE_WEBHOOK_SECRET` (webhook: `https://bewithyoga.live/api/stripe/webhook`), PayPal live keys + `PAYPAL_ENV=live`, Resend key, verified sender domain, `EMAIL_FROM`, `ADMIN_NOTIFICATION_EMAIL`, `CRON_SECRET`.
5. Verify `bewithyoga.live` in Resend (Domains → add DNS records) so email reaches everyone, not only your own address.
6. Make one real test booking and one test retreat deposit with small amounts, cancel/refund them, and check the emails.

## Google Business Profile (local search)
Not code — but the most useful thing for a Mallorca studio: claim or create the profile at <https://business.google.com>, add the studio address, opening hours/classes, photos and the website `https://bewithyoga.live`, and verify it (postcard or phone). The site already publishes structured data (name, address, phone) that matches it; keep the details identical everywhere.

## Languages (Spanish / German)
The site is English-only. Adding languages means translating every page, class, retreat and article (not only buttons), plus language-specific URLs for search engines. That is a separate project; if you want it, start with Spanish and German versions of Home, About, Classes and Retreats.

## 5. First-time content checklist (please read)
Nothing about Angela was invented. Before launch, in **/admin**:
- **Classes → "Group Yoga Class"** — create it and its weekly sessions (the old site lists Mon/Wed 18:00–20:00 and Fri 10:00–12:00 at Bodhana Wellness Centre). **Price and capacity are not on the old site — set them.** Then publish.
- **Content → About** — add Angela's own biography, philosophy and qualifications (empty sections are hidden / show a clear placeholder). Default text is limited to facts from the old site.
- **Content → Privacy policy** — replace the placeholder with a policy reviewed for GDPR.
- **Gallery** — add real descriptive alt text to the imported photos.
- **Testimonials** — add only real, permitted quotes.
- Import old journal posts: `npm run migrate:wordpress -- --dry-run`, then without `--dry-run` (needs internet; copies images to Supabase Storage and keeps the old slugs).

## 6. Deploy to Vercel
1. Push the project to GitHub and **Import** it in Vercel (framework: Next.js; defaults are fine).
2. Add the environment variables from `.env.example` (Production + Preview): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL`, `RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_NOTIFICATION_EMAIL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_ENV`, `CRON_SECRET`.
3. Deploy, then add the domain `bewithyoga.live` (Project → Domains) and update DNS at your registrar. Keep the old WordPress site live until DNS switches.
4. Re-check Supabase Auth URL configuration (step 2.4) uses the production domain.
5. Smoke test: place a test booking → approve it → confirm the e-mail → delete the test data.

## 7. Scripts
| Command | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Develop / production build / run build |
| `npm run typecheck` | TypeScript |
| `npm test` | Unit tests (validation, time zones, CSV, markdown safety, CSRF/upload guards, admin gate) |
| `npm run test:db` | Starts a throw-away local Postgres, applies the migrations and runs the booking/RLS integration tests (needs Postgres server binaries; no Supabase required) |
| `npm run create:admin` | Create/promote an administrator |
| `npm run migrate:wordpress` | Import posts and copy images from the old site |

## 8. Project layout
```
app/(public)/…   public pages          app/admin/…    admin (login + (panel) modules)
app/api/…        bookings, contact, newsletter, retreat-enquiries, admin/upload
components/      layout, booking, classes, retreats, gallery, journal, admin, ui
lib/             supabase/ auth/ validation/ email/ utils/ content/ data/ booking/
supabase/migrations/   SQL (schema, booking logic, RLS, storage, seed)
tests/           unit/ and db/       scripts/  create-admin, migrate-wordpress, test-db
proxy.ts         Next.js 16 proxy (formerly "middleware"): session refresh + /admin gate
```

## 9. Design decisions worth knowing
- **Seats are held by PENDING and APPROVED bookings**; rejected/cancelled bookings release them. A booking awaiting payment holds its places for 30 minutes, so two people can't pay for the last seat.
- **Payments:** card details never touch this site (Stripe's hosted page). Free classes and classes with no price are not charged and stay PENDING for manual approval.
- The studio map appears in the footer of every public page.
- **Permanent redirects** from old WordPress URLs use HTTP 308 (Next.js' permanent redirect, treated by search engines like 301).
- Content shown before an admin saves anything comes from `lib/content/defaults.ts`; once saved in the admin, database values win.
- Admin writes use the *signed-in user's* Supabase client, so RLS applies a second time; the service-role key is used only for visitor-facing inserts (bookings, contact, newsletter, enquiries) after validation and rate limiting.
