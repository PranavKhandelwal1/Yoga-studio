# Testing report

Run on 2026-11-05 in the build sandbox (Node 22, PostgreSQL 16, headless Chromium). **No live Supabase project, Resend account or Vercel deployment was available**, so everything that needs them is listed as *not verified* below — please run the short "first deploy" check at the end.

## Verified (automated, re-runnable)
| Requirement | Result | How |
|---|---|---|
| `npm install` succeeds | ✅ | clean install |
| TypeScript compiles | ✅ | `npm run typecheck`; scripts also type-checked |
| Production build succeeds | ✅ | `npm run build` — 21 public routes + 22 admin/API routes |
| Database migrations execute | ✅ | applied to a real PostgreSQL 16 by `npm run test:db` (Supabase `auth`/`storage` objects stubbed) |
| Booking requests save as PENDING, price computed server-side | ✅ | DB test |
| Capacity enforced; cannot overbook | ✅ | DB test |
| Concurrency safety | ✅ | 12 simultaneous requests for 3 seats → exactly 3 bookings |
| Duplicate bookings blocked (case-insensitive) | ✅ | DB test |
| Past / cancelled sessions and unpublished classes not bookable | ✅ | DB test |
| Approve / reject / cancel rules (state machine, audit log, immutable fields) | ✅ | DB test |
| Cancelling a session cancels its bookings; capacity can't drop below held seats | ✅ | DB test |
| RLS: anonymous & signed-in non-admins cannot read/modify bookings or private tables; cannot self-promote; only admins write storage | ✅ | DB tests (28 total) |
| Admin routes unreachable when signed out | ✅ | proxy unit test + live `curl` of the production server (307 → `/admin/login`); upload endpoint returns 401 |
| Input validation / honeypot / client-sent price, status, capacity ignored | ✅ | 32 unit tests |
| CSRF Origin check, upload magic-byte check, XSS-safe markdown, CSV formula injection | ✅ | unit tests |
| Mallorca time zone incl. DST changes | ✅ | unit tests + SQL |
| All public routes respond, 404s, legacy URL redirects, sitemap, robots | ✅ | live `curl` of `next start` |
| Responsive layout (390 / 820 / 1440 px): no horizontal overflow, no JS errors | ✅ | Playwright on 10 pages; screenshots of home reviewed |
| Image re-encode pipeline (resize → WebP) | ✅ | sharp executed in the sandbox |

| Payments: pay-first confirmation, idempotent confirm, wrong amount/session refused, abandoned payments release seats, late payment refunded, refunds recorded once, payment functions server-only | ✅ | 7 DB tests + 12 unit tests with a mocked Stripe |
| Stripe webhook: bad/missing signature rejected, expiry releases seats, failures return 500 so Stripe retries | ✅ | unit tests |

Totals: **48 unit tests + 35 database tests, all passing** (`npm test`, `npm run test:db`).

## Not verified here (needs real services)
- **Real Stripe payments** — the Stripe SDK calls are exercised only against mocks. Pay a test booking with card `4242 4242 4242 4242` (Stripe test mode) and check: redirect to Stripe, return to the success page, confirmation e-mail, booking shows *approved / paid*, and cancelling it refunds.
- **Webhook delivery** to the deployed URL (use *Send test webhook* in the Stripe dashboard).
- **Admin login / password reset against Supabase Auth** — code follows the documented `@supabase/ssr` flow; the role check is covered at database level, but a real sign-in was not performed.
- **Admin screens executing real writes** (classes, retreats, blog, gallery, content, newsletter, messages) — they build and type-check and use RLS-protected user-scoped queries, but were not clicked through against a live database. Expect small fixes on first use.
- **Image upload to Supabase Storage** — pipeline verified, bucket upload not.
- **E-mail delivery via Resend** — templates and sending code exist; nothing was sent.
- **`npm run migrate:wordpress`** — HTML→Markdown converter is unit-tested, but the outbound network was blocked in the sandbox so the live WordPress API call and image downloads were not run. Use `--dry-run` first.
- **Photographs** — the sandbox couldn't download the old site's images, so they are hot-linked (allow-listed in `next.config.ts`) rather than already in Supabase Storage; hero/about images show a "photo to be added" placeholder wherever a remote image can't load.
- **Core Web Vitals / Lighthouse** — not measured. Design choices (static prerendering with ISR, `next/image`, self-hosted fonts) target good scores.
- **Cross-browser** — only Chromium was tested.

## First-deploy check (10 minutes)
1. Run migrations, create the admin, sign in, log out, run "Forgot password".
2. Create a class + weekly sessions, publish it.
3. As a visitor: book it → see the confirmation → check the pending booking and e-mails.
4. In admin: approve it → visitor e-mail arrives; try booking more seats than remain (should be refused).
5. Upload an image in Gallery and in a Journal post; publish a post; schedule one for tomorrow.

## Round 3 additions (migration 0005)

Verified by automated tests (`npm test`: 65 unit tests; `npm run test:db`: 42 database tests against a real Postgres):
- A class cannot be created or updated to *published* without an upcoming session (enforced by a DB trigger).
- Online classes: the meeting link lives in an admin-only table and is never publicly readable.
- PayPal confirmation is idempotent, checks order and amount, flags refunds for late payments.
- Batch (weekly/monthly) session generation logic (unit tests).
- Production build passes; no horizontal overflow and a Back button on every inner page at 375 / 768 / 1440 px.

NOT verified (needs your accounts): a real PayPal sandbox payment, a real Stripe test payment, uploading a photo to your Supabase Storage, Resend delivery.

## Round 4 additions (migration 0006) — what is and isn't verified

Verified by automated tests (`npm test`: 70 unit tests; `npm run test:db`: 50 database tests on a real Postgres):
- Reminders: claimed once per booking, only approved bookings starting soon; a failed send releases the claim; the endpoint refuses to run without the right secret.
- Guest cancellation: needs reference + email (case-insensitive), refused inside the policy window, cannot be repeated, frees the seat.
- Retreat deposits: wrong amount / wrong payment reference refused; places taken once (idempotent); a payment arriving after the retreat filled up takes no places and is flagged for refund; refund releases places exactly once; the functions are not callable from a browser.
- Cancellation-window maths and settings parsing.

NOT verified (needs your accounts/keys): a real Stripe or PayPal deposit payment and refund, the Vercel cron actually firing, reminder email delivery via Resend, and the private-session form end-to-end against your Supabase.

## Audit fixes (November 2026)

Fixed and re-verified (type-check, 72 unit tests, 50 database tests, production build):

- Dashboard payment totals and the newsletter CSV export now read data page by page. Supabase returns at most 1,000 rows per request, so both would have silently stopped at 1,000.
- If an automatic refund fails for a payment that arrives after a booking was cancelled (or a retreat filled up), Angela now gets a "REFUND FAILED" email instead of the failure being silent. Covered by `tests/unit/refund-failure.test.ts`.
- The newsletter sign-up no longer treats `_` or `%` in an email address as wildcards when re-activating a subscriber.
- Message reply links encode the whole subject line.
- Password-reset pages are reachable before Supabase is configured (they used to redirect to the login page).

Still NOT verified: real Stripe/PayPal payments, Vercel cron firing, Resend delivery, Supabase Storage upload, and the admin screens against a live Supabase project.
