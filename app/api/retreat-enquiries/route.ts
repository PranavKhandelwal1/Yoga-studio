import { NextResponse, type NextRequest } from "next/server";
import { retreatEnquirySchema } from "@/lib/validation/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { sameOrigin } from "@/lib/utils/origin";
import { adminNotice, sendMail } from "@/lib/email/send";
import { payMethods } from "@/lib/payments/methods";
import { getStripe } from "@/lib/payments/stripe";
import { startRetreatPayPal, startRetreatStripe } from "@/lib/payments/retreat";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!(await rateLimit("retreat-enquiry", 5, 600))) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  const parsed = retreatEnquirySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Please check the form.", fields: parsed.error.flatten().fieldErrors }, { status: 422 });
  }
  const d = parsed.data;
  if (d.website) return NextResponse.json({ ok: true });

  const db = createAdminClient();
  const { data: retreat } = await db.from("retreats").select("id,title,capacity,places_taken,status,deposit_cents").eq("id", d.retreatId).maybeSingle();
  if (!retreat || retreat.status !== "published") return NextResponse.json({ error: "Retreat not found." }, { status: 404 });
  if (d.kind === "booking_request" && retreat.capacity != null && retreat.capacity - retreat.places_taken < d.participants) {
    return NextResponse.json({ error: "Not enough places left on this retreat. Send an enquiry instead." }, { status: 409 });
  }

  // Deposit flow: guest pays first; places are only taken once the payment is confirmed (in the database).
  const methods = payMethods();
  const payNow = d.kind === "booking_request" && (retreat.deposit_cents ?? 0) > 0 && methods.length > 0;
  const method = payNow ? (d.payMethod && methods.includes(d.payMethod) ? d.payMethod : methods[0]) : null;
  const deposit = payNow ? (retreat.deposit_cents as number) * d.participants : null;

  const { data: row, error } = await db.from("retreat_enquiries").insert({
    retreat_id: d.retreatId, kind: d.kind, full_name: d.fullName, email: d.email, phone: d.phone ?? null,
    participants: d.participants, message: d.message ?? null, privacy_consent: true,
    ...(payNow ? { deposit_cents: deposit, payment_status: "unpaid" } : {}),
  }).select("id").single();
  if (error || !row) return NextResponse.json({ error: "Something went wrong." }, { status: 500 });

  if (payNow) {
    try {
      const checkoutUrl = method === "paypal" ? await startRetreatPayPal(db, row.id) : await startRetreatStripe(db, getStripe()!, row.id);
      return NextResponse.json({ ok: true, checkoutUrl }, { status: 201 });
    } catch (e) {
      console.error("[retreat deposit] could not start payment", e);
      await db.from("retreat_enquiries").delete().eq("id", row.id);
      return NextResponse.json({ error: "We couldn't start the payment. Please try again, or send an enquiry instead." }, { status: 502 });
    }
  }

  await sendMail(adminNotice(`Retreat ${d.kind === "enquiry" ? "enquiry" : "booking request"}: ${retreat.title}`,
    [`${d.fullName} <${d.email}> · ${d.participants} participant(s)`, d.message ?? ""], d.email));
  return NextResponse.json({ ok: true }, { status: 201 });
}
