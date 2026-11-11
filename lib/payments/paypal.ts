import "server-only";

/**
 * PayPal Orders v2 over plain REST (no SDK, no client-side PayPal script, so no secrets or payment logic in the browser).
 *   1. We create an order for the booking's amount (read from our database) and send the visitor to PayPal to approve it.
 *   2. PayPal sends them back to /book/paypal/return. WE capture the order server-side and verify status + amount
 *      before the booking is confirmed. An approved-but-never-captured order takes no money.
 */
const base = () => (process.env.PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com");
export const paypalEnabled = () => Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);

let cached: { token: string; exp: number } | null = null;
async function accessToken(): Promise<string> {
  if (cached && cached.exp > Date.now() + 30_000) return cached.token;
  const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64");
  const res = await fetch(`${base()}/v1/oauth2/token`, { method: "POST", headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials" });
  if (!res.ok) throw new Error(`PayPal auth failed (${res.status}) — check PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET / PAYPAL_ENV`);
  const j = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return j.access_token;
}

async function call<T>(path: string, init: { method?: string; body?: unknown; requestId?: string } = {}): Promise<{ status: number; json: T }> {
  const res = await fetch(`${base()}${path}`, {
    method: init.method ?? "GET",
    headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json", ...(init.requestId ? { "PayPal-Request-Id": init.requestId } : {}) },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  return { status: res.status, json: (await res.json().catch(() => ({}))) as T };
}

export const toCents = (value: string) => Math.round(Number(value) * 100);
const money = (cents: number) => (cents / 100).toFixed(2);

export type PayPalOrder = {
  id: string; status: "CREATED" | "SAVED" | "APPROVED" | "VOIDED" | "COMPLETED" | "PAYER_ACTION_REQUIRED";
  links?: { rel: string; href: string }[];
  purchase_units?: { custom_id?: string; payments?: { captures?: { id: string; status: string; amount: { value: string; currency_code: string } }[] } }[];
};

/** Creates the order and returns { orderId, approveUrl }. Amount = unit price × participants, from the database. */
export async function createOrder(o: { bookingId: string; reference: string; title: string; description: string; unitCents: number; quantity: number; currency: string; returnUrl: string; cancelUrl: string }) {
  const total = o.unitCents * o.quantity; const cur = o.currency.toUpperCase();
  const { status, json } = await call<PayPalOrder & { message?: string }>("/v2/checkout/orders", {
    method: "POST", requestId: `order-${o.bookingId}`,
    body: {
      intent: "CAPTURE",
      purchase_units: [{
        reference_id: o.reference, custom_id: o.bookingId, description: o.description.slice(0, 127),
        amount: { currency_code: cur, value: money(total), breakdown: { item_total: { currency_code: cur, value: money(total) } } },
        items: [{ name: o.title.slice(0, 127), quantity: String(o.quantity), unit_amount: { currency_code: cur, value: money(o.unitCents) }, category: "DIGITAL_GOODS" }],
      }],
      payment_source: { paypal: { experience_context: { brand_name: "Be With Yoga", user_action: "PAY_NOW", shipping_preference: "NO_SHIPPING", return_url: o.returnUrl, cancel_url: o.cancelUrl } } },
    },
  });
  const link = json.links?.find((l) => l.rel === "payer-action" || l.rel === "approve")?.href;
  if (status >= 300 || !json.id || !link) throw new Error(`PayPal could not create the order (${status}): ${json.message ?? "no approval link"}`);
  return { orderId: json.id, approveUrl: link };
}

export async function getOrder(orderId: string): Promise<PayPalOrder> {
  const { status, json } = await call<PayPalOrder>(`/v2/checkout/orders/${encodeURIComponent(orderId)}`);
  if (status >= 300) throw new Error(`PayPal order lookup failed (${status})`);
  return json;
}

/** Captures an approved order. Safe to call twice: an already-captured order is simply read back. */
export async function captureOrder(orderId: string): Promise<PayPalOrder> {
  const { status, json } = await call<PayPalOrder>(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, { method: "POST", requestId: `capture-${orderId}`, body: {} });
  if (status < 300) return json;
  return getOrder(orderId); // e.g. ORDER_ALREADY_CAPTURED, or not yet approved → status tells the caller
}

export async function refundCapture(captureId: string, bookingId: string): Promise<void> {
  const { status, json } = await call<{ status?: string; message?: string; details?: { issue?: string }[] }>(`/v2/payments/captures/${encodeURIComponent(captureId)}/refund`, { method: "POST", requestId: `refund-${bookingId}`, body: {} });
  if (status >= 300 && !json.details?.some((d) => d.issue === "CAPTURE_FULLY_REFUNDED")) throw new Error(`PayPal refund failed (${status}): ${json.message ?? ""}`);
}
