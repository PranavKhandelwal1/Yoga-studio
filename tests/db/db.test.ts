/**
 * Database integration tests: run the real migrations on a real Postgres and verify booking
 * integrity (capacity, duplicates, concurrency, state machine) and Row Level Security.
 * Run with `npm run test:db` (spins up a throwaway Postgres). Skipped when TEST_DATABASE_URL is unset.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const URL = process.env.TEST_DATABASE_URL;
const d = URL ? describe : describe.skip;
const root = path.resolve(__dirname, "../..");

let admin: Client; // superuser connection (migrations / fixtures)
const ADMIN_ID = "00000000-0000-0000-0000-0000000000a1";
const USER_ID = "00000000-0000-0000-0000-0000000000b2";

async function connect() { const c = new Client({ connectionString: URL }); await c.connect(); return c; }

/** Run `fn` as a Supabase role (anon | authenticated | service_role) with optional JWT subject. */
async function as<T>(role: string, uid: string | null, fn: (c: Client) => Promise<T>): Promise<T> {
  const c = await connect();
  try {
    await c.query(`set role ${role}`);
    await c.query("select set_config('request.jwt.claim.role', $1, false), set_config('request.jwt.claim.sub', $2, false)", [role, uid ?? ""]);
    return await fn(c);
  } finally { await c.end(); }
}
const rejects = async (p: Promise<unknown>, re: RegExp) => { await expect(p).rejects.toThrow(re); };

let classId: string, draftClassId: string;
const future = (days: number, hour = 10) => new Date(Date.now() + days * 864e5 + hour * 36e5).toISOString();
async function mkSession(capacity: number, opts: { days?: number; cls?: string } = {}) {
  const start = new Date(Date.now() + (opts.days ?? 7) * 864e5);
  const r = await admin.query(
    `insert into class_sessions (class_id, starts_at, ends_at, capacity) values ($1,$2,$3,$4) returning id`,
    [opts.cls ?? classId, start, new Date(+start + 36e5), capacity]);
  return r.rows[0].id as string;
}
const book = (c: Client, sid: string, email: string, n = 1) =>
  c.query("select * from request_booking($1,$2,$3,$4,$5,$6,$7)", [sid, "Test Person", email, null, n, null, true]);

d("database", () => {
  beforeAll(async () => {
    admin = await connect();
    const has = await admin.query("select to_regclass('public.bookings') as t");
    if (!has.rows[0].t) {
      await admin.query(readFileSync(path.join(__dirname, "supabase-stub.sql"), "utf8"));
      for (const f of readdirSync(path.join(root, "supabase/migrations")).sort())
        await admin.query(readFileSync(path.join(root, "supabase/migrations", f), "utf8"));
    }
    await admin.query("insert into auth.users (id, email) values ($1,'admin@test.dev'), ($2,'user@test.dev') on conflict do nothing", [ADMIN_ID, USER_ID]);
    await admin.query("update profiles set role='admin' where id=$1", [ADMIN_ID]); // superuser = service role context
    // A class can only be published once it has an upcoming session (DB rule), so: draft → session → publish.
    classId = (await admin.query("insert into classes (slug,title,status,price_cents) values ('t-class','Test class','draft',2000) returning id")).rows[0].id;
    await admin.query("insert into class_sessions (class_id,starts_at,ends_at,capacity) values ($1, now() + interval '300 days', now() + interval '300 days 1 hour', 5)", [classId]);
    await admin.query("update classes set status='published' where id=$1", [classId]);
    draftClassId = (await admin.query("insert into classes (slug,title,status) values ('t-draft','Draft class','draft') returning id")).rows[0].id;
  });
  afterAll(async () => { await admin?.end(); });

  describe("migrations", () => {
    it("creates all 14 required tables", async () => {
      const need = ["profiles","classes","class_sessions","bookings","retreats","retreat_enquiries","pages","blog_posts","blog_categories","gallery_images","testimonials","newsletter_subscribers","contact_messages","site_settings"];
      const r = await admin.query("select tablename from pg_tables where schemaname='public'");
      const have = r.rows.map((x) => x.tablename);
      for (const t of need) expect(have).toContain(t);
    });
    it("enables RLS on every public table", async () => {
      const r = await admin.query("select tablename from pg_tables t join pg_class c on c.relname=t.tablename and c.relnamespace='public'::regnamespace where schemaname='public' and not c.relrowsecurity");
      expect(r.rows).toEqual([]);
    });
    it("new auth users get the unprivileged 'user' role", async () => {
      const r = await admin.query("select role from profiles where id=$1", [USER_ID]);
      expect(r.rows[0].role).toBe("user");
    });
  });

  describe("request_booking", () => {
    it("creates a PENDING booking with server-side price snapshot", async () => {
      const sid = await mkSession(5);
      const r = await book(admin, sid, "a@x.dev", 2);
      expect(r.rows[0].seats_left).toBe(3);
      const b = (await admin.query("select * from bookings where id=$1", [r.rows[0].booking_id])).rows[0];
      expect(b.status).toBe("pending");
      expect(b.unit_price_cents).toBe(2000);
      expect(b.total_price_cents).toBe(4000);
      expect(b.reference).toMatch(/^[0-9A-F]{8}$/);
    });
    it("prevents overbooking and allows filling exactly to capacity", async () => {
      const sid = await mkSession(3);
      await book(admin, sid, "a@x.dev", 2);
      await rejects(book(admin, sid, "b@x.dev", 2), /SESSION_FULL/);
      await book(admin, sid, "c@x.dev", 1); // exactly full
      await rejects(book(admin, sid, "d@x.dev", 1), /SESSION_FULL/);
    });
    it("prevents duplicate bookings (case-insensitive) until the first is cancelled", async () => {
      const sid = await mkSession(5);
      const first = await book(admin, sid, "Dup@X.dev");
      await rejects(book(admin, sid, "dup@x.dev"), /DUPLICATE_BOOKING/);
      await admin.query("update bookings set status='cancelled' where id=$1", [first.rows[0].booking_id]);
      await book(admin, sid, "dup@x.dev"); // allowed again
    });
    it("rejects past, cancelled and unpublished-class sessions", async () => {
      const past = await mkSession(5, { days: -1 });
      await rejects(book(admin, past, "p@x.dev"), /SESSION_PAST/);
      const cancelled = await mkSession(5);
      await admin.query("update class_sessions set status='cancelled' where id=$1", [cancelled]);
      await rejects(book(admin, cancelled, "p@x.dev"), /SESSION_CANCELLED/);
      const draft = await mkSession(5, { cls: draftClassId });
      await rejects(book(admin, draft, "p@x.dev"), /CLASS_UNAVAILABLE/);
      await rejects(book(admin, "11111111-1111-1111-1111-111111111111", "p@x.dev"), /SESSION_NOT_FOUND/);
    });
    it("is concurrency-safe: 12 simultaneous requests for 3 seats yield exactly 3 bookings", async () => {
      const sid = await mkSession(3);
      const clients = await Promise.all(Array.from({ length: 12 }, connect));
      const results = await Promise.allSettled(clients.map((c, i) => book(c, sid, `race${i}@x.dev`)));
      await Promise.all(clients.map((c) => c.end()));
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(3);
      const seats = await admin.query("select session_seats_taken($1) as n", [sid]);
      expect(seats.rows[0].n).toBe(3);
    });
    it("pending AND approved bookings hold seats; rejected/cancelled release them", async () => {
      const sid = await mkSession(2);
      const a = await book(admin, sid, "a@x.dev", 2);
      await rejects(book(admin, sid, "b@x.dev"), /SESSION_FULL/);
      await admin.query("update bookings set status='rejected' where id=$1", [a.rows[0].booking_id]);
      await book(admin, sid, "b@x.dev");
    });
  });

  describe("payments", () => {
    const pay = (id: string, sess = "cs_test_1", amount = 2000) => admin.query("select confirm_booking_payment($1,$2,'pi_1',$3) as r", [id, sess, amount]);
    async function paidSetup(email: string, n = 1) {
      const sid = await mkSession(5);
      const r = await book(admin, sid, email, n);
      const id = r.rows[0].booking_id as string;
      await admin.query("update bookings set stripe_session_id=$2 where id=$1", [id, `cs_${id}`]);
      return { sid, id, sess: `cs_${id}` };
    }
    it("paid bookings start unpaid; free ones need no payment", async () => {
      const { id } = await paidSetup("pay0@x.dev");
      expect((await admin.query("select payment_status from bookings where id=$1", [id])).rows[0].payment_status).toBe("unpaid");
      const freeCls = (await admin.query("insert into classes (slug,title,status,price_cents) values ('t-free','Free','draft',0) returning id")).rows[0].id;
      await admin.query("insert into class_sessions (class_id,starts_at,ends_at,capacity) values ($1, now() + interval '301 days', now() + interval '301 days 1 hour', 5)", [freeCls]);
      await admin.query("update classes set status='published' where id=$1", [freeCls]);
      const fs = await mkSession(5, { cls: freeCls });
      const fb = await book(admin, fs, "free@x.dev");
      expect((await admin.query("select payment_status,status from bookings where id=$1", [fb.rows[0].booking_id])).rows[0]).toEqual({ payment_status: "not_required", status: "pending" });
    });
    it("a successful payment confirms the booking automatically — and only once", async () => {
      const { id, sess } = await paidSetup("pay1@x.dev");
      const a = (await pay(id, sess)).rows[0].r;
      expect(a).toEqual({ changed: true, status: "approved", needs_refund: false });
      const b = (await admin.query("select status,payment_status,amount_paid_cents,stripe_payment_intent,paid_at from bookings where id=$1", [id])).rows[0];
      expect(b).toMatchObject({ status: "approved", payment_status: "paid", amount_paid_cents: 2000, stripe_payment_intent: "pi_1" });
      expect(b.paid_at).not.toBeNull();
      expect((await pay(id, sess)).rows[0].r.changed).toBe(false); // idempotent
    });
    it("rejects a payment for the wrong amount or the wrong checkout session", async () => {
      const { id, sess } = await paidSetup("pay2@x.dev");
      await rejects(pay(id, sess, 1), /AMOUNT_MISMATCH/);
      await rejects(pay(id, "cs_other"), /SESSION_MISMATCH/);
      expect((await admin.query("select status from bookings where id=$1", [id])).rows[0].status).toBe("pending");
    });
    it("abandoned payments release the seats; paid bookings are never released", async () => {
      const { sid, id } = await paidSetup("pay3@x.dev", 3);
      expect((await admin.query("select seats_left from session_availability(now(), now()+interval '60 days') where session_id=$1", [sid])).rows[0].seats_left).toBe(2);
      expect((await admin.query("select release_unpaid_booking($1) as ok", [id])).rows[0].ok).toBe(true);
      expect((await admin.query("select seats_left from session_availability(now(), now()+interval '60 days') where session_id=$1", [sid])).rows[0].seats_left).toBe(5);
      const p = await paidSetup("pay4@x.dev"); await pay(p.id, p.sess);
      expect((await admin.query("select release_unpaid_booking($1) as ok", [p.id])).rows[0].ok).toBe(false);
    });
    it("money arriving for an already-cancelled booking is flagged for refund", async () => {
      const { id, sess } = await paidSetup("pay5@x.dev");
      await admin.query("update bookings set status='cancelled' where id=$1", [id]);
      expect((await pay(id, sess)).rows[0].r).toEqual({ changed: true, status: "cancelled", needs_refund: true });
      expect((await admin.query("select status from bookings where id=$1", [id])).rows[0].status).toBe("cancelled");
    });
    it("refunds are recorded once", async () => {
      const { id, sess } = await paidSetup("pay6@x.dev"); await pay(id, sess);
      expect((await admin.query("select mark_booking_refunded($1) as ok", [id])).rows[0].ok).toBe(true);
      expect((await admin.query("select mark_booking_refunded($1) as ok", [id])).rows[0].ok).toBe(false);
    });
    it("payment functions are not callable by visitors or signed-in users", async () => {
      const { id, sess } = await paidSetup("pay7@x.dev");
      await as("anon", null, async (c) => rejects(c.query("select confirm_booking_payment($1,$2,'pi',2000)", [id, sess]), /permission denied/));
      await as("authenticated", ADMIN_ID, async (c) => rejects(c.query("select confirm_booking_payment($1,$2,'pi',2000)", [id, sess]), /permission denied/));
      await as("anon", null, async (c) => rejects(c.query("select release_unpaid_booking($1)", [id]), /permission denied/));
    });
  });

  describe("status state machine & audit", () => {
    it("allows pending→approved→cancelled and blocks everything else", async () => {
      const sid = await mkSession(9);
      const id = (await book(admin, sid, "s@x.dev")).rows[0].booking_id;
      await admin.query("update bookings set status='approved' where id=$1", [id]);
      await rejects(admin.query("update bookings set status='pending' where id=$1", [id]), /INVALID_STATUS_TRANSITION/);
      await admin.query("update bookings set status='cancelled' where id=$1", [id]);
      await rejects(admin.query("update bookings set status='approved' where id=$1", [id]), /INVALID_STATUS_TRANSITION/);
      const ev = await admin.query("select event,from_status,to_status from booking_events where booking_id=$1 order by id", [id]);
      expect(ev.rows.map((r) => `${r.event}:${r.from_status ?? ""}>${r.to_status}`)).toEqual(["created:>pending", "status_changed:pending>approved", "status_changed:approved>cancelled"]);
    });
    it("rejected is terminal", async () => {
      const id = (await book(admin, await mkSession(9), "r@x.dev")).rows[0].booking_id;
      await admin.query("update bookings set status='rejected' where id=$1", [id]);
      await rejects(admin.query("update bookings set status='approved' where id=$1", [id]), /INVALID_STATUS_TRANSITION/);
    });
    it("core booking facts are immutable", async () => {
      const id = (await book(admin, await mkSession(9), "i@x.dev")).rows[0].booking_id;
      await rejects(admin.query("update bookings set participants=5 where id=$1", [id]), /BOOKING_IMMUTABLE_FIELDS/);
      await rejects(admin.query("update bookings set total_price_cents=1 where id=$1", [id]), /BOOKING_IMMUTABLE_FIELDS/);
    });
    it("cancelling a session cancels its live bookings", async () => {
      const sid = await mkSession(9);
      const id = (await book(admin, sid, "c@x.dev")).rows[0].booking_id;
      await admin.query("update class_sessions set status='cancelled' where id=$1", [sid]);
      expect((await admin.query("select status from bookings where id=$1", [id])).rows[0].status).toBe("cancelled");
    });
    it("capacity cannot be reduced below seats already held", async () => {
      const sid = await mkSession(5);
      await book(admin, sid, "c@x.dev", 3);
      await rejects(admin.query("update class_sessions set capacity=2 where id=$1", [sid]), /CAPACITY_BELOW_BOOKED_SEATS/);
      await admin.query("update class_sessions set capacity=3 where id=$1", [sid]);
    });
  });

  describe("Row Level Security", () => {
    let sid: string;
    beforeAll(async () => { sid = await mkSession(9); await book(admin, sid, "victim@x.dev"); });

    it("anonymous visitors cannot read or write bookings", async () => {
      await rejects(as("anon", null, (c) => c.query("select * from bookings")), /permission denied/);
      await rejects(as("anon", null, (c) => c.query("insert into bookings (session_id,full_name,email,privacy_consent) values ($1,'Evil','e@x.dev',true)", [sid])), /permission denied/);
    });
    it("anonymous visitors cannot call request_booking directly (only the server can)", async () => {
      await rejects(as("anon", null, (c) => book(c, sid, "direct@x.dev")), /permission denied/);
      await rejects(as("authenticated", USER_ID, (c) => book(c, sid, "direct@x.dev")), /permission denied/);
    });
    it("anonymous visitors cannot read private tables", async () => {
      for (const t of ["newsletter_subscribers", "contact_messages", "retreat_enquiries", "profiles", "rate_limits"])
        await rejects(as("anon", null, (c) => c.query(`select * from ${t}`)), /permission denied/);
    });
    it("signed-in non-admins see no bookings and cannot modify them", async () => {
      const rows = await as("authenticated", USER_ID, (c) => c.query("select * from bookings"));
      expect(rows.rows).toHaveLength(0);
      const upd = await as("authenticated", USER_ID, (c) => c.query("update bookings set status='approved'"));
      expect(upd.rowCount).toBe(0);
      const ins = as("authenticated", USER_ID, (c) => c.query("insert into classes (slug,title) values ('hack','Hack')"));
      await rejects(ins, /row-level security/);
    });
    it("non-admins cannot promote themselves to admin", async () => {
      const r = await as("authenticated", USER_ID, (c) => c.query("update profiles set role='admin' where id=$1", [USER_ID]));
      expect(r.rowCount).toBe(0); // RLS hides the row from the update: nothing changes
      expect((await admin.query("select role from profiles where id=$1", [USER_ID])).rows[0].role).toBe("user");
    });
    it("even an admin session cannot change roles through the API (service role only)", async () => {
      await rejects(as("authenticated", ADMIN_ID, (c) => c.query("update profiles set role='admin' where id=$1", [USER_ID])), /role changes are not permitted/);
    });
    it("admins can read and decide bookings", async () => {
      const rows = await as("authenticated", ADMIN_ID, (c) => c.query("select * from bookings where lower(email)='victim@x.dev'"));
      expect(rows.rows).toHaveLength(1);
      await as("authenticated", ADMIN_ID, (c) => c.query("update bookings set status='approved' where id=$1", [rows.rows[0].id]));
      const ev = await admin.query("select actor from booking_events where booking_id=$1 and event='status_changed'", [rows.rows[0].id]);
      expect(ev.rows[0].actor).toBe(ADMIN_ID);
    });
    it("public sees only published classes", async () => {
      const r = await as("anon", null, (c) => c.query("select slug from classes"));
      const slugs = r.rows.map((x) => x.slug);
      expect(slugs).toContain("t-class");
      expect(slugs).not.toContain("t-draft");
    });
    it("public sees only live blog posts (not drafts, not future-scheduled)", async () => {
      await admin.query(`insert into blog_posts (slug,title,status,published_at) values
        ('live','Live','published', now() - interval '1 day'),
        ('sched','Scheduled','published', now() + interval '1 day'),
        ('draft','Draft','draft', null)`);
      const r = await as("anon", null, (c) => c.query("select slug from blog_posts"));
      expect(r.rows.map((x) => x.slug)).toEqual(["live"]);
    });
    it("session_availability exposes seat counts only", async () => {
      const r = await as("anon", null, (c) => c.query("select * from session_availability(now(), now() + interval '30 days') where session_id=$1", [sid]));
      expect(r.rows[0].seats_left).toBe(8);
      expect(Object.keys(r.rows[0])).not.toContain("email");
    });
    it("only admins may write to storage objects", async () => {
      await rejects(as("authenticated", USER_ID, (c) => c.query("insert into storage.objects (bucket_id,name) values ('media','x.jpg')")), /row-level security/);
      await as("authenticated", ADMIN_ID, (c) => c.query("insert into storage.objects (bucket_id,name) values ('media','ok.jpg')"));
    });
  });

  describe("publish guard, online classes, PayPal", () => {
    it("a class cannot be published (or created published) without an upcoming date", async () => {
      await rejects(admin.query("insert into classes (slug,title,status) values ('g-pub','No date','published')"), /PUBLISH_REQUIRES_SESSION/);
      const id = (await admin.query("insert into classes (slug,title) values ('g-draft','Needs date') returning id")).rows[0].id;
      await rejects(admin.query("update classes set status='published' where id=$1", [id]), /PUBLISH_REQUIRES_SESSION/);
      // a past or cancelled session does not count
      await admin.query("insert into class_sessions (class_id,starts_at,ends_at,capacity) values ($1, now() - interval '3 days', now() - interval '3 days' + interval '1 hour', 5)", [id]);
      await admin.query("insert into class_sessions (class_id,starts_at,ends_at,capacity,status) values ($1, now() + interval '5 days', now() + interval '5 days 1 hour', 5, 'cancelled')", [id]);
      await rejects(admin.query("update classes set status='published' where id=$1", [id]), /PUBLISH_REQUIRES_SESSION/);
      await admin.query("insert into class_sessions (class_id,starts_at,ends_at,capacity) values ($1, now() + interval '6 days', now() + interval '6 days 1 hour', 5)", [id]);
      await admin.query("update classes set status='published' where id=$1", [id]);
      expect((await admin.query("select status from classes where id=$1", [id])).rows[0].status).toBe("published");
    });
    it("drafting or archiving never needs a date", async () => {
      const id = (await admin.query("insert into classes (slug,title,status) values ('g-arch','Archive me','archived') returning id")).rows[0].id;
      expect(id).toBeTruthy();
    });
    it("online classes: delivery is public, the meeting link is admin-only", async () => {
      const id = (await admin.query("insert into classes (slug,title,delivery) values ('g-online','Online flow','online') returning id")).rows[0].id;
      await admin.query("insert into class_private (class_id, online_url) values ($1,'https://zoom.us/j/123')", [id]);
      await rejects(admin.query("update class_private set online_url='http://insecure.example' where class_id=$1", [id]), /check constraint/);
      await rejects(as("anon", null, (c) => c.query("select * from class_private")), /permission denied/);
      const asUser = await as("authenticated", USER_ID, (c) => c.query("select * from class_private"));
      expect(asUser.rows).toEqual([]);
      const asAdmin = await as("authenticated", ADMIN_ID, (c) => c.query("select online_url from class_private where class_id=$1", [id]));
      expect(asAdmin.rows[0].online_url).toBe("https://zoom.us/j/123");
    });
    const ppSetup = async (email: string) => {
      const sid = await mkSession(5);
      const id = (await book(admin, sid, email)).rows[0].booking_id as string;
      await admin.query("update bookings set paypal_order_id=$2 where id=$1", [id, `ORDER_${id}`]);
      return { id, order: `ORDER_${id}` };
    };
    it("a captured PayPal payment confirms the booking once; wrong amount/order is refused", async () => {
      const { id, order } = await ppSetup("pp1@x.dev");
      await rejects(admin.query("select confirm_paypal_payment($1,$2,'CAP1',1)", [id, order]), /AMOUNT_MISMATCH/);
      await rejects(admin.query("select confirm_paypal_payment($1,'OTHER','CAP1',2000)", [id]), /ORDER_MISMATCH/);
      const a = (await admin.query("select confirm_paypal_payment($1,$2,'CAP1',2000) as r", [id, order])).rows[0].r;
      expect(a).toEqual({ changed: true, status: "approved", needs_refund: false });
      expect((await admin.query("select status,payment_status,payment_provider,paypal_capture_id from bookings where id=$1", [id])).rows[0])
        .toEqual({ status: "approved", payment_status: "paid", payment_provider: "paypal", paypal_capture_id: "CAP1" });
      expect((await admin.query("select confirm_paypal_payment($1,$2,'CAP1',2000) as r", [id, order])).rows[0].r.changed).toBe(false);
    });
    it("PayPal money arriving for an already-cancelled booking is flagged for refund", async () => {
      const { id, order } = await ppSetup("pp2@x.dev");
      await admin.query("update bookings set status='cancelled' where id=$1", [id]);
      expect((await admin.query("select confirm_paypal_payment($1,$2,'CAP2',2000) as r", [id, order])).rows[0].r.needs_refund).toBe(true);
    });
    it("stale unpaid checkouts are released; fresh, paid and manual-approval ones are not", async () => {
      const stale = await ppSetup("pp3@x.dev"), fresh = await ppSetup("pp4@x.dev"), paid = await ppSetup("pp5@x.dev");
      const manual = (await book(admin, await mkSession(5), "pp6@x.dev")).rows[0].booking_id as string; // no checkout started
      await admin.query("select confirm_paypal_payment($1,$2,'CAP5',2000)", [paid.id, paid.order]);
      await admin.query("update bookings set created_at = now() - interval '2 hours' where id in ($1,$2,$3)", [stale.id, paid.id, manual]);
      expect((await admin.query("select release_stale_unpaid_bookings(35) as n")).rows[0].n).toBe(1);
      const st = async (id: string) => (await admin.query("select status from bookings where id=$1", [id])).rows[0].status;
      expect(await st(stale.id)).toBe("cancelled");
      expect(await st(fresh.id)).toBe("pending");
      expect(await st(paid.id)).toBe("approved");
      expect(await st(manual)).toBe("pending");
    });
    it("payment functions are not callable by browsers", async () => {
      await rejects(as("anon", null, (c) => c.query("select confirm_paypal_payment(gen_random_uuid(),'x','y',1)")), /permission denied/);
      await rejects(as("authenticated", USER_ID, (c) => c.query("select release_stale_unpaid_bookings(1)")), /permission denied/);
    });
  });

  describe("reminders, guest cancellation, retreat deposits", () => {
    const approve = (id: string) => admin.query("update bookings set status='approved' where id=$1", [id]);
    const bookIn = async (days: number, email: string) => { const sid = await mkSession(5, { days }); const id = (await book(admin, sid, email)).rows[0].booking_id as string; return { sid, id }; };

    it("reminders are claimed once, only for approved bookings starting soon", async () => {
      const soon = await bookIn(0.5, "rem1@x.dev"), later = await bookIn(10, "rem2@x.dev"), pend = await bookIn(0.4, "rem3@x.dev");
      await approve(soon.id); await approve(later.id); // pend stays pending
      const first = (await admin.query("select booking_id from claim_booking_reminders(30)")).rows.map((r) => r.booking_id);
      expect(first).toContain(soon.id);
      expect(first).not.toContain(later.id);
      expect(first).not.toContain(pend.id);
      const again = (await admin.query("select booking_id from claim_booking_reminders(30)")).rows.map((r) => r.booking_id);
      expect(again).not.toContain(soon.id); // never emailed twice
      await admin.query("update bookings set reminder_sent_at = null where id=$1", [soon.id]); // a failed send releases the claim
      expect((await admin.query("select booking_id from claim_booking_reminders(30)")).rows.map((r) => r.booking_id)).toContain(soon.id);
    });

    it("a guest can cancel with reference + email, until the policy window closes", async () => {
      const { id } = await bookIn(3, "can1@x.dev");
      const ref = (await admin.query("select reference from bookings where id=$1", [id])).rows[0].reference as string;
      await rejects(admin.query("select customer_cancel_booking($1,'someone@else.dev',24)", [ref]), /BOOKING_NOT_FOUND/);
      const c = (await admin.query("select customer_cancel_booking(lower($1),'CAN1@x.dev',24) as r", [ref])).rows[0].r;
      expect(c).toEqual({ booking_id: id, paid: false });
      expect((await admin.query("select status from bookings where id=$1", [id])).rows[0].status).toBe("cancelled");
      await rejects(admin.query("select customer_cancel_booking($1,'can1@x.dev',24)", [ref]), /NOT_CANCELLABLE/);
    });
    it("cancelling inside the window is refused and the booking is untouched", async () => {
      const { id } = await bookIn(0.5, "can2@x.dev");
      const ref = (await admin.query("select reference from bookings where id=$1", [id])).rows[0].reference as string;
      await rejects(admin.query("select customer_cancel_booking($1,'can2@x.dev',24)", [ref]), /TOO_LATE/);
      expect((await admin.query("select status from bookings where id=$1", [id])).rows[0].status).toBe("pending");
      expect((await admin.query("select customer_cancel_booking($1,'can2@x.dev',0) as r", [ref])).rows[0].r.booking_id).toBe(id); // a 0-hour policy allows it until the start
    });
    it("a cancelled booking frees its seat", async () => {
      const sid = await mkSession(1);
      const id = (await book(admin, sid, "can3@x.dev")).rows[0].booking_id as string;
      await rejects(book(admin, sid, "can4@x.dev"), /FULL|capacity|seats/i);
      const ref = (await admin.query("select reference from bookings where id=$1", [id])).rows[0].reference as string;
      await admin.query("select customer_cancel_booking($1,'can3@x.dev',0)", [ref]);
      await book(admin, sid, "can4@x.dev"); // now succeeds
    });

    const mkRetreat = async (slug: string, capacity: number) => (await admin.query("insert into retreats (slug,title,capacity,price_cents,deposit_cents,status) values ($1,$1,$2,50000,5000,'published') returning id", [slug, capacity])).rows[0].id as string;
    const mkEnq = async (rid: string, people: number, session: string) => (await admin.query("insert into retreat_enquiries (retreat_id,kind,full_name,email,participants,privacy_consent,deposit_cents,payment_status,stripe_session_id) values ($1,'booking_request','Guest','g@x.dev',$2,true,$3,'unpaid',$4) returning id", [rid, people, people * 5000, session])).rows[0].id as string;
    const places = async (rid: string) => (await admin.query("select places_taken from retreats where id=$1", [rid])).rows[0].places_taken as number;

    it("a paid retreat deposit takes places once; wrong amount or session is refused", async () => {
      const rid = await mkRetreat("dep-a", 3); const e = await mkEnq(rid, 2, "cs_a");
      await rejects(admin.query("select confirm_retreat_deposit($1,'stripe','cs_a','pi_1',1)", [e]), /AMOUNT_MISMATCH/);
      await rejects(admin.query("select confirm_retreat_deposit($1,'stripe','cs_other','pi_1',10000)", [e]), /PAYMENT_REFERENCE_MISMATCH/);
      expect(await places(rid)).toBe(0);
      expect((await admin.query("select confirm_retreat_deposit($1,'stripe','cs_a','pi_1',10000) as r", [e])).rows[0].r).toEqual({ changed: true, needs_refund: false, status: "confirmed" });
      expect(await places(rid)).toBe(2);
      expect((await admin.query("select confirm_retreat_deposit($1,'stripe','cs_a','pi_1',10000) as r", [e])).rows[0].r.changed).toBe(false); // idempotent
      expect(await places(rid)).toBe(2);
    });
    it("a deposit arriving after the retreat filled up is flagged for refund and takes no places", async () => {
      const rid = await mkRetreat("dep-b", 3);
      const e1 = await mkEnq(rid, 2, "cs_b1"), e2 = await mkEnq(rid, 2, "cs_b2");
      await admin.query("select confirm_retreat_deposit($1,'stripe','cs_b1','pi_b1',10000)", [e1]);
      const r = (await admin.query("select confirm_retreat_deposit($1,'stripe','cs_b2','pi_b2',10000) as r", [e2])).rows[0].r;
      expect(r.needs_refund).toBe(true);
      expect(await places(rid)).toBe(2); // never oversold
    });
    it("refunding a deposit releases the places exactly once", async () => {
      const rid = await mkRetreat("dep-c", 3); const e = await mkEnq(rid, 2, "cs_c");
      await admin.query("select confirm_retreat_deposit($1,'stripe','cs_c','pi_c',10000)", [e]);
      expect((await admin.query("select refund_retreat_deposit($1) as ok", [e])).rows[0].ok).toBe(true);
      expect(await places(rid)).toBe(0);
      expect((await admin.query("select refund_retreat_deposit($1) as ok", [e])).rows[0].ok).toBe(false);
      expect(await places(rid)).toBe(0);
    });
    it("the new functions are not callable by browsers", async () => {
      await rejects(as("anon", null, (c) => c.query("select claim_booking_reminders(30)")), /permission denied/);
      await rejects(as("anon", null, (c) => c.query("select customer_cancel_booking('A','b@c.de',0)")), /permission denied/);
      await rejects(as("authenticated", USER_ID, (c) => c.query("select confirm_retreat_deposit(gen_random_uuid(),'stripe','x','y',1)")), /permission denied/);
      await rejects(as("authenticated", USER_ID, (c) => c.query("select refund_retreat_deposit(gen_random_uuid())")), /permission denied/);
    });
  });

  describe("rate limiter", () => {
    it("allows up to max hits per window then blocks", async () => {
      const r: boolean[] = [];
      for (let i = 0; i < 4; i++) r.push((await admin.query("select check_rate_limit('t:1.1.1.1', 3, 600) as ok")).rows[0].ok);
      expect(r).toEqual([true, true, true, false]);
    });
    it("is not callable by anonymous clients", async () => {
      await rejects(as("anon", null, (c) => c.query("select check_rate_limit('x', 1, 1)")), /permission denied/);
    });
  });

  describe("newsletter", () => {
    it("enforces case-insensitive unique emails", async () => {
      await admin.query("insert into newsletter_subscribers (email) values ('N@x.dev')");
      await rejects(admin.query("insert into newsletter_subscribers (email) values ('n@X.dev')"), /duplicate key/);
    });
  });
});
